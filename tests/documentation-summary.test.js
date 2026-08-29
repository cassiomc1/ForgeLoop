import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("generated agent protocol summary is current and clearly non-authoritative", async () => {
  execFileSync(process.execPath, ["scripts/generate-agent-protocol-summary.mjs", "--check"], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  const summary = await readFile(path.join(repositoryRoot, "docs", "AGENT_PROTOCOL_SUMMARY.md"), "utf8");
  assert.match(summary, /Generated from the ForgeLoop protocol registries/iu);
  assert.match(summary, /attestation/i);
  assert.match(summary, /workspace binding/i);
});
