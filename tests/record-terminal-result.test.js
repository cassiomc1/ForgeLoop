import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runComplete } from "../src/commands/complete.js";
import { runPreflight } from "../src/commands/preflight.js";
import { runRecordTerminalResult } from "../src/commands/record-terminal-result.js";
import { prepareCompletion, recordCheck } from "../src/core/completion-artifacts.js";
import { ARTIFACT_PATHS, readJsonArtifact } from "../src/core/artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { NEXT_ACTIONS, getNextAction } from "../src/core/next-action.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";
import { isPublicationStatusSatisfied, evaluateTerminalRequirements } from "../src/core/evidence-readiness.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-terminal-result-"));
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

async function setupTarget(target, { verification = ["tests"], successCriteria = ["tests"] } = {}) {
  const contract = createContract({
    taskId: "task-terminal-record",
    objective: "Exercise record-terminal-result protocol command",
    deliverables: ["src/app.js"],
    constraints: ["offline"],
    risks: [],
    verification,
    successCriteria,
    stopConditions: ["verification unavailable"],
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
}

test("publication precision levels and satisfaction logic", () => {
  assert.equal(isPublicationStatusSatisfied("local-only", "published"), false);
  assert.equal(isPublicationStatusSatisfied("committed", "published"), false);
  assert.equal(isPublicationStatusSatisfied("pushed", "published"), false);
  assert.equal(isPublicationStatusSatisfied("published", "published"), true);
  assert.equal(isPublicationStatusSatisfied("deployed", "published"), true);

  assert.equal(isPublicationStatusSatisfied("local-only", "pushed"), false);
  assert.equal(isPublicationStatusSatisfied("committed", "pushed"), false);
  assert.equal(isPublicationStatusSatisfied("pushed", "pushed"), true);
  assert.equal(isPublicationStatusSatisfied("published", "pushed"), true);

  assert.equal(isPublicationStatusSatisfied("local-only", "committed"), false);
  assert.equal(isPublicationStatusSatisfied("committed", "committed"), true);
  assert.equal(isPublicationStatusSatisfied("pushed", "committed"), true);
});

test("recording PUBLICATION terminal result satisfies explicit publication requirement", async () => {
  await withTarget(async (target) => {
    await setupTarget(target, {
      verification: ["tests"],
      successCriteria: ["tests", "Package is published to npm registry"],
    });

    await advanceWorkState(target, "VERIFYING", { packageRoot });
    await prepareCompletion({ target, packageRoot });
    await recordCheck({
      target,
      packageRoot,
      id: "tests-check",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Passed",
    });

    await advanceWorkState(target, "REVIEWING", { packageRoot });

    // nextAction in REVIEWING should direct RECORD_TERMINAL_RESULT
    const nextBefore = await getNextAction(target, packageRoot);
    assert.equal(nextBefore.nextAction, NEXT_ACTIONS.RECORD_TERMINAL_RESULT);
    assert.ok(nextBefore.commands.includes("forgeloop record-terminal-result"));
    assert.ok(nextBefore.commandSpecs.some((s) => s.commandId === "record-terminal-result"));

    // Attempt complete before recording publication -> REJECTED
    const compBefore = await runComplete({ target, packageRoot });
    assert.equal(compBefore.status, "REJECTED");
    assert.ok(compBefore.errors.some((e) => e.code === "E_PUBLICATION_REQUIREMENT_PENDING"));

    // Record publication terminal result
    const recResult = await runRecordTerminalResult({
      target,
      packageRoot,
      requirement: "Package is published to npm registry",
      type: "PUBLICATION",
      status: "published",
      source: "npm publish",
      result: "Published @cassiomc1/forgeloop@0.1.11 to npm registry",
    });
    assert.equal(recResult.status, "published");
    assert.equal(recResult.type, "PUBLICATION");

    // Idempotency: repeated call returns idempotent
    const recIdempotent = await runRecordTerminalResult({
      target,
      packageRoot,
      requirement: "Package is published to npm registry",
      type: "PUBLICATION",
      status: "published",
      source: "npm publish",
      result: "Published @cassiomc1/forgeloop@0.1.11 to npm registry",
    });
    assert.equal(recIdempotent.idempotent, true);

    // Verify ledger has TERMINAL_RESULT_RECORDED
    const ledger = await validateEventLedger(target, packageRoot);
    const terminalEvents = ledger.events.filter((e) => e.event === "TERMINAL_RESULT_RECORDED");
    assert.equal(terminalEvents.length, 1);

    // nextAction should now be RUN_COMPLETE
    const nextAfter = await getNextAction(target, packageRoot);
    assert.equal(nextAfter.nextAction, NEXT_ACTIONS.RUN_COMPLETE);

    // Complete should now be VALID
    const compAfter = await runComplete({ target, packageRoot });
    assert.equal(compAfter.status, "VALID");
    assert.equal(compAfter.taskStatus, "COMPLETE");
    assert.equal(compAfter.publicationStatus, "published");
  });
});

test("recording PRODUCTION_READINESS terminal result satisfies explicit production requirement", async () => {
  await withTarget(async (target) => {
    await setupTarget(target, {
      verification: ["tests"],
      successCriteria: ["tests", "Production smoke validation succeeds"],
    });

    await advanceWorkState(target, "VERIFYING", { packageRoot });
    await prepareCompletion({ target, packageRoot });
    await recordCheck({
      target,
      packageRoot,
      id: "tests-check",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npm test",
      result: "Passed",
    });

    await advanceWorkState(target, "REVIEWING", { packageRoot });

    // Record production readiness terminal result
    const recResult = await runRecordTerminalResult({
      target,
      packageRoot,
      requirement: "Production smoke validation succeeds",
      type: "PRODUCTION_READINESS",
      status: "ready",
      source: "smoke-test.sh",
      result: "All 10 production smoke endpoints returned 200 OK",
    });
    assert.equal(recResult.status, "ready");
    assert.equal(recResult.type, "PRODUCTION_READINESS");

    // Complete should now be VALID
    const compAfter = await runComplete({ target, packageRoot });
    assert.equal(compAfter.status, "VALID");
    assert.equal(compAfter.taskStatus, "COMPLETE");
    assert.equal(compAfter.productionReadiness, "ready");
  });
});

test("record-terminal-result rejects unsupported types and invalid statuses", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);
    await advanceWorkState(target, "VERIFYING", { packageRoot });
    await prepareCompletion({ target, packageRoot });

    // Rejects LIFECYCLE
    await assert.rejects(
      () => runRecordTerminalResult({
        target,
        packageRoot,
        requirement: "Lifecycle complete",
        type: "LIFECYCLE",
        status: "COMPLETE",
        source: "manual",
        result: "complete",
      }),
      (err) => err.code === "E_FUTURE_TERMINAL_EVIDENCE",
    );

    // Rejects invalid publication status
    await assert.rejects(
      () => runRecordTerminalResult({
        target,
        packageRoot,
        requirement: "Package is published",
        type: "PUBLICATION",
        status: "invalid-status",
        source: "npm",
        result: "res",
      }),
      (err) => err.code === "E_CHECK_INVALID",
    );
  });
});
