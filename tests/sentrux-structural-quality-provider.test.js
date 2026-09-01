import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSentruxStructuralQualityProvider } from "../src/core/structural-quality/sentrux-mcp.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "fake-sentrux-mcp.mjs");

function provider(projectPath, mode = "valid", extra = {}) {
  return createSentruxStructuralQualityProvider({
    projectPath,
    executable: process.execPath,
    args: [fixture],
    timeoutMs: 500,
    maxOutputBytes: 2 * 1024 * 1024,
    env: {
      SENTRUX_FAKE_MODE: mode,
      ...extra,
    },
  });
}

function input(projectPath, overrides = {}) {
  return {
    projectPath,
    taskId: "sentrux-provider-task",
    timeoutMs: 500,
    maxOutputBytes: 2 * 1024 * 1024,
    ...overrides,
  };
}

test("Sentrux MCP handshake, scan, and health produce one normalized snapshot", async () => {
  const projectPath = path.dirname(fixture);
  const result = await provider(projectPath).scan(input(projectPath));
  assert.equal(result.provider.id, "sentrux");
  assert.equal(result.provider.version, "0.5.7");
  assert.equal(result.provider.transport, "mcp-stdio");
  assert.equal(result.detection.available, true);
  assert.equal(result.snapshot.qualitySignal, 9000);
  assert.equal(result.snapshot.bottleneck, "modularity");
  assert.equal(result.snapshot.statistics.crossModuleEdges, 2);
});

test("the adapter invokes a trusted process without a shell", async () => {
  const projectPath = path.dirname(fixture);
  let spawnOptions;
  const wrappedSpawn = (...args) => {
    spawnOptions = args[2];
    return spawn(...args);
  };
  const trusted = createSentruxStructuralQualityProvider({
    projectPath,
    executable: process.execPath,
    args: [fixture],
    spawnImpl: wrappedSpawn,
    timeoutMs: 500,
  });
  await trusted.detect(input(projectPath));
  assert.equal(spawnOptions.shell, false);
  assert.deepEqual(spawnOptions.stdio, ["pipe", "pipe", "pipe"]);
});

test("protocol, identity, version, and provider failures fail closed", async () => {
  const projectPath = path.dirname(fixture);
  for (const [mode, code] of [
    ["malformed-jsonrpc", "E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID"],
    ["wrong-server-name", "E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID"],
    ["missing-health", "E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID"],
  ]) {
    const detected = await provider(projectPath, mode).detect(input(projectPath));
    assert.equal(detected.available, false, mode);
    assert.equal(detected.reasonCode, code, mode);
    await assert.rejects(() => provider(projectPath, mode).scan(input(projectPath)), { code });
  }
  const providerFailure = provider(projectPath, "provider-error");
  assert.equal((await providerFailure.detect(input(projectPath))).available, true);
  await assert.rejects(() => providerFailure.scan(input(projectPath)), { code: "E_STRUCTURAL_QUALITY_SCAN_FAILED" });
  const old = provider(projectPath, "valid", { SENTRUX_FAKE_VERSION: "0.5.4" });
  assert.equal((await old.detect(input(projectPath))).reasonCode, "E_STRUCTURAL_QUALITY_PROVIDER_VERSION_UNSUPPORTED");
  await assert.rejects(() => old.scan(input(projectPath)), { code: "E_STRUCTURAL_QUALITY_PROVIDER_VERSION_UNSUPPORTED" });
});

test("timeouts and combined stdout/stderr limits terminate the external process", async () => {
  const projectPath = path.dirname(fixture);
  await assert.rejects(
    () => provider(projectPath, "hang", { SENTRUX_FAKE_MODE: "hang" }).scan(input(projectPath, { timeoutMs: 25 })),
    { code: "E_STRUCTURAL_QUALITY_TIMEOUT" },
  );
  for (const mode of ["oversized-output", "stderr-flood"]) {
    await assert.rejects(
      () => provider(projectPath, mode).scan(input(projectPath, { maxOutputBytes: 1024 })),
      { code: "E_STRUCTURAL_QUALITY_OUTPUT_LIMIT" },
    );
  }
});

test("secret-like diagnostics and absolute paths outside the target never become evidence", async () => {
  const projectPath = path.dirname(fixture);
  await assert.rejects(
    () => provider(projectPath, "secret-field").scan(input(projectPath)),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  await assert.rejects(
    () => provider(projectPath, "secret-health").scan(input(projectPath)),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  await assert.rejects(
    () => provider(projectPath, "outside-path").scan(input(projectPath)),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
});
