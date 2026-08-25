import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { createEvidence } from "../src/core/evidence.js";
import { proposeAction, transitionAction } from "../src/core/actions.js";
import { buildTrajectoryMetrics } from "../src/core/trajectory-metrics.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-trajectory-metrics-"));
  try {
    await run(target);
  } finally {
    await removeTempTree(target);
  }
}

async function seedTask(target, taskId = "task-metrics") {
  const fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const state = createWorkState({
    taskId,
    contractFingerprint: fingerprint,
    routeFingerprint: fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "COMPLETE",
    completedSteps: ["contract", "route", "implementation", "verification"],
    pendingSteps: [],
    verificationCycle: 2,
    checks: [{ id: "tests", requirement: "tests", status: "passed", evidenceKind: "OBSERVED" }],
    verificationEvidence: [createEvidence({ kind: "OBSERVED", source: "tests", result: "passed" })],
  });
  await writeWorkState(target, state, { packageRoot, taskId });
  for (const entry of [
    ["TASK_RECEIVED"],
    ["CONTRACT_VALIDATED"],
    ["ROUTE_VALIDATED"],
    ["EXECUTION_STARTED"],
    ["VERIFICATION_STARTED", { verificationCycle: 1 }],
    ["VERIFICATION_RECORDED", { id: "tests", requirement: "tests", status: "passed", exitCode: 0, verificationCycle: 1 }],
    ["VERIFICATION_STARTED", { verificationCycle: 2 }],
    ["VERIFICATION_RECORDED", { id: "tests", requirement: "tests", status: "passed", exitCode: 0, verificationCycle: 2 }],
    ["COMPLETION_VALIDATED"],
  ]) {
    await appendProtocolEvent(target, {
      taskId,
      event: entry[0],
      ...(entry[1] ? { details: entry[1] } : {}),
    }, packageRoot, { taskId });
  }
}

test("trajectory metrics are deterministic canonical projections and preserve unknown usage", async () => {
  await withTarget(async (target) => {
    await seedTask(target);
    await proposeAction(target, {
      packageRoot,
      taskId: "task-metrics",
      input: {
        actionId: "action-metrics",
        effectClass: "EXTERNAL_PUBLICATION",
        capability: "repository.push",
        operation: "push release",
        target: "origin/release",
        idempotencyKey: "task-metrics:push:v1",
        requiredForCompletion: true,
        requirement: "publication",
        provenance: "HOST_REPORTED",
      },
    });
    await transitionAction(target, {
      packageRoot,
      taskId: "task-metrics",
      actionId: "action-metrics",
      to: "AUTHORIZED",
    });
    await transitionAction(target, {
      packageRoot,
      taskId: "task-metrics",
      actionId: "action-metrics",
      to: "STARTED",
    });
    await transitionAction(target, {
      packageRoot,
      taskId: "task-metrics",
      actionId: "action-metrics",
      to: "COMMIT_UNKNOWN",
    });
    const { reconcileAction } = await import("../src/core/action-reconciliation.js");
    await reconcileAction({
      target,
      packageRoot,
      taskId: "task-metrics",
      actionId: "action-metrics",
      outcome: "UNKNOWN",
      evidenceRefs: ["observation-unknown"],
      provenance: "EXTERNAL_OBSERVED",
    });
    const first = await buildTrajectoryMetrics({ target, packageRoot, taskId: "task-metrics" });
    const second = await buildTrajectoryMetrics({ target, packageRoot, taskId: "task-metrics" });

    assert.deepEqual({ ...first, timing: { ...first.timing, firstEventAt: null, lastEventAt: null } },
      { ...second, timing: { ...second.timing, firstEventAt: null, lastEventAt: null } });
    assert.equal(first.trajectory.verificationCycles, 2);
    assert.equal(first.actions.total, 1);
    assert.equal(first.actions.ambiguous, 1);
    assert.equal(first.actions.reconciliations, 1);
    assert.equal(first.usage.tokens, null);
    assert.equal(first.usage.costUsd, null);
    assert.equal(first.usage.source, "UNKNOWN");
    assert.equal(first.comparableSteps, 5);
  });
});
