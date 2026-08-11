import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { AGENT_SUPPORT } from "../src/core/agent-support.js";
import { assertWorkStateSemantics } from "../src/core/work-state.js";
import { validateReceipt } from "../src/core/receipt.js";
import { assertSchema, readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot, TEMPLATE_PATHS } from "../src/core/templates.js";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const expectedAgents = [
  {
    id: "codex",
    name: "Codex",
    support: "direct",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://developers.openai.com/codex/guides/agents-md",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    support: "direct",
    instructionFiles: ["CLAUDE.md"],
    officialDocs: "https://code.claude.com/docs/en/memory",
  },
  {
    id: "cursor",
    name: "Cursor",
    support: "direct",
    instructionFiles: ["AGENTS.md", ".cursor/rules/project-loop.mdc"],
    officialDocs: "https://cursor.com/docs/rules",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    support: "direct",
    instructionFiles: [".github/copilot-instructions.md"],
    officialDocs: "https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://antigravity.google/docs/cli/best-practices",
  },
  {
    id: "opencode",
    name: "OpenCode",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://opencode.ai/docs/rules/",
  },
  {
    id: "hermes",
    name: "Hermes",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md",
  },
  {
    id: "pi",
    name: "Pi",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md",
  },
  {
    id: "command-code",
    name: "Command Code",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://commandcode.ai/docs/core-concepts/memory",
  },
  {
    id: "freebuff",
    name: "Freebuff",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/CodebuffAI/freebuff/blob/main/common/src/constants/knowledge.ts",
  },
];

const expectedIds = expectedAgents.map((agent) => agent.id);

test("agent registry covers every supported agent exactly once", () => {
  assert.deepEqual(AGENT_SUPPORT.map((agent) => agent.id), expectedIds);
  assert.equal(new Set(AGENT_SUPPORT.map((agent) => agent.id)).size, expectedIds.length);
});

test("agent registry uses valid support records and packaged instruction files", () => {
  for (const agent of AGENT_SUPPORT) {
    const expected = expectedAgents.find((candidate) => candidate.id === agent.id);

    assert.match(agent.name, /\S/);
    assert.ok(["direct", "agents-md"].includes(agent.support));
    assert.ok(agent.instructionFiles.length > 0);
    assert.ok(agent.instructionFiles.every((file) => TEMPLATE_PATHS.includes(file)));
    assert.match(agent.officialDocs, /^https:\/\//);
    assert.deepEqual(agent.instructionFiles, expected.instructionFiles);
    assert.equal(agent.name, expected.name);
    assert.equal(agent.support, expected.support);
    assert.equal(agent.officialDocs, expected.officialDocs);
  }
});

test("compatibility guide mirrors every registry entry", async () => {
  const guide = await readFile("AGENT_COMPATIBILITY.md", "utf8");
  for (const agent of AGENT_SUPPORT) {
    const row = guide
      .split("\n")
      .find((line) => line.startsWith(`| ${agent.name} |`));
    const cells = row?.split("|").slice(1, -1).map((cell) => cell.trim());

    assert.ok(cells, `missing guide row for ${agent.name}`);
    assert.equal(cells[0], agent.name);
    assert.equal(
      cells[1],
      agent.support === "direct" ? "Direct adapter" : "`AGENTS.md` compatibility",
    );
    assert.equal(
      cells[2],
      agent.instructionFiles.map((file) => `\`${file}\``).join(", "),
    );
    assert.match(cells[3], new RegExp(agent.officialDocs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("npm package contains the registry and compatibility guide", () => {
  const output = execFileSync(npmCommand, ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const paths = JSON.parse(output)[0].files.map((entry) => entry.path);
  assert.ok(paths.includes("src/core/agent-support.js"));
  assert.ok(paths.includes("AGENT_COMPATIBILITY.md"));
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
