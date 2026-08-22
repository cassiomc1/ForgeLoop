import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runTaskRecover, formatTaskRecoverResult } from "../src/commands/task-recover.js";
import { discoverTasks } from "../src/core/task-discovery.js";
import { readEvents } from "../src/core/events.js";
import { readWorkState, classifyLoadedWorkState } from "../src/core/work-state.js";
import { taskArtifactPath } from "../src/core/task-paths.js";
import { runPreflight } from "../src/commands/preflight.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { advanceWorkState } from "../src/core/phase.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../src/core/task-descriptor.js";

const packageRoot = getPackageRoot();
const STALE_HEAD = "d6b8991dd0da318543a17d0d1c537687567992d1";

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-task-recover-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function setupDeadlockedTask(target, { taskId = "deadlocked-task" } = {}) {
  await writeTaskDescriptor(target, createTaskDescriptor({
    taskId,
    writeClaims: ["tests"],
  }), packageRoot);
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
  await appendProtocolEvent(target, { taskId, event: "TASK_RECEIVED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "ROUTE_VALIDATED" }, packageRoot, { taskId });
  const preflight = await runPreflight({ target, packageRoot, taskId });
  assert.equal(preflight.status, "READY");
  await appendProtocolEvent(target, { taskId, event: "PLAN_RECORDED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "EXECUTION_STARTED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "VERIFICATION_STARTED", details: { verificationCycle: 1 } }, packageRoot, { taskId });
  return { taskId };
}

test("task-recover requires explicit operator authorization", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupDeadlockedTask(target);
    await assert.rejects(
      () => runTaskRecover({ target, packageRoot, taskId }),
      (error) => error.code === "E_TASK_RECOVERY_AUTHORIZATION_REQUIRED",
    );
  });
});

test("task-recover releases claims of a deadlocked task without fabricating completion", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupDeadlockedTask(target);

    const before = await discoverTasks(target, packageRoot);
    const beforeTask = before.find((task) => task.taskId === taskId);
    assert.deepEqual(beforeTask.writeClaims, ["tests"]);

    const result = await runTaskRecover({ target, packageRoot, taskId, operatorAuthorized: true });
    assert.equal(result.recovered, true);
    assert.equal(result.claimsReleased, true);
    assert.deepEqual(result.releasedClaims, ["tests"]);
    assert.match(formatTaskRecoverResult(result), /operator authorization/);

    const events = await readEvents(target, packageRoot, { taskId });
    const recovery = events.filter((event) => event.event === "OPERATOR_RECOVERY_RECORDED");
    assert.equal(recovery.length, 1);
    assert.equal(recovery[0].details.authorization, "OPERATOR_AUTHORIZED");
    assert.equal(recovery[0].details.previousPhase, "VERIFYING");

    const state = await readWorkState(target, { packageRoot, taskId });
    assert.notEqual(state.phase, "COMPLETE");
    assert.notDeepEqual(state.repositoryFingerprint, { branch: "main", head: STALE_HEAD });
    const freshness = await classifyLoadedWorkState({ target, state, contractFile: taskArtifactPath(taskId, "contract") });
    assert.equal(freshness.status, "FRESH");

    const after = await discoverTasks(target, packageRoot);
    const afterTask = after.find((task) => task.taskId === taskId);
    assert.deepEqual(afterTask.writeClaims, []);
    assert.ok(afterTask.operatorRecoveredAt);
  });
});

test("task-recover refuses a fresh ACTIVE task", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupDeadlockedTask(target);
    const state = await readWorkState(target, { packageRoot, taskId });
    const currentHead = (await import("../src/core/repository.js")).currentRepositoryFingerprint;
    const repository = await currentHead(target);
    await writeWorkState(target, createWorkState({
      ...state,
      repositoryFingerprint: repository,
    }), { packageRoot, taskId });

    await assert.rejects(
      () => runTaskRecover({ target, packageRoot, taskId, operatorAuthorized: true }),
      (error) => error.code === "E_TASK_RECOVERY_UNSAFE",
    );
  });
});
