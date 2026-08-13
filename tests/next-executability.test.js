import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runComplete } from "../src/commands/complete.js";
import { runPreflight } from "../src/commands/preflight.js";
import { prepareCompletion, recordCheck } from "../src/core/completion-artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { NEXT_ACTIONS, getNextAction } from "../src/core/next-action.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-executability-"));
  try {
    await run(target);
  } finally {
    await rm(target, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
}

test("every lifecycle action recommended by next is executable and makes progress (P2-13)", async () => {
  await withTarget(async (target) => {
    // 1. Initial state: contract created, ready to route
    const contract = createContract({
      taskId: "task-executability",
      objective: "Verify next command executability across lifecycle",
      deliverables: ["src/app.js"],
      constraints: ["offline"],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests"],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    });
    const contractHash = contractFingerprint(contract);
    await writeContract(target, contract, packageRoot);

    const route = evaluateRoute({ workType: "code", surfaces: ["config"], platforms: [] });
    const persistedRoute = await persistRoute(target, route, packageRoot, {
      contractFingerprint: contractHash,
    });

    const state = createWorkState({
      taskId: contract.taskId,
      contractFingerprint: contractHash,
      routeFingerprint: persistedRoute.fingerprint,
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      selectedGuides: [...persistedRoute.value.guides],
      requiredGates: [],
      satisfiedGates: [],
      completedSteps: ["planning"],
      pendingSteps: ["execute"],
      requiredArtifacts: [],
      checks: [],
      failures: [],
      blockers: [],
      verificationEvidence: [],
    });
    await writeWorkState(target, state, { packageRoot });
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);

    // In PLANNED: next recommends START_EXECUTION or RUN_PREFLIGHT
    let preflight = await runPreflight({ target, packageRoot });
    assert.equal(preflight.status, "READY");

    let next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.START_EXECUTION);
    assert.ok(next.commands.length > 0);

    // Execute recommended advance to EXECUTING
    await advanceWorkState(target, "EXECUTING", { packageRoot });

    // In EXECUTING: next recommends ENTER_VERIFYING
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_VERIFYING);
    assert.ok(next.commands.length > 0);

    // Execute recommended advance to VERIFYING
    await advanceWorkState(target, "VERIFYING", { packageRoot });

    // In VERIFYING without receipt: next recommends PREPARE_COMPLETION
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.PREPARE_COMPLETION);
    assert.ok(next.commands.length > 0);

    // Execute prepare completion
    await prepareCompletion({ target, packageRoot });

    // In VERIFYING with receipt but unverified: next recommends RECORD_VERIFICATION
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.RECORD_VERIFICATION);
    assert.ok(next.commands.length > 0);

    // Record check
    await recordCheck({
      target,
      packageRoot,
      id: "unit-tests",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Passed",
    });

    // With all evidence covered: next recommends ENTER_REVIEWING
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
    assert.ok(next.commands.length > 0);

    // Execute advance to REVIEWING
    await advanceWorkState(target, "REVIEWING", { packageRoot });

    // In REVIEWING with valid evidence: next recommends RUN_COMPLETE
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.RUN_COMPLETE);
    assert.ok(next.commands.length > 0);

    // Execute runComplete
    const completion = await runComplete({ target, packageRoot });
    assert.equal(completion.status, "VALID");

    // In COMPLETE: next reports NONE
    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.NONE);
  });
});
