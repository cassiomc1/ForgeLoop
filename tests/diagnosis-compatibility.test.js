import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import { PROTOCOL_VERSION } from "../src/core/protocol.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { recordDiagnosis } from "../src/core/diagnosis.js";
import { recordDecisionCriterion } from "../src/core/settlement.js";
import { getNextAction } from "../src/core/next-action.js";
import { runPreflight } from "../src/commands/preflight.js";
import { prepareCompletion, recordCheck as recordCheckArtifact } from "../src/core/completion-artifacts.js";
import { recordManualCheck } from "./helpers/record-check-compat.js";

const recordCheck = (input) => recordManualCheck(recordCheckArtifact, input);
const packageRoot = getPackageRoot();

test("protocol compatibility - protocolVersion remains 1", () => {
  assert.equal(PROTOCOL_VERSION, 1);
});

test("protocol compatibility - contract unresolvedDecisions remains array of strings", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-compat-test-"));
  try {
    const taskId = "task-compat-1";
    const unresolved = ["Which caching provider to use?", "Should we support HTTP/2?"];

    const contract = createContract({
      taskId,
      objective: "Test unresolvedDecisions array of strings schema compatibility",
      deliverables: ["src/index.js"],
      constraints: [],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: [],
      unresolvedDecisions: unresolved,
      sourceRefs: [],
    });

    assert.equal(contract.schemaVersion, 1);
    assert.equal(contract.protocolVersion, 1);
    assert.ok(Array.isArray(contract.unresolvedDecisions));
    assert.ok(contract.unresolvedDecisions.every((d) => typeof d === "string"));

    await writeContract(target, contract, packageRoot, { taskId });

    await appendProtocolEvent(target, { taskId, event: "TASK_RECEIVED" }, packageRoot);
    await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot);

    // Record decision settlement criterion
    const res = await recordDecisionCriterion({
      target,
      packageRoot,
      decision: "Which caching provider to use?",
      settledBy: "Use in-memory cache for local dev",
      taskId,
    });

    assert.equal(res.event.protocolVersion, 1);
    assert.equal(res.event.schemaVersion, 1);

    // Next action surfaces settlement criterion in reasons resolution without modifying contract schema
    const next = await getNextAction({ target, packageRoot });
    const decisionReason = next.reasons.find((r) => r.code === "E_CONTRACT_UNRESOLVED_DECISION" || r.code === "E_UNRESOLVED_DECISION");
    if (decisionReason) {
      assert.equal(decisionReason.resolution?.kind, "SETTLEMENT_CRITERION");
      assert.equal(decisionReason.resolution?.settledBy, "Use in-memory cache for local dev");
    }

  } finally {
    await removeTempTree(target);
  }
});

test("protocol compatibility - work-state.diagnosedHypothesis is maintained as projection", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-compat-diag-"));
  try {
    const taskId = "task-compat-diag";
    const contract = createContract({
      taskId,
      objective: "Test diagnosis ledger compatibility",
      deliverables: ["src/index.js"],
      constraints: [],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests pass"],
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
      taskId,
      contractFingerprint: contractHash,
      routeFingerprint: persistedRoute.fingerprint,
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      selectedGuides: [...persistedRoute.value.guides],
      requiredGates: [],
      satisfiedGates: [],
      completedSteps: ["planning"],
      pendingSteps: ["execute"],
      checks: [],
      failures: [],
      blockers: [],
      verificationEvidence: [],
    });
    await writeWorkState(target, state, { packageRoot });

    await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId, event: "ROUTE_VALIDATED" }, packageRoot);
    await runPreflight({ target, packageRoot });
    await advanceWorkState(target, "EXECUTING", packageRoot);
    await advanceWorkState(target, "VERIFYING", packageRoot);
    await prepareCompletion({ target, packageRoot });

    await recordCheck({
      target,
      packageRoot,
      id: "check-failing",
      requirement: "tests",
      status: "failed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Assertion failed",
    });

    await advanceWorkState(target, "DIAGNOSING", packageRoot);

    // Record diagnosis
    const diagRes = await recordDiagnosis({
      target,
      packageRoot,
      hypothesis: "Off-by-one index calculation in array slicer",
      failureClass: "VERIFICATION_FAILURE",
      evidenceRefs: ["check-failing"],
      settledBy: "Test returns expected slice",
      nextSafeAction: "Adjust index offset by +1",
    });
    assert.equal(diagRes.event.protocolVersion, 1);

    // Work state projection must be populated
    const updatedState = await readWorkState(target, { packageRoot });
    assert.equal(updatedState.diagnosedHypothesis, "Off-by-one index calculation in array slicer");

    // Events ledger contains DIAGNOSIS_RECORDED with valid hash chain
    const ledger = await validateEventLedger(target, packageRoot);
    assert.equal(ledger.valid, true);

    const diagEvents = ledger.events.filter((e) => e.event === "DIAGNOSIS_RECORDED");
    assert.equal(diagEvents.length, 1);
    assert.equal(diagEvents[0].details.informationGain, "FIRST_DIAGNOSIS");

    // Advance to CORRECTING is permitted
    await advanceWorkState(target, "CORRECTING", packageRoot);
    const correctingState = await readWorkState(target, { packageRoot });
    assert.equal(correctingState.phase, "CORRECTING");

  } finally {
    await removeTempTree(target);
  }
});

test("protocol compatibility - legacy DIAGNOSING state with only mutable diagnosedHypothesis is readable but requires RECORD_DIAGNOSIS", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-compat-legacy-"));
  try {
    const taskId = "task-compat-legacy";
    const contract = createContract({
      taskId,
      objective: "Test legacy task upgrade",
      deliverables: ["src/index.js"],
      constraints: [],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests pass"],
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
      taskId,
      contractFingerprint: contractHash,
      routeFingerprint: persistedRoute.fingerprint,
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      selectedGuides: [...persistedRoute.value.guides],
      requiredGates: [],
      satisfiedGates: [],
      completedSteps: ["planning"],
      pendingSteps: ["execute"],
      checks: [],
      failures: [],
      blockers: [],
      verificationEvidence: [],
    });
    await writeWorkState(target, state, { packageRoot });

    await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId, event: "ROUTE_VALIDATED" }, packageRoot);
    await runPreflight({ target, packageRoot });
    await advanceWorkState(target, "EXECUTING", packageRoot);
    await advanceWorkState(target, "VERIFYING", packageRoot);
    await prepareCompletion({ target, packageRoot });

    await recordCheck({
      target,
      packageRoot,
      id: "check-auth",
      requirement: "auth",
      status: "failed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Assertion failed",
    });

    await advanceWorkState(target, "DIAGNOSING", packageRoot);

    // Simulate old protocol-v1 task by injecting mutable diagnosedHypothesis without DIAGNOSIS_RECORDED event
    const legacyState = {
      ...(await readWorkState(target, { packageRoot })),
      diagnosedHypothesis: "Legacy mutable hypothesis from older version",
    };
    await writeWorkState(target, legacyState, { packageRoot });

    // Old task is readable
    const loadedState = await readWorkState(target, { packageRoot });
    assert.equal(loadedState.phase, "DIAGNOSING");
    assert.equal(loadedState.diagnosedHypothesis, "Legacy mutable hypothesis from older version");

    // forgeloop next returns RECORD_DIAGNOSIS because ledger has no DIAGNOSIS_RECORDED event
    const nextBefore = await getNextAction({ target, packageRoot });
    assert.equal(nextBefore.nextAction, "RECORD_DIAGNOSIS");

    // Attempting to advance to CORRECTING is blocked with E_DIAGNOSIS_REQUIRED
    await assert.rejects(
      () => advanceWorkState(target, "CORRECTING", packageRoot),
      { code: "E_DIAGNOSIS_REQUIRED" }
    );

    // Record diagnosis through the new append-only API
    const diagRes = await recordDiagnosis({
      target,
      packageRoot,
      hypothesis: "Updated authoritative hypothesis",
      failureClass: "VERIFICATION_FAILURE",
      evidenceRefs: ["check-auth"],
      settledBy: "Test passes",
      nextSafeAction: "Fix auth handler",
    });
    assert.equal(diagRes.event.event, "DIAGNOSIS_RECORDED");
    assert.equal(diagRes.diagnosis.informationGain, "FIRST_DIAGNOSIS");

    // forgeloop next now returns CORRECT
    const nextAfter = await getNextAction({ target, packageRoot });
    assert.equal(nextAfter.nextAction, "CORRECT");

    // advance to CORRECTING now succeeds
    await advanceWorkState(target, "CORRECTING", packageRoot);
    const finalState = await readWorkState(target, { packageRoot });
    assert.equal(finalState.phase, "CORRECTING");

  } finally {
    await removeTempTree(target);
  }
});
