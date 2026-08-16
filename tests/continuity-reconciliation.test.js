import assert from "node:assert/strict";
import { test } from "node:test";

import { canonicalFingerprint } from "../src/core/artifacts.js";

function state(overrides = {}) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "task-1",
    contractFingerprint: "b".repeat(64),
    repositoryFingerprint: { branch: "main", head: "old" },
    phase: "EXECUTING",
    selectedGuides: [],
    completedSteps: ["planning"],
    pendingSteps: ["implementation", "verification"],
    requiredArtifacts: [],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
    lastUpdated: "2026-08-16T16:00:00.000Z",
    ...overrides,
  };
}

function continuity(currentState, overrides = {}) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: currentState.taskId,
    workStateFingerprint: canonicalFingerprint(currentState),
    contractFingerprint: currentState.contractFingerprint,
    phase: currentState.phase,
    repositoryFingerprint: { branch: "main", head: "abc" },
    updatedAt: "2026-08-16T17:00:00.000Z",
    remainingWork: [{ id: "contact", summary: "Finish contact form" }],
    knownIssues: [],
    changedAreas: ["src/components"],
    inspectFirst: ["src/components/Header.jsx"],
    ...overrides,
  };
}

test("missing continuity is ABSENT", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const result = classifyContinuity({ continuity: null, state: state() });
  assert.equal(result.classification, "ABSENT");
  assert.deepEqual(result.reasons, ["CONTINUITY_ABSENT"]);
});

test("matching bindings classify continuity as FRESH", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const currentState = state();
  const value = continuity(currentState);
  const result = classifyContinuity({
    continuity: value,
    state: currentState,
    contractFingerprint: currentState.contractFingerprint,
    repositoryFingerprint: { branch: "main", head: "abc" },
    changedPaths: ["src/components/Header.jsx"],
  });
  assert.equal(result.classification, "FRESH");
  assert.equal(result.taskMatches, true);
  assert.equal(result.workStateMatches, true);
  assert.equal(result.contractMatches, true);
  assert.equal(result.phaseMatches, true);
  assert.equal(result.repositoryComparison, "MATCH");
  assert.equal(result.changedPathComparison, "MATCH");
  assert.deepEqual(result.reasons, []);
});

test("work-state or repository drift requires reconciliation without corrupting task identity", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const oldState = state();
  const value = continuity(oldState);
  const currentState = state({ completedSteps: ["planning", "header"], lastUpdated: "2026-08-16T17:10:00.000Z" });
  const result = classifyContinuity({
    continuity: value,
    state: currentState,
    contractFingerprint: currentState.contractFingerprint,
    repositoryFingerprint: { branch: "main", head: "def" },
    changedPaths: ["src/components/Header.jsx"],
  });
  assert.equal(result.classification, "RECONCILIATION_REQUIRED");
  assert.equal(result.taskMatches, true);
  assert.equal(result.workStateMatches, false);
  assert.equal(result.repositoryComparison, "MISMATCH");
  assert.deepEqual(result.reasonCodes, [
    "E_CONTINUITY_RECONCILIATION_REQUIRED",
  ]);
  assert.deepEqual(result.reasons, ["CONTINUITY_REPOSITORY_CHANGED", "CONTINUITY_WORK_STATE_CHANGED"]);
});

test("task or contract mismatch is INCONSISTENT", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const currentState = state();
  const wrongTask = classifyContinuity({
    continuity: continuity(currentState, { taskId: "other-task" }),
    state: currentState,
    contractFingerprint: currentState.contractFingerprint,
  });
  assert.equal(wrongTask.classification, "INCONSISTENT");
  assert.ok(wrongTask.reasonCodes.includes("E_CONTINUITY_TASK_MISMATCH"));

  const wrongContract = classifyContinuity({
    continuity: continuity(currentState, { contractFingerprint: "c".repeat(64) }),
    state: currentState,
    contractFingerprint: currentState.contractFingerprint,
  });
  assert.equal(wrongContract.classification, "INCONSISTENT");
  assert.ok(wrongContract.reasonCodes.includes("E_CONTINUITY_CONTRACT_MISMATCH"));
});

test("legal phase drift is reconcilable but impossible backward drift is inconsistent", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const executing = state();
  const saved = continuity(executing);
  const verifying = state({ phase: "VERIFYING" });
  const forward = classifyContinuity({
    continuity: saved,
    state: verifying,
    contractFingerprint: verifying.contractFingerprint,
  });
  assert.equal(forward.classification, "RECONCILIATION_REQUIRED");
  assert.ok(forward.reasons.includes("CONTINUITY_PHASE_CHANGED"));

  const savedReview = continuity(state({ phase: "REVIEWING" }));
  const currentExecution = state({ phase: "EXECUTING" });
  const backward = classifyContinuity({
    continuity: savedReview,
    state: currentExecution,
    contractFingerprint: currentExecution.contractFingerprint,
  });
  assert.equal(backward.classification, "INCONSISTENT");
  assert.ok(backward.reasonCodes.includes("E_CONTINUITY_PHASE_MISMATCH"));
});

test("COMPLETE makes continuity NOT_APPLICABLE", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const executing = state();
  const result = classifyContinuity({
    continuity: continuity(executing),
    state: state({ phase: "COMPLETE" }),
    contractFingerprint: executing.contractFingerprint,
  });
  assert.equal(result.classification, "NOT_APPLICABLE");
});

test("non-Git targets remain valid with repository comparison NOT_VERIFIED", async () => {
  const { classifyContinuity } = await import("../src/core/continuity-reconciliation.js");
  const currentState = state();
  const value = continuity(currentState, { repositoryFingerprint: { branch: null, head: null } });
  const result = classifyContinuity({
    continuity: value,
    state: currentState,
    contractFingerprint: currentState.contractFingerprint,
    repositoryFingerprint: { branch: null, head: null },
    changedPaths: null,
  });
  assert.equal(result.classification, "FRESH");
  assert.equal(result.repositoryComparison, "NOT_VERIFIED");
  assert.equal(result.changedPathComparison, "NOT_VERIFIED");
});
