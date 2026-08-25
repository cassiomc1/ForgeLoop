import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { proposeAction, transitionAction, readAction } from "../src/core/actions.js";
import { validateEventLedger } from "../src/core/events.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

function actionInput(overrides = {}) {
  return {
    actionId: "action-publish",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "external.publish",
    target: "registry:pkg",
    operation: "publish package",
    idempotencyKey: "ledger:publish:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "HOST_REPORTED",
    ...overrides,
  };
}

test("action lifecycle events keep a valid hash-chained ledger", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-action-ledger-"));
  try {
    await proposeAction(target, { packageRoot, taskId: "chain-task", input: actionInput() });
    await transitionAction(target, { packageRoot, taskId: "chain-task", actionId: "action-publish", to: "AUTHORIZED", details: {} });
    await transitionAction(target, { packageRoot, taskId: "chain-task", actionId: "action-publish", to: "STARTED", details: {} });
    await transitionAction(target, { packageRoot, taskId: "chain-task", actionId: "action-publish", to: "COMMITTED", details: {} });
    await transitionAction(target, {
      packageRoot,
      taskId: "chain-task",
      actionId: "action-publish",
      to: "VERIFIED",
      details: { evidenceRef: "check-remote-ref" },
    });

    const result = await validateEventLedger(target, packageRoot, { taskId: "chain-task" });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("event detail validators reject malformed action event details", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-action-details-"));
  try {
    await proposeAction(target, { packageRoot, taskId: "details-task", input: actionInput() });

    // A malformed ACTION_STARTED event (missing actionId) must be rejected.
    const { appendProtocolEvent } = await import("../src/core/events.js");
    await assert.rejects(
      appendProtocolEvent(target, {
        taskId: "details-task",
        event: "ACTION_STARTED",
        details: { actionFingerprint: "a".repeat(64) },
      }, packageRoot),
      (error) => error.code === "E_EVENT_INVALID" || error.code === "E_ACTION_EVIDENCE_INVALID",
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("transition persists fingerprint binding and refuses foreign fingerprints", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-action-fp-"));
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId: "fp-task", input: actionInput() });

    await assert.rejects(
      transitionAction(target, {
        packageRoot,
        taskId: "fp-task",
        actionId: action.actionId,
        to: "AUTHORIZED",
        details: {},
        expectedFingerprint: "f".repeat(64),
      }),
      (error) => error.code === "E_ACTION_INVALID",
    );

    await transitionAction(target, {
      packageRoot,
      taskId: "fp-task",
      actionId: action.actionId,
      to: "AUTHORIZED",
      details: {},
      expectedFingerprint: action.actionFingerprint,
    });

    const stored = await readAction(target, { packageRoot, taskId: "fp-task", actionId: action.actionId });
    assert.equal(stored.state, "AUTHORIZED");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
