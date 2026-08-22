import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runPreflight } from "../../src/commands/preflight.js";
import { createContract, contractFingerprint, writeContract } from "../../src/core/contract.js";
import { appendProtocolEvent } from "../../src/core/events.js";
import { evaluateRoute } from "../../src/core/router.js";
import { persistRoute } from "../../src/core/route-artifact.js";
import { getPackageRoot } from "../../src/core/templates.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../../src/core/task-descriptor.js";
import { createWorkState, readWorkState, writeWorkState } from "../../src/core/work-state.js";

export const packageRoot = getPackageRoot();
export const STALE_HEAD = "d6b8991dd0da318543a17d0d1c537687567992d1";
export const ABANDONED_AT = new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)).toISOString();

export async function withRecoveryTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-task-recovery-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

export async function setupAbandonedTask(target, {
  taskId = "deadlocked-task",
  writeClaims = ["tests"],
} = {}) {
  await writeTaskDescriptor(target, createTaskDescriptor({ taskId, writeClaims }), packageRoot);
  const contract = createContract({
    taskId,
    objective: "Recovery fixture objective.",
    deliverables: ["package.json"],
    constraints: [],
    risks: [],
    verification: [
      { id: "regression-tests", text: "fixture verification passes", type: "VERIFICATION" },
    ],
    successCriteria: ["objective is present in the current repository"],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const contractHash = contractFingerprint(contract);
  await writeContract(target, contract, packageRoot, { taskId });
  const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractHash, taskId });
  await writeWorkState(target, createWorkState({
    taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: "main", head: STALE_HEAD },
    phase: "VERIFYING",
    previousPhase: "EXECUTING",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["implementation"],
    pendingSteps: ["verification"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  }), { packageRoot, taskId });
  await appendProtocolEvent(target, { taskId, event: "TASK_RECEIVED", at: ABANDONED_AT }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED", at: ABANDONED_AT }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "ROUTE_VALIDATED", at: ABANDONED_AT }, packageRoot, { taskId });
  const preflight = await runPreflight({ target, packageRoot, taskId });
  assert.equal(preflight.status, "READY");
  await appendProtocolEvent(target, { taskId, event: "PLAN_RECORDED", at: ABANDONED_AT }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "EXECUTION_STARTED", at: ABANDONED_AT }, packageRoot, { taskId });
  await appendProtocolEvent(target, {
    taskId,
    event: "VERIFICATION_STARTED",
    at: ABANDONED_AT,
    details: { verificationCycle: 1 },
  }, packageRoot, { taskId });

  const prepared = await readWorkState(target, { packageRoot, taskId });
  await writeWorkState(target, createWorkState({
    ...prepared,
    contractFingerprint: "0".repeat(64),
    repositoryFingerprint: { branch: "main", head: STALE_HEAD },
    lastUpdated: ABANDONED_AT,
  }), { packageRoot, taskId });
  return { taskId, contractHash };
}

export async function setupRecoverableTask(target, options = {}) {
  const fixture = await setupAbandonedTask(target, options);
  const state = await readWorkState(target, { packageRoot, taskId: fixture.taskId });
  await writeWorkState(target, createWorkState({
    ...state,
    contractFingerprint: fixture.contractHash,
    repositoryFingerprint: { branch: "main", head: STALE_HEAD },
    lastUpdated: new Date().toISOString(),
  }), { packageRoot, taskId: fixture.taskId });
  return fixture;
}
