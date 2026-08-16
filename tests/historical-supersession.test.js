import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { removeTempTree } from "./helpers/rm-safe.js";
import { runPreflight } from "../src/commands/preflight.js";
import { prepareCompletion, recordCheck as recordCheckArtifact } from "../src/core/completion-artifacts.js";
import { recordManualCheck } from "./helpers/record-check-compat.js";

const recordCheck = (input) => recordManualCheck(recordCheckArtifact, input);
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { NEXT_ACTIONS, getNextAction } from "../src/core/next-action.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";
import { evaluateRequiredEvidence, authoritativeChecksForRequirements } from "../src/core/evidence-readiness.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-supersession-"));
  try {
    await run(target);
  } finally {
    await removeTempTree(target);
  }
}

async function setupTarget(target, { verification = ["tests"], successCriteria = ["tests"] } = {}) {
  const contract = createContract({
    taskId: "task-supersession",
    objective: "Exercise historical check supersession in next and evidence readiness",
    deliverables: ["src/app.js"],
    constraints: ["offline"],
    risks: [],
    verification,
    successCriteria,
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

  const preflight = await runPreflight({ target, packageRoot });
  assert.equal(preflight.status, "READY");

  await advanceWorkState(target, "EXECUTING", { packageRoot });
  await advanceWorkState(target, "VERIFYING", { packageRoot });
  await prepareCompletion({ target, packageRoot });
}

test("Test A & D: Historical Fail in cycle 1 -> New Pass in cycle 2 with same ID results in ENTER_REVIEWING (P0-2)", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);

    // Cycle 1: record failed check
    await recordCheck({
      target,
      packageRoot,
      id: "unit-tests",
      requirement: "tests",
      status: "failed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "1 test failed",
    });

    let next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.DIAGNOSE);

    // Enter DIAGNOSING -> CORRECTING -> VERIFYING (cycle 2)
    await advanceWorkState(target, "DIAGNOSING", { packageRoot });
    let state = await readWorkState(target, packageRoot);
    state.diagnosedHypothesis = "Fixed bug in math logic";
    await writeWorkState(target, state, { packageRoot });

    await advanceWorkState(target, "CORRECTING", { packageRoot });
    await advanceWorkState(target, "VERIFYING", { packageRoot });

    state = await readWorkState(target, packageRoot);
    assert.equal(state.verificationCycle, 2);

    // Cycle 2: record passing check with same ID
    await recordCheck({
      target,
      packageRoot,
      id: "unit-tests",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "All tests passed",
    });

    next = await getNextAction(target, packageRoot);
    assert.notEqual(next.nextAction, NEXT_ACTIONS.DIAGNOSE);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
  });
});

test("Test E: Historical Fail in cycle 1 -> New Pass in cycle 2 with DIFFERENT check ID results in ENTER_REVIEWING (P0-2)", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);

    // Cycle 1: record failed check with ID tests-old
    await recordCheck({
      target,
      packageRoot,
      id: "tests-old",
      requirement: "tests",
      status: "failed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "1 test failed",
    });

    let next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.DIAGNOSE);

    // Advance to DIAGNOSING -> CORRECTING -> VERIFYING (cycle 2)
    await advanceWorkState(target, "DIAGNOSING", { packageRoot });
    let state = await readWorkState(target, packageRoot);
    state.diagnosedHypothesis = "Resolved failure";
    await writeWorkState(target, state, { packageRoot });

    await advanceWorkState(target, "CORRECTING", { packageRoot });
    await advanceWorkState(target, "VERIFYING", { packageRoot });

    // Cycle 2: record passing check with ID tests-new for same requirement
    await recordCheck({
      target,
      packageRoot,
      id: "tests-new",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "All tests passed",
    });

    // Verify historical check is still persisted
    state = await readWorkState(target, packageRoot);
    assert.equal(state.checks.length, 2);
    assert.ok(state.checks.some((c) => c.id === "tests-old" && c.status === "failed"));
    assert.ok(state.checks.some((c) => c.id === "tests-new" && c.status === "passed"));

    // Next action must evaluate authoritative check and recommend ENTER_REVIEWING
    next = await getNextAction(target, packageRoot);
    assert.notEqual(next.nextAction, NEXT_ACTIONS.DIAGNOSE);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
  });
});

test("Test B: Historical Blocked in cycle 1 -> New Pass in cycle 2 results in ENTER_REVIEWING (P0-2)", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);

    // Cycle 1: record blocked check
    await recordCheck({
      target,
      packageRoot,
      id: "browser-check-c1",
      requirement: "tests",
      status: "blocked",
      evidenceKind: "BLOCKED",
      command: "npm test",
      result: "Environment locked",
    });

    let next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);

    // Advance through correction cycle
    await advanceWorkState(target, "DIAGNOSING", { packageRoot });
    let state = await readWorkState(target, packageRoot);
    state.diagnosedHypothesis = "Unlocked test harness";
    await writeWorkState(target, state, { packageRoot });

    await advanceWorkState(target, "CORRECTING", { packageRoot });
    await advanceWorkState(target, "VERIFYING", { packageRoot });

    // Cycle 2: record passing check
    await recordCheck({
      target,
      packageRoot,
      id: "browser-check-c2",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Tests passed in browser",
    });

    next = await getNextAction(target, packageRoot);
    assert.notEqual(next.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
  });
});

test("Test C: Historical Pass in cycle 1 -> New Fail in cycle 2 results in DIAGNOSE (P0-2)", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);

    // Cycle 1: record passed check
    await recordCheck({
      target,
      packageRoot,
      id: "test-c1",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Passed",
    });

    let next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);

    // Advance to cycle 2 through correction transition
    await advanceWorkState(target, "DIAGNOSING", { packageRoot });
    let state = await readWorkState(target, packageRoot);
    state.diagnosedHypothesis = "Investigating regression";
    await writeWorkState(target, state, { packageRoot });

    await advanceWorkState(target, "CORRECTING", { packageRoot });
    await advanceWorkState(target, "VERIFYING", { packageRoot });

    await recordCheck({
      target,
      packageRoot,
      id: "test-c2",
      requirement: "tests",
      status: "failed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Failed on regression",
    });

    next = await getNextAction(target, packageRoot);
    assert.equal(next.nextAction, NEXT_ACTIONS.DIAGNOSE);
  });
});
