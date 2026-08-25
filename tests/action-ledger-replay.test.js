import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  proposeAction,
  readAction,
  transitionAction,
  transitionAuthorizedAction,
  validateActionLedgerConsistency,
} from "../src/core/actions.js";
import { projectActionLedger } from "../src/core/action-ledger-projection.js";
import { taskActionPath } from "../src/core/task-paths.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

const AUTHORIZATION_EVIDENCE = (actionFingerprint) => ({
  actionFingerprint,
  capabilityDecision: "ALLOW",
  capabilityPolicyFingerprint: "a".repeat(64),
  policyLockDigest: `sha256:${"b".repeat(64)}`,
  taskPolicyDigest: `sha256:${"c".repeat(64)}`,
});

async function freshTarget(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `forgeloop-replay-${prefix}-`));
}

// The tests below operate on raw event fixtures appended through the canonical
// transition APIs; forged scenarios are produced by editing artifacts/events
// directly to simulate tampering.

test("revision skip in the event chronology is audit-visible", async () => {
  const target = await freshTarget("revskip");
  const taskId = "replay-task-1";
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId, input: {
      actionId: "action-rev", effectClass: "REVERSIBLE_WRITE", capability: "filesystem.write",
      target: "f", operation: "op", idempotencyKey: "replay:rev:v1",
      requiredForCompletion: false, requirement: null, provenance: "CALLER_REPORTED",
    } });
    // Legitimately authorize, then hand-forge a STARTED artifact whose
    // revision skips a step without any event.
    await transitionAuthorizedAction(target, { packageRoot, taskId, actionId: action.actionId,
      expectedRevision: 0, expectedFingerprint: action.actionFingerprint,
      details: AUTHORIZATION_EVIDENCE(action.actionFingerprint) });
    const current = await readAction(target, { packageRoot, taskId, actionId: action.actionId });
    const forged = { ...current, state: "STARTED", revision: 5 };
    await writeFile(path.join(target, taskActionPath(taskId, action.actionId)), JSON.stringify(forged, null, 2) + "\n", "utf8");

    const issues = await validateActionLedgerConsistency(target, { packageRoot, taskId });
    assert.ok(issues.some((i) => i.actionId === "action-rev"), "forged revision/state divergence is detected");
  } finally { await rm(target, { recursive: true, force: true }); }
});

test("STARTED without trusted authorization evidence makes VERIFIED untrusted", async () => {
  const target = await freshTarget("legacyauth");
  const taskId = "replay-task-2";
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId, input: {
      actionId: "action-legacy", effectClass: "REVERSIBLE_WRITE", capability: "filesystem.write",
      target: "f", operation: "op", idempotencyKey: "replay:legacy:v1",
      requiredForCompletion: false, requirement: null, provenance: "CALLER_REPORTED",
    } });
    // Legacy-era chronology appended directly: AUTHORIZED without any policy
    // binding fields, followed by STARTED. This is readable history but is
    // never trusted modern authorization evidence.
    const { appendProtocolEvent } = await import("../src/core/events.js");
    await appendProtocolEvent(target, {
      taskId,
      event: "ACTION_AUTHORIZED",
      fingerprint: action.actionFingerprint,
      details: {
        actionId: action.actionId,
        actionFingerprint: action.actionFingerprint,
        fromState: "PROPOSED",
        toState: "AUTHORIZED",
        revision: 1,
      },
    }, packageRoot, { taskId });
    await appendProtocolEvent(target, {
      taskId,
      event: "ACTION_STARTED",
      fingerprint: action.actionFingerprint,
      details: {
        actionId: action.actionId,
        actionFingerprint: action.actionFingerprint,
        fromState: "AUTHORIZED",
        toState: "STARTED",
        revision: 2,
      },
    }, packageRoot, { taskId });

    const projection = await projectActionLedger({ target, packageRoot, taskId, actionId: "action-legacy", artifact: action });
    assert.equal(projection.authorization.valid, false,
      "legacy authorization evidence is not trusted");
    assert.equal(
      projection.errors.some((e) => e.message.includes("without valid modern authorization")),
      true,
      "STARTED without valid modern authorization is flagged",
    );
  } finally { await rm(target, { recursive: true, force: true }); }
});

test("direct artifact edits remain audit-visible via replay divergence", async () => {
  const target = await freshTarget("artifact-edit");
  const taskId = "replay-task-3";
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId, input: {
      actionId: "action-edit", effectClass: "REVERSIBLE_WRITE", capability: "filesystem.write",
      target: "f", operation: "op", idempotencyKey: "replay:edit:v1",
      requiredForCompletion: false, requirement: null, provenance: "CALLER_REPORTED",
    } });
    await transitionAuthorizedAction(target, { packageRoot, taskId, actionId: action.actionId,
      expectedRevision: 0, expectedFingerprint: action.actionFingerprint,
      details: AUTHORIZATION_EVIDENCE(action.actionFingerprint) });
    await transitionAction(target, { packageRoot, taskId, actionId: action.actionId, to: "STARTED" });

    // Hand-edit artifact to COMMITTED with no matching event.
    const current = await readAction(target, { packageRoot, taskId, actionId: action.actionId });
    const edited = { ...current, state: "COMMITTED" };
    await writeFile(path.join(target, taskActionPath(taskId, action.actionId)), JSON.stringify(edited, null, 2) + "\n", "utf8");

    const projection = await projectActionLedger({ target, packageRoot, taskId, actionId: "action-edit", artifact: edited });
    assert.equal(projection.valid, false);
    assert.ok(projection.errors.some((e) => e.message.includes("artifact state")));
  } finally { await rm(target, { recursive: true, force: true }); }
});
