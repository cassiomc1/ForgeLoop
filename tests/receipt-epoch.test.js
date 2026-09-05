import { removeTempTree } from "./helpers/rm-safe.js";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runPreflight } from "../src/commands/preflight.js";
import { prepareCompletion } from "../src/core/completion-artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState, readWorkState } from "../src/core/work-state.js";
import { canonicalFingerprint, readJsonArtifact, ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { taskArtifactPath } from "../src/core/task-paths.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../src/core/task-descriptor.js";

const packageRoot = getPackageRoot();


async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-receipt-epoch-"));
  try {
    await run(target);
  } finally {
    await removeTempTree(target);
  }
}

async function setupTaskAtVerifying(target, { taskId = "receipt-epoch-task" } = {}) {
  const contract = createContract({
    taskId,
    objective: "Objective satisfied in the current repository.",
    deliverables: ["package.json"],
    constraints: [],
    risks: [],
    verification: [{ id: "checks", text: "objective checks pass", type: "VERIFICATION" }],
    successCriteria: ["objective is present"],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const contractHash = contractFingerprint(contract);
  await writeTaskDescriptor(target, createTaskDescriptor({ taskId, writeClaims: ["package.json"] }), packageRoot);
  await writeContract(target, contract, packageRoot, { taskId });
  const route = evaluateRoute({ workType: "documentation", surfaces: ["documentation"], platforms: [] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractHash, taskId });
  const state = createWorkState({
    taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "EXECUTING",
    previousPhase: "PLANNED",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["contract", "route", "planning", "implementation"],
    pendingSteps: ["verification"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  });
  await writeWorkState(target, state, { packageRoot, taskId });
  await appendProtocolEvent(target, { taskId, event: "TASK_RECEIVED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "ROUTE_VALIDATED" }, packageRoot, { taskId });
  const preflight = await runPreflight({ target, packageRoot, taskId });
  assert.equal(preflight.status, "READY");
  await appendProtocolEvent(target, { taskId, event: "PLAN_RECORDED" }, packageRoot, { taskId });
  await appendProtocolEvent(target, { taskId, event: "EXECUTION_STARTED" }, packageRoot, { taskId });
  await advanceWorkStateHelper(target, taskId, "VERIFYING");
  return { taskId };
}

async function advanceWorkStateHelper(target, taskId, toPhase) {
  const { advanceWorkState } = await import("../src/core/phase.js");
  await advanceWorkState(target, toPhase, { packageRoot, taskId });
}

test("prepare-completion starts a fresh receipt epoch for a recreated checkpoint instead of adopting a stale one", async () => {
  await withTarget(async (target) => {
    const { taskId } = await setupTaskAtVerifying(target);
    const receiptRel = taskArtifactPath(taskId, "receipt");
    const stateRel = taskArtifactPath(taskId, "state");

    // Epoch A: record checks and bind the receipt to this checkpoint.
    await prepareCompletion({ target, packageRoot, taskId });
    const epochReceiptPath = path.join(target, receiptRel);

    // Simulate clear-state + chronology-aware restoration: new checkpoint
    // fingerprint, empty checks; the old receipt file survives on disk.
    let state = await readWorkState(target, { packageRoot, taskId, statePath: stateRel });
    state = {
      ...state,
      revision: (state.revision ?? 0) + 1,
      lastUpdated: new Date().toISOString(),
      checks: [],
      verificationEvidence: [],
      evidenceCoverage: undefined,
    };
    delete state.evidenceCoverage;
    await writeWorkState(target, state, { packageRoot, taskId, statePath: stateRel });

    const existing = await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot);
    assert.notEqual(existing.value.stateFingerprint, canonicalFingerprint(state));

    // The stale-epoch receipt must not be adopted; a fresh epoch initializes.
    await prepareCompletion({ target, packageRoot, taskId });

    const rebound = (await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot)).value;
    assert.equal(rebound.stateFingerprint, canonicalFingerprint(await readWorkState(target, { packageRoot, taskId, statePath: stateRel })));
    assert.deepEqual(rebound.checks, []);

    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);
    assert.ok(epochReceiptPath);
    assert.ok(ARTIFACT_PATHS.receipt);
  });
});
