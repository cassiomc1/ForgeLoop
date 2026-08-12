import assert from "node:assert/strict";
import { lstat, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runComplete } from "../src/commands/complete.js";
import { runPreflight } from "../src/commands/preflight.js";
import { prepareCompletion, recordCheck } from "../src/core/completion-artifacts.js";
import { ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-completion-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function setupTarget(target, { advanceToVerifying = true } = {}) {
  const contract = createContract({
    taskId: "task-ergonomics",
    objective: "Exercise completion ergonomics",
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
  const persistedRoute = await persistRoute(target, route, packageRoot, {
    contractFingerprint: contractHash,
  });
  const state = createWorkState({
    taskId: contract.taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "EXECUTING",
    previousPhase: "PLANNED",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["implementation"],
    pendingSteps: ["verification", "receipt"],
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
  await appendProtocolEvent(target, { taskId: contract.taskId, event: "EXECUTION_STARTED" }, packageRoot);
  if (advanceToVerifying) await advanceWorkState(target, "VERIFYING", { packageRoot });
  return { contract, route, persistedRoute };
}

test("completion rejects implemented work that stops in EXECUTING", async () => {
  await withTarget(async (target) => {
    await setupTarget(target, { advanceToVerifying: false });
    await writeFile(path.join(target, "src-example.js"), "export const implemented = true;\n");

    const completion = await runComplete({ target, packageRoot });

    assert.equal(completion.status, "REJECTED");
    assert.equal(completion.taskStatus, "INCOMPLETE");
    assert.ok(completion.errors.some((error) => error.code === "E_RECEIPT_MISSING"));
    assert.ok(completion.errors.some((error) => error.code === "E_PHASE_PREREQUISITE_MISSING"));
    assert.match(completion.errors.find((error) => error.code === "E_PHASE_PREREQUISITE_MISSING").next, /VERIFYING.*REVIEWING/i);
    assert.equal((await readWorkState(target, packageRoot)).phase, "EXECUTING");
  });
});

test("prepare-completion derives a safe receipt skeleton without verification claims", async () => {
  await withTarget(async (target) => {
    const { contract, route, persistedRoute } = await setupTarget(target);
    const result = await prepareCompletion({ target, packageRoot });

    assert.equal(result.receipt.taskId, contract.taskId);
    assert.equal(result.receipt.contractFingerprint, contractFingerprint(contract));
    assert.equal(result.receipt.routeFingerprint, persistedRoute.fingerprint);
    assert.deepEqual(result.receipt.selectedGuides, route.guides);
    assert.equal(result.receipt.publicationStatus, "local-only");
    assert.equal(result.receipt.productionReadiness, "not-verified");
    assert.equal(result.receipt.checks.length, 0);
    assert.ok(result.receipt.evidenceCoverage.every((item) => item.status === "NOT_VERIFIED"));
    await readFile(path.join(target, ARTIFACT_PATHS.receipt), "utf8");
  });
});

test("recordCheck stores observed evidence and completion recognizes it", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);
    await prepareCompletion({ target, packageRoot });
    const sentinel = path.join(target, "must-not-run.txt");
    const result = await recordCheck({
      target,
      packageRoot,
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: `touch ${sentinel}`,
      result: "4/4 tests passed",
      exitCode: 0,
    });

    assert.equal(result.check.status, "passed");
    assert.equal(result.evidence.kind, "OBSERVED");
    assert.equal(result.coverage.find((item) => item.requirement === "tests").status, "COVERED");
    await assert.rejects(() => readFile(sentinel));
    await advanceWorkState(target, "REVIEWING", { packageRoot });
    const completion = await runComplete({ target, packageRoot });
    assert.equal(completion.status, "VALID");
    assert.equal(completion.taskStatus, "COMPLETE");

    const ledger = await validateEventLedger(target, packageRoot);
    assert.equal(ledger.valid, true);
    const eventNames = ledger.events.map((event) => event.event);
    for (const event of [
      "CONTRACT_VALIDATED",
      "ROUTE_VALIDATED",
      "PREFLIGHT_READY",
      "EXECUTION_STARTED",
      "VERIFICATION_STARTED",
      "VERIFICATION_RECORDED",
      "COMPLETION_VALIDATED",
    ]) {
      assert.ok(eventNames.includes(event), `missing ${event}`);
    }
    assert.ok(eventNames.indexOf("PREFLIGHT_READY") < eventNames.indexOf("EXECUTION_STARTED"));
    assert.ok(eventNames.indexOf("EXECUTION_STARTED") < eventNames.indexOf("VERIFICATION_STARTED"));
    assert.ok(eventNames.indexOf("VERIFICATION_RECORDED") < eventNames.indexOf("COMPLETION_VALIDATED"));
  });
});

test("recordCheck rejects invalid and contradictory evidence before writing", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);
    await prepareCompletion({ target, packageRoot });
    const input = {
      target,
      packageRoot,
      id: "tests",
      kind: "command",
      requirement: "tests",
      command: "npm test",
      result: "exit 0",
    };

    await assert.rejects(
      () => recordCheck({ ...input, status: "unknown", evidenceKind: "OBSERVED" }),
      (error) => error.code === "E_CHECK_INVALID",
    );
    await assert.rejects(
      () => recordCheck({ ...input, status: "passed", evidenceKind: "UNKNOWN" }),
      (error) => error.code === "E_EVIDENCE_KIND_INVALID",
    );
    await assert.rejects(
      () => recordCheck({ ...input, status: "passed", evidenceKind: "NOT_VERIFIED" }),
      (error) => error.code === "E_CHECK_STATUS_CONTRADICTION",
    );
    await assert.rejects(
      () => recordCheck({ ...input, status: "passed", evidenceKind: "OBSERVED", details: "not an object" }),
      (error) => error.code === "E_CHECK_INVALID",
    );
    await assert.rejects(
      () => recordCheck({ ...input, status: "passed", evidenceKind: "OBSERVED", command: "echo sk-1234567890" }),
      /secret/i,
    );
  });
});

test("recordCheck requires a prepared receipt and rejects a symlink target", async () => {
  await withTarget(async (target) => {
    const context = await setupTarget(target);
    await assert.rejects(
      () => recordCheck({
        target,
        packageRoot,
        id: "tests",
        kind: "command",
        requirement: "tests",
        status: "passed",
        evidenceKind: "OBSERVED",
        command: "npm test",
        result: "exit 0",
      }),
      (error) => error.code === "E_RECEIPT_MISSING",
    );

    const link = `${target}-link`;
    await symlink(target, link, "dir");
    try {
      await assert.rejects(
        () => prepareCompletion({ target: link, packageRoot }),
        /symlink/i,
      );
      assert.equal((await lstat(link)).isSymbolicLink(), true);
    } finally {
      await rm(link, { recursive: true, force: true });
    }
    assert.equal(context.contract.taskId, "task-ergonomics");
  });
});

test("recordCheck keeps verification evidence before REVIEWING", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);
    await prepareCompletion({ target, packageRoot });
    await advanceWorkState(target, "REVIEWING", { packageRoot });

    await assert.rejects(
      () => recordCheck({
        target,
        packageRoot,
        id: "tests",
        kind: "command",
        requirement: "tests",
        status: "passed",
        evidenceKind: "OBSERVED",
        result: "4/4 passed",
      }),
      (error) => error.code === "E_PHASE_PREREQUISITE_MISSING",
    );
  });
});
