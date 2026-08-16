import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { canonicalFingerprint } from "../src/core/artifacts.js";

test("continuity commands are flat CLI commands", async () => {
  const { COMMANDS, parseArgs } = await import("../src/cli.js");
  for (const command of ["continuity", "record-continuity", "reconcile-continuity", "clear-continuity"]) {
    assert.equal(COMMANDS.includes(command), true, command);
  }

  const parsed = parseArgs([
    "record-continuity",
    "--focus-id", "mobile-nav",
    "--focus-summary", "Finish mobile navigation",
    "--remaining", "contact:Finish contact form",
    "--known-issue", "overflow:Fix mobile overflow",
    "--changed-area", "src/components",
    "--inspect-first", "src/components/Header.jsx",
    "--resume-note", "Inspect the current diff before continuing",
    "--json",
  ]);
  assert.equal(parsed.command, "record-continuity");
  assert.equal(parsed.options.continuityFocusId, "mobile-nav");
  assert.equal(parsed.options.continuityRemaining.length, 1);
  assert.equal(parsed.options.continuityKnownIssues.length, 1);
  assert.deepEqual(parsed.options.continuityChangedAreas, ["src/components"]);
  assert.deepEqual(parsed.options.continuityInspectFirst, ["src/components/Header.jsx"]);
  assert.equal(parsed.options.json, true);
});

test("record-continuity rejects actor attempts to provide canonical identity fields", async () => {
  const { parseArgs } = await import("../src/cli.js");
  assert.throws(() => parseArgs(["record-continuity", "--task-id", "evil"]), /Unknown option|not valid/i);
  assert.throws(() => parseArgs(["record-continuity", "--phase", "COMPLETE"]), /Unknown option|not valid/i);
  assert.throws(() => parseArgs(["record-continuity", "--work-state-fingerprint", "f".repeat(64)]), /Unknown option|not valid/i);
});

test("record-continuity parses work-item flags and writes only operational context", async () => {
  const { runRecordContinuity } = await import("../src/commands/record-continuity.js");
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-continuity-cli-"));
  try {
    const contract = { schemaVersion: 1, protocolVersion: 1, taskId: "task-1", objective: "test" };
    const contractFingerprint = canonicalFingerprint(contract);
    const state = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "task-1",
      contractFingerprint,
      repositoryFingerprint: { branch: "main", head: "old" },
      phase: "EXECUTING",
      selectedGuides: [],
      completedSteps: ["planning"],
      pendingSteps: ["implementation"],
      requiredArtifacts: [],
      checks: [], failures: [], blockers: [], verificationEvidence: [],
      lastUpdated: "2026-08-16T16:00:00.000Z",
    };
    const result = await runRecordContinuity({
      target,
      packageRoot: path.resolve("."),
      focusId: "mobile-nav",
      focusSummary: "Finish mobile navigation",
      remaining: ["contact:Finish contact form"],
      knownIssues: ["overflow:Fix mobile overflow"],
      changedAreas: ["src/components"],
      inspectFirst: ["src/components/Header.jsx"],
      resumeNote: "Inspect current diff",
      state,
      contract: { value: contract, fingerprint: contractFingerprint },
      repositoryFingerprint: { branch: "main", head: "new" },
      now: "2026-08-16T17:00:00.000Z",
    });
    assert.equal(result.value.currentFocus.id, "mobile-nav");
    assert.equal(result.value.remainingWork[0].id, "contact");
    assert.equal(result.value.knownIssues[0].id, "overflow");
    const stored = JSON.parse(await readFile(path.join(target, ".forgeloop/continuity.json"), "utf8"));
    assert.equal(stored.taskId, "task-1");
    assert.equal(stored.phase, "EXECUTING");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("clear-continuity removes only the continuity artifact", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { runClearContinuity } = await import("../src/commands/clear-continuity.js");
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-clear-continuity-"));
  try {
    await mkdir(path.join(target, ".forgeloop"), { recursive: true });
    await writeFile(path.join(target, ".forgeloop/continuity.json"), "{}\n");
    await writeFile(path.join(target, ".forgeloop/work-state.json"), "{}\n");
    const result = await runClearContinuity({ target });
    assert.equal(result.removed, true);
    await assert.rejects(readFile(path.join(target, ".forgeloop/continuity.json")), /ENOENT/);
    assert.equal(await readFile(path.join(target, ".forgeloop/work-state.json"), "utf8"), "{}\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
