import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runComplete } from "../src/commands/complete.js";
import { createCheck } from "../src/core/checks.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { createCoverage } from "../src/core/coverage.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { createGate } from "../src/core/gates.js";
import { persistGate } from "../src/core/gate-artifact.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { createEvidence } from "../src/core/evidence.js";
import { ARTIFACT_PATHS, writeJsonArtifact } from "../src/core/artifacts.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-complete-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function prepareValidTask(target, receiptOverrides = {}) {
  const contract = createContract({
    taskId: "task-complete",
    objective: "Validate a complete task",
    deliverables: ["src/example.js"],
    constraints: ["offline"],
    risks: [],
    verification: ["tests"],
    successCriteria: ["tests"],
    stopConditions: ["verification unavailable"],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const contractHash = contractFingerprint(contract);
  await writeContract(target, contract, packageRoot);
  const route = evaluateRoute({ workType: "api", surfaces: ["api"], platforms: [] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractHash });
  const state = createWorkState({
    taskId: contract.taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "REVIEWING",
    previousPhase: "VERIFYING",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["contract", "route", "execution", "verification"],
    pendingSteps: [],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [createEvidence({ kind: "OBSERVED", source: "npm test", result: "exit 0" })],
  });
  await writeWorkState(target, state, { packageRoot });
  const receipt = {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: contract.taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    status: "complete",
    taskStatus: "complete",
    verificationStatus: "valid",
    publicationStatus: "local-only",
    productionReadiness: "not-verified",
    selectedGuides: route.guides,
    changedPaths: ["src/example.js"],
    checks: [createCheck({
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "npm test",
      exitCode: 0,
    })],
    evidence: [createEvidence({ kind: "OBSERVED", source: "npm test", result: "exit 0" })],
    evidenceCoverage: [createCoverage({
      requirement: "tests",
      requiredEvidence: ["tests"],
      observedEvidence: ["tests"],
    })],
    review: { status: "approved", independent: false },
    limitations: [],
    publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
    ...receiptOverrides,
  };
  await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, receipt, "execution-receipt", packageRoot);
  for (const event of [
    "TASK_RECEIVED",
    "CONTRACT_VALIDATED",
    "ROUTE_VALIDATED",
    "PREFLIGHT_READY",
    "EXECUTION_STARTED",
    "VERIFICATION_RECORDED",
  ]) {
    await appendProtocolEvent(target, { taskId: contract.taskId, event }, packageRoot);
  }
  return { contract, route, receipt };
}

test("complete rejects a task without a current contract", async () => {
  await withTarget(async (target) => {
    const result = await runComplete({ target, packageRoot, persist: false });
    assert.equal(result.status, "REJECTED");
    assert.ok(result.errors.some((error) => error.code === "E_CONTRACT_MISSING"));
  });
});

test("complete rejects a required observed check backed only by inferred evidence", async () => {
  await withTarget(async (target) => {
    await prepareValidTask(target);
    const receiptPath = path.join(target, ARTIFACT_PATHS.receipt);
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    receipt.checks[0] = createCheck({
      ...receipt.checks[0],
      evidenceKind: "INFERRED",
    });
    await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, receipt, "execution-receipt", packageRoot);
    const result = await runComplete({
      target,
      packageRoot,
      persist: false,
    });
    assert.equal(result.status, "REJECTED");
    assert.ok(result.errors.some((error) => error.code === "E_EVIDENCE_KIND_INVALID"));
  });
});

test("complete validates a coherent task and keeps publication independent", async () => {
  await withTarget(async (target) => {
    const result = await prepareValidTask(target);
    const completion = await runComplete({ target, packageRoot, persist: false });
    assert.equal(completion.status, "VALID");
    assert.equal(completion.taskStatus, "COMPLETE");
    assert.equal(completion.verificationStatus, "VALID");
    assert.equal(completion.publicationStatus, "local-only");
    assert.equal(result.receipt.productionReadiness, "not-verified");
  });
});
