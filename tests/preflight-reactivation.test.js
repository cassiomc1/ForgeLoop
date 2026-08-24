import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runPreflight } from "../src/commands/preflight.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState, readWorkState } from "../src/core/work-state.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../src/core/task-descriptor.js";

const packageRoot = getPackageRoot();

async function rimrafWithRetry(target) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = error?.code;
      const isTransient = code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY";
      if (!isTransient || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-preflight-reactivation-"));
  try {
    await run(target);
  } finally {
    await rimrafWithRetry(target);
  }
}

function buildContract(taskId, objective) {
  return createContract({
    taskId,
    objective,
    deliverables: ["package.json"],
    constraints: [],
    risks: [],
    verification: [{ id: "checks", text: "objective checks pass", type: "VERIFICATION" }],
    successCriteria: ["objective is present"],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
}

async function setupTaskThroughReady(target, { taskId = "reactivation-task", objective = "Original objective." } = {}) {
  const contract = buildContract(taskId, objective);
  const contractHash = contractFingerprint(contract);
  await writeTaskDescriptor(target, createTaskDescriptor({ taskId, writeClaims: ["package.json"] }), packageRoot);
  await writeContract(target, contract, packageRoot, { taskId });
  const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractHash, taskId });
  await writeWorkState(target, createWorkState({
    taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "ROUTED",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["contract", "route"],
    pendingSteps: ["planning", "implementation", "verification"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  }), { packageRoot, taskId });

  const preflight = await runPreflight({ target, packageRoot, taskId });
  assert.equal(preflight.status, "READY");

  const ledger = await validateEventLedger(target, packageRoot, { taskId });
  assert.equal(ledger.valid, true);
  return { taskId, contractHash };
}

test("preflight returns READY with fresh details after a BLOCKED outcome superseded the original READY", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupTaskThroughReady(target);

    // The contract evolves intentionally and the routing artifact is regenerated.
    const revised = buildContract(taskId, "Revised objective after scope clarification.");
    const revisedHash = contractFingerprint(revised);
    await writeContract(target, revised, packageRoot, { taskId });
    const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
    const revisedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: revisedHash, taskId });

    // A preflight cycle ran while the gate was unsatisfied and recorded BLOCKED;
    // the stale-bound checkpoint was cleared through the sanctioned maintenance
    // surface so the next preflight recreates it against the revised contract.
    await appendProtocolEvent(target, {
      taskId,
      event: "PREFLIGHT_BLOCKED",
      fingerprint: revisedHash,
      details: {
        requiredGates: ["threat-boundary"],
        satisfiedGates: [],
        routingFingerprint: revisedRoute.fingerprint,
      },
    }, packageRoot, { taskId });
    const { unlink } = await import("node:fs/promises");
    const { taskDirectory } = await import("../src/core/task-paths.js");
    await unlink(path.join(target, taskDirectory(taskId), "work-state.json"));

    // The gate is satisfied; preflight must be able to return READY again.
    const preflight = await runPreflight({ target, packageRoot, taskId });
    assert.equal(preflight.status, "READY");

    const state = await readWorkState(target, { packageRoot, taskId });
    assert.equal(state.contractFingerprint, revisedHash);

    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);
    const readyEvents = ledger.events.filter((event) => event.event === "PREFLIGHT_READY" && event.taskId === taskId);
    assert.equal(readyEvents.length, 2);
    assert.equal(readyEvents[1].fingerprint, revisedHash);

    // Re-running preflight after re-readiness stays READY and appends nothing new.
    const refreshed = await runPreflight({ target, packageRoot, taskId });
    assert.equal(refreshed.status, "READY");
    const ledgerAfterRefresh = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledgerAfterRefresh.events.filter((event) => event.event === "PREFLIGHT_READY" && event.taskId === taskId).length, 2);
  });
});

test("preflight derives the PLANNED resume phase from a recorded PLAN_RECORDED milestone", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupTaskThroughReady(target);
    await appendProtocolEvent(target, { taskId, event: "PLAN_RECORDED" }, packageRoot, { taskId });

    const { unlink } = await import("node:fs/promises");
    const { taskDirectory } = await import("../src/core/task-paths.js");
    await unlink(path.join(target, taskDirectory(taskId), "work-state.json"));

    const preflight = await runPreflight({ target, packageRoot, taskId });
    assert.equal(preflight.status, "READY");

    const restored = await readWorkState(target, { packageRoot, taskId });
    assert.equal(restored.phase, "PLANNED");

    // Advancing from the restored checkpoint appends EXECUTION_STARTED exactly once.
    await advanceWorkState(target, "EXECUTING", { packageRoot, taskId });
    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);
    assert.equal(ledger.events.filter((event) => event.event === "EXECUTION_STARTED" && event.taskId === taskId).length, 1);
  });
});

test("execution prerequisites bind to the latest PREFLIGHT_READY after re-readiness", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupTaskThroughReady(target);
    await appendProtocolEvent(target, { taskId, event: "PLAN_RECORDED" }, packageRoot, { taskId });

    // Contract evolves; a preflight cycle records BLOCKED before the gate is satisfied.
    const revised = buildContract(taskId, "Revised objective for execution-prerequisites binding.");
    const revisedHash = contractFingerprint(revised);
    await writeContract(target, revised, packageRoot, { taskId });
    const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
    const revisedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: revisedHash, taskId });
    await appendProtocolEvent(target, {
      taskId,
      event: "PREFLIGHT_BLOCKED",
      fingerprint: revisedHash,
      details: {
        requiredGates: ["threat-boundary"],
        satisfiedGates: [],
        routingFingerprint: revisedRoute.fingerprint,
      },
    }, packageRoot, { taskId });
    const { unlink } = await import("node:fs/promises");
    const { taskDirectory } = await import("../src/core/task-paths.js");
    await unlink(path.join(target, taskDirectory(taskId), "work-state.json"));

    const preflight = await runPreflight({ target, packageRoot, taskId });
    assert.equal(preflight.status, "READY");

    // Entering EXECUTING must validate against the latest READY event.
    const state = await advanceWorkState(target, "EXECUTING", { packageRoot, taskId });
    assert.equal(state.phase, "EXECUTING");
    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);
  });
});

test("preflight still refuses a READY refresh whose details differ without an intervening BLOCKED outcome", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupTaskThroughReady(target);

    const revised = buildContract(taskId, "Revised objective without a blocked preflight cycle.");
    await writeContract(target, revised, packageRoot, { taskId });
    const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
    await persistRoute(target, route, packageRoot, { contractFingerprint: contractFingerprint(revised), taskId });

    await assert.rejects(
      () => runPreflight({ target, packageRoot, taskId }),
      (error) => error.code === "E_PHASE_CHRONOLOGY_INVALID"
        || error.code === "E_CONTRACT_STALE"
        || error.code === "E_ROUTE_STALE",
    );
  });
});
