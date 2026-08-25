import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  proposeAction,
  readAction,
  transitionAction,
  listActions,
  findActionByIdempotencyKey,
} from "../src/core/actions.js";
import { readEvents } from "../src/core/events.js";
import { taskActionPath } from "../src/core/task-paths.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

async function makeTarget() {
  return mkdtemp(path.join(os.tmpdir(), "forgeloop-actions-"));
}

function actionInput(overrides = {}) {
  return {
    actionId: "action-push-release",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/release-1.7",
    operation: "push release branch",
    idempotencyKey: "task-x:push:release:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "HOST_REPORTED",
    ...overrides,
  };
}

test("proposeAction atomically creates the artifact and appends ACTION_PROPOSED", async () => {
  const target = await makeTarget();
  try {
    const result = await proposeAction(target, { packageRoot, taskId: "ledger-task", input: actionInput() });

    assert.equal(result.action.state, "PROPOSED");
    assert.equal(result.created, true);
    assert.equal(result.action.taskId, "ledger-task");
    assert.ok(result.action.actionFingerprint);

    const stored = await readAction(target, { packageRoot, taskId: "ledger-task", actionId: result.action.actionId });
    assert.equal(stored.actionId, "action-push-release");

    const events = await readEvents(target, packageRoot, { taskId: "ledger-task" });
    const propose = events.find((event) => event.event === "ACTION_PROPOSED");
    assert.ok(propose, "ACTION_PROPOSED appended");
    assert.equal(propose.details.actionId, "action-push-release");
    assert.equal(propose.details.actionFingerprint, result.action.actionFingerprint);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("proposeAction is idempotent per key and conflicts on fingerprint drift", async () => {
  const target = await makeTarget();
  try {
    const first = await proposeAction(target, { packageRoot, taskId: "idem-task", input: actionInput() });
    assert.equal(first.created, true);

    // Same key + same identity -> idempotent reuse.
    const second = await proposeAction(target, { packageRoot, taskId: "idem-task", input: actionInput() });
    assert.equal(second.created, false);
    assert.equal(second.action.actionId, first.action.actionId);
    assert.equal(second.idempotent, true);

    // Same key + different fingerprint -> fail closed.
    await assert.rejects(
      proposeAction(target, {
        packageRoot,
        taskId: "idem-task",
        input: actionInput({ target: "origin/other", actionId: "action-other" }),
      }),
      (error) => error.code === "E_ACTION_IDEMPOTENCY_CONFLICT",
    );

    // Side-effecting class without key -> required error.
    await assert.rejects(
      proposeAction(target, {
        packageRoot,
        taskId: "idem-task",
        input: actionInput({ idempotencyKey: undefined, actionId: "action-nokey" }),
      }),
      (error) => error.code === "E_ACTION_IDEMPOTENCY_REQUIRED",
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("READ_ONLY actions do not require an idempotency key", async () => {
  const target = await makeTarget();
  try {
    const result = await proposeAction(target, {
      packageRoot,
      taskId: "readonly-task",
      input: actionInput({
        effectClass: "READ_ONLY",
        capability: "network.read",
        idempotencyKey: undefined,
        actionId: "action-read-status",
      }),
    });
    assert.equal(result.action.effectClass, "READ_ONLY");
    assert.equal(result.action.idempotencyKey ?? null, null);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("transitionAction enforces the state machine, revision, and ledger pairing", async () => {
  const target = await makeTarget();
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId: "transition-task", input: actionInput({ provenance: "FORGELOOP_EXECUTED" }) });

    // Invalid transition fails closed.
    await assert.rejects(
      transitionAction(target, { packageRoot, taskId: "transition-task", actionId: action.actionId, to: "COMMITTED", details: {} }),
      (error) => error.code === "E_ACTION_STATE_MISMATCH",
    );

    const started = await transitionAction(target, {
      packageRoot,
      taskId: "transition-task",
      actionId: action.actionId,
      to: "AUTHORIZED",
      details: {},
    });
    assert.equal(started.state, "AUTHORIZED");

    await assert.rejects(
      transitionAction(target, {
        packageRoot,
        taskId: "transition-task",
        actionId: action.actionId,
        to: "STARTED",
        expectedRevision: 0,
      }),
      (error) => error.code === "E_ACTION_REVISION_CONFLICT" || error.code === "E_ACTION_STATE_MISMATCH",
    );

    const running = await transitionAction(target, {
      packageRoot,
      taskId: "transition-task",
      actionId: action.actionId,
      to: "STARTED",
      details: {},
    });
    assert.equal(running.revision, 2);

    const unknown = await transitionAction(target, {
      packageRoot,
      taskId: "transition-task",
      actionId: action.actionId,
      to: "COMMIT_UNKNOWN",
      details: { reason: "process lost after launch" },
    });
    assert.equal(unknown.state, "COMMIT_UNKNOWN");

    const reconciled = await transitionAction(target, {
      packageRoot,
      taskId: "transition-task",
      actionId: action.actionId,
      to: "COMMITTED",
      details: { reconciliationOutcome: "COMMITTED" },
    });
    assert.equal(reconciled.state, "COMMITTED");

    const events = await readEvents(target, packageRoot, { taskId: "transition-task" });
    const kinds = events.map((event) => event.event);
    for (const expected of ["ACTION_AUTHORIZED", "ACTION_STARTED", "ACTION_COMMIT_UNKNOWN", "ACTION_COMMIT_RECORDED"]) {
      assert.ok(kinds.includes(expected), `${expected} present in ledger`);
    }
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("listActions and findActionByIdempotencyKey project canonical artifacts", async () => {
  const target = await makeTarget();
  try {
    await proposeAction(target, { packageRoot, taskId: "list-task", input: actionInput() });
    await proposeAction(target, {
      packageRoot,
      taskId: "list-task",
      input: actionInput({ actionId: "action-second", idempotencyKey: "task-x:push:second:v1" }),
    });

    const all = await listActions(target, { packageRoot, taskId: "list-task" });
    assert.equal(all.length, 2);

    const found = await findActionByIdempotencyKey(target, { packageRoot, taskId: "list-task", idempotencyKey: "task-x:push:second:v1" });
    assert.equal(found?.actionId, "action-second");

    const missing = await findActionByIdempotencyKey(target, { packageRoot, taskId: "list-task", idempotencyKey: "nope" });
    assert.equal(missing, null);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("a crash between artifact staging and commit cannot expose an action without its event pairing", async () => {
  const target = await makeTarget();
  try {
    // Simulate a torn write: the action artifact exists but no ACTION_PROPOSED
    // event was committed. Detection must report the divergence.
    const { action } = await proposeAction(target, { packageRoot, taskId: "crash-task", input: actionInput() });
    const artifactPath = path.join(target, taskActionPath("crash-task", action.actionId));
    await stat(artifactPath);

    // Remove the ledger entirely to simulate loss of the event record.
    const events = await readEvents(target, packageRoot, { taskId: "crash-task" });
    assert.ok(events.length >= 1);

    const { detectOrphanActions } = await import("../src/core/actions.js");
    const orphans = await detectOrphanActions(target, { packageRoot, taskId: "crash-task" });
    assert.deepEqual(orphans, [], "healthy task has no orphan actions");

    const fs = await import("node:fs/promises");
    await fs.rm(path.join(target, ".forgeloop/task-state"), { recursive: true, force: false }).catch(() => {});
    // Recreate only the action file without its ledger.
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, JSON.stringify(action));
    const orphaned = await detectOrphanActions(target, { packageRoot, taskId: "crash-task" });
    assert.deepEqual(orphaned, [action.actionId]);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
