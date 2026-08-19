import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { DISCOVERY_SURFACES } from "../src/core/discovery-surfaces.js";
import { assertWorkStateSemantics } from "../src/core/work-state.js";
import { validateReceipt } from "../src/core/receipt.js";
import { assertSchema, readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot, TEMPLATE_PATHS } from "../src/core/templates.js";
import { nativeShim } from "../src/core/native-adapters.js";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const expectedSurfaces = [
  {
    id: "agents-md",
    path: "AGENTS.md",
    kind: "project-instructions",
  },
  {
    id: "claude-md",
    path: "CLAUDE.md",
    kind: "project-instructions",
  },
  {
    id: "cursor-rule",
    path: ".cursor/rules/project-loop.mdc",
    kind: "project-instructions",
  },
  {
    id: "github-repository-instructions",
    path: ".github/copilot-instructions.md",
    kind: "project-instructions",
  },
];

test("discovery surface registry covers every shipped project adapter path exactly once", () => {
  const surfaceIds = DISCOVERY_SURFACES.map((surface) => surface.id);
  const expectedIds = expectedSurfaces.map((surface) => surface.id);
  assert.deepEqual(surfaceIds, expectedIds);
  assert.equal(new Set(surfaceIds).size, expectedIds.length);
});

test("every discovery surface points to a packaged template path", () => {
  for (const surface of DISCOVERY_SURFACES) {
    const expected = expectedSurfaces.find((candidate) => candidate.id === surface.id);
    assert.ok(expected, `unexpected surface ${surface.id}`);
    assert.equal(surface.path, expected.path);
    assert.equal(surface.kind, expected.kind);
    assert.ok(TEMPLATE_PATHS.includes(surface.path), `missing in TEMPLATE_PATHS: ${surface.path}`);
  }
});

test("all discovery surfaces contain the protocol required marker and universal instructions", async () => {
  for (const surface of DISCOVERY_SURFACES) {
    const content = await readFile(surface.path, "utf8");
    assert.match(content, /<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->/);
    assert.match(content, /LOOP_ENGINEERING\.md/);
    assert.match(content, /PROTOCOL_INTEGRATION\.md/);
    assert.match(content, /regardless of model, provider/i);
    assert.match(content, /in spirit/i);
    assert.match(content, /missing verification tool/i);
    assert.match(content, /forgeloop task-list/i);
    assert.match(content, /forgeloop next/i);
    assert.doesNotMatch(content, /If\s+`?\.forgeloop\/work-state\.json`?\s+exists/i);
  }
});

test("native shim generator emits protocol required marker and references", () => {
  for (const surface of DISCOVERY_SURFACES) {
    const shim = nativeShim(surface.path);
    assert.match(shim, /<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->/);
    assert.match(shim, /LOOP_ENGINEERING\.md/);
    assert.match(shim, /PROTOCOL_INTEGRATION\.md/);
    assert.match(shim, /regardless of model, provider, product, IDE/i);
    assert.match(shim, /in spirit/i);
    assert.match(shim, /missing verification tool/i);
    assert.match(shim, /forgeloop task-list/i);
    assert.match(shim, /forgeloop next/i);
    assert.doesNotMatch(shim, /If\s+`?\.forgeloop\/work-state\.json`?\s+exists/i);
  }
});

test("NATIVE-TASK-1/2/3/4/5: shims are task-aware and never present legacy singleton as primary", () => {
  for (const surface of DISCOVERY_SURFACES) {
    const shim = nativeShim(surface.path);
    // NATIVE-TASK-1: shim directs task discovery through the CLI.
    assert.match(shim, /forgeloop task-list --json/);
    // NATIVE-TASK-2: shim mentions task-aware resume.
    assert.match(shim, /forgeloop next --task <id> --json/);
    // NATIVE-TASK-3: legacy singleton is not the primary modern discovery mechanism.
    assert.doesNotMatch(shim, /If\s+`?\.forgeloop\/work-state\.json`?\s+exists/i);
    assert.match(shim, /backward compatibility/);
    // NATIVE-TASK-4: harness/model/session change does not create a new task.
    assert.match(shim, /does not create a new task/);
    // NATIVE-TASK-5: every adapter target is a real discovery surface.
    assert.ok(DISCOVERY_SURFACES.some((candidate) => candidate.path === surface.path));
  }
});

test("unknown runtime regression: unlisted runtime is not exempt from protocol", async () => {
  const protocol = await readFile("PROTOCOL_INTEGRATION.md", "utf8");
  const loop = await readFile("LOOP_ENGINEERING.md", "utf8");

  // An arbitrary runtime identity
  const arbitraryRuntime = "Custom-Enterprise-Agent-9000";

  // Protocol rules assert universality
  assert.match(protocol, /CONFORMANCE_UNVERIFIED/);
  assert.match(protocol, /INVALID:[\s\S]*not a named ForgeLoop integration[\s\S]*VALID:/);
  assert.match(loop, /Unknown execution environment policy/);
  assert.match(loop, /Never downgrade ForgeLoop to optional guidance solely because the runtime\s+name is unknown/);

  // Runtime applicability is capability-based, not allowlist-based
  assert.doesNotMatch(protocol, new RegExp(`\\b${arbitraryRuntime}\\b`));
  assert.match(protocol, /Capabilities determine how much of ForgeLoop can be executed/);
});

test("no-allowlist invariant: canonical runtime files contain no agent eligibility lists", async () => {
  const filesToCheck = [
    "src/core/discovery-surfaces.js",
    "src/core/native-adapters.js",
    "src/core/inspect.js",
  ];

  for (const relativePath of filesToCheck) {
    const content = await readFile(relativePath, "utf8");
    assert.doesNotMatch(content, /support:\s*["']direct["']/i, `forbidden allowlist syntax in ${relativePath}`);
    assert.doesNotMatch(content, /support:\s*["']agents-md["']/i, `forbidden allowlist syntax in ${relativePath}`);
    assert.doesNotMatch(content, /AGENT_SUPPORT/i, `deprecated AGENT_SUPPORT in ${relativePath}`);
  }
});

test("legacy compatibility guide provides a deprecation pointer to protocol integration", async () => {
  const alias = await readFile("AGENT_COMPATIBILITY.md", "utf8");
  assert.match(alias, /# Deprecated filename/);
  assert.match(alias, /PROTOCOL_INTEGRATION\.md/);
});

test("npm package contains the discovery surfaces registry and protocol integration", () => {
  const output = execFileSync(npmCommand, ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const paths = JSON.parse(output)[0].files.map((entry) => entry.path);
  assert.ok(paths.includes("src/core/discovery-surfaces.js"));
  assert.ok(paths.includes("PROTOCOL_INTEGRATION.md"));
  assert.ok(paths.includes("AGENT_COMPATIBILITY.md"));
  assert.equal(paths.includes("src/core/agent-support.js"), false);
});

test("protocol v1 fixtures remain schema-valid and serializable", async () => {
  const state = JSON.parse(await readFile("tests/fixtures/states/valid.json", "utf8"));
  const receipt = JSON.parse(await readFile("tests/fixtures/receipts/valid.json", "utf8"));
  const protocol = JSON.parse(
    await readFile("tests/fixtures/compatibility/protocol-v1.json", "utf8"),
  );

  assertSchema(state, await readSchema("work-state", getPackageRoot()), "fixture state");
  assert.doesNotThrow(() => assertWorkStateSemantics(state));
  await assert.doesNotReject(() => validateReceipt(receipt, getPackageRoot()));
  assert.deepEqual(protocol, {
    schemaVersion: 1,
    protocolVersion: 1,
    artifactType: "execution-receipt",
    compatibility: "v1",
  });
});

test("truncated and secret-bearing fixtures are rejected without execution", async () => {
  const truncated = await readFile("tests/fixtures/states/truncated.json", "utf8");
  const invalidReceipt = JSON.parse(
    await readFile("tests/fixtures/receipts/secret.json", "utf8"),
  );

  assert.throws(() => JSON.parse(truncated), SyntaxError);
  await assert.rejects(
    () => validateReceipt(invalidReceipt, getPackageRoot()),
    /secret-like field/i,
  );
});

test("README documents package and protocol compatibility guarantees", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /Patch releases preserve the v1 schemas/i);
  assert.match(readme, /Minor releases preserve existing v1 artifacts/i);
  assert.match(readme, /Major releases may change required fields/i);
  assert.match(readme, /npm package version is independent of protocol version/i);
});
