import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { prepareCompletion, recordCheck } from "../src/core/completion-artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { NEXT_ACTIONS, getNextAction } from "../src/core/next-action.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";
import { runPreflight } from "../src/commands/preflight.js";
import { evaluateCompletion } from "../src/core/completion.js";
import { evaluateAudit } from "../src/core/audit.js";
import { E_INSTALLATION_AUTHORITY_REQUIRED } from "../src/core/verification-capability.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-stale-receipt-"));
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

test("stale receipt recovery: prepare-completion is recoverable and next returns executable recovery", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "task-stale-recovery",
      objective: "Verify stale receipt recovery without manual rm",
      deliverables: ["src/index.js"],
      constraints: [],
      risks: [],
      verification: ["unit-tests"],
      successCriteria: ["unit-tests"],
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
      selectedGuides: persistedRoute.value.guides,
      phase: "ROUTED",
    });
    await writeWorkState(target, state, packageRoot);

    await appendProtocolEvent(target, { taskId: contract.taskId, event: "TASK_RECEIVED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);

    await runPreflight({ target, packageRoot });

    await advanceWorkState(target, "PLANNED", packageRoot);
    await advanceWorkState(target, "EXECUTING", packageRoot);
    await advanceWorkState(target, "VERIFYING", packageRoot);

    // Prepare receipt in VERIFYING phase
    const prepared1 = await prepareCompletion({ target, packageRoot });
    assert.ok(prepared1.receipt);
    assert.equal(prepared1.receipt.taskId, contract.taskId);

    // Record valid checks for all required evidence
    for (const req of prepared1.requiredEvidence) {
      await recordCheck({
        target,
        packageRoot,
        id: `check-${req}`,
        kind: "command",
        requirement: req,
        status: "passed",
        evidenceKind: "OBSERVED",
        command: "npm test",
      });
    }

    // Now mutate state (e.g. adding a completed step or updating lastUpdated)
    const currentState = await readWorkState(target, packageRoot);
    const mutatedState = {
      ...currentState,
      completedSteps: [...currentState.completedSteps, "extra-step"],
      lastUpdated: new Date(Date.now() + 1000).toISOString(),
    };
    await writeWorkState(target, mutatedState, packageRoot);

    // next should recommend PREPARE_COMPLETION to refresh the stale receipt
    const nextResult = await getNextAction({ target, packageRoot });
    assert.equal(nextResult.nextAction, NEXT_ACTIONS.PREPARE_COMPLETION);

    // prepareCompletion must succeed cleanly on the stale receipt without throwing E_RECEIPT_STATE_MISMATCH
    const refreshed = await prepareCompletion({ target, packageRoot });
    assert.ok(refreshed.receipt);
    assert.equal(refreshed.receipt.taskId, contract.taskId);

    // Now next should be able to enter REVIEWING or proceed
    const nextAfterRefresh = await getNextAction({ target, packageRoot });
    assert.equal(nextAfterRefresh.nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
  });
});

test("installation authority enforcement: recordCheck, evaluateCompletion, and evaluateAudit reject unauthorized install-capable commands", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "task-auth-enforcement",
      objective: "Verify installation authority enforcement across validators",
      deliverables: ["src/ui.js"],
      constraints: [],
      risks: [],
      verification: ["visual-check"],
      successCriteria: ["visual-check"],
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
      selectedGuides: persistedRoute.value.guides,
      phase: "ROUTED",
    });
    await writeWorkState(target, state, packageRoot);

    await appendProtocolEvent(target, { taskId: contract.taskId, event: "TASK_RECEIVED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);

    await runPreflight({ target, packageRoot });

    await advanceWorkState(target, "PLANNED", packageRoot);
    await advanceWorkState(target, "EXECUTING", packageRoot);
    await advanceWorkState(target, "VERIFYING", packageRoot);

    await prepareCompletion({ target, packageRoot });

    // Attempting to record an unauthorized install-capable command must throw E_INSTALLATION_AUTHORITY_REQUIRED
    await assert.rejects(
      async () => {
        await recordCheck({
          target,
          packageRoot,
          id: "modlens-check",
          kind: "command",
          requirement: "visual-check",
          status: "passed",
          evidenceKind: "OBSERVED",
          command: "npx @liustack/modlens --spec=ui.json",
        });
      },
      (error) => error.code === E_INSTALLATION_AUTHORITY_REQUIRED,
    );

    // Self-asserted boolean alone without canonical authority grant must be REJECTED
    await assert.rejects(
      async () => {
        await recordCheck({
          target,
          packageRoot,
          id: "modlens-check-self-assert",
          kind: "command",
          requirement: "visual-check",
          status: "passed",
          evidenceKind: "OBSERVED",
          command: "npx @liustack/modlens --spec=ui.json",
          details: {
            installationAuthorized: true,
          },
        });
      },
      (error) => error.code === E_INSTALLATION_AUTHORITY_REQUIRED,
    );

    // Missing authority artifact must throw E_AUTHORITY_INVALID
    await assert.rejects(
      async () => {
        await recordCheck({
          target,
          packageRoot,
          id: "modlens-check-missing-auth",
          kind: "command",
          requirement: "visual-check",
          status: "passed",
          evidenceKind: "OBSERVED",
          command: "npx @liustack/modlens --spec=ui.json",
          details: {
            installationAuthorityRef: "auth-nonexistent",
          },
        });
      },
      (error) => error.code === "E_AUTHORITY_INVALID",
    );

    // Create an authority grant artifact with wrong scope
    const authDir = path.join(target, ".forgeloop", "authorities");
    await mkdir(authDir, { recursive: true });
    await writeFile(
      path.join(authDir, "auth-wrong-scope.json"),
      JSON.stringify({
        schemaVersion: 1,
        protocolVersion: 1,
        authorityId: "auth-wrong-scope",
        taskId: contract.taskId,
        type: "SOFTWARE_INSTALLATION",
        status: "AUTHORIZED",
        scope: { tool: "playwright" },
        source: "operator",
      }),
      "utf8",
    );

    // Attempting to record with wrong tool scope must throw E_AUTHORITY_SCOPE_MISMATCH
    await assert.rejects(
      async () => {
        await recordCheck({
          target,
          packageRoot,
          id: "modlens-check-wrong-scope",
          kind: "command",
          requirement: "visual-check",
          status: "passed",
          evidenceKind: "OBSERVED",
          command: "npx @liustack/modlens --spec=ui.json",
          details: {
            installationAuthorityRef: "auth-wrong-scope",
          },
        });
      },
      (error) => error.code === "E_AUTHORITY_SCOPE_MISMATCH",
    );

    // Create a valid authority grant artifact
    await writeFile(
      path.join(authDir, "auth-modlens.json"),
      JSON.stringify({
        schemaVersion: 1,
        protocolVersion: 1,
        authorityId: "auth-modlens",
        taskId: contract.taskId,
        type: "SOFTWARE_INSTALLATION",
        status: "AUTHORIZED",
        scope: { tool: "@liustack/modlens" },
        source: "operator",
      }),
      "utf8",
    );

    // If recorded with canonical authority reference, it succeeds
    const authorizedRecord = await recordCheck({
      target,
      packageRoot,
      id: "modlens-check-auth",
      kind: "command",
      requirement: "visual-check",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npx @liustack/modlens --spec=ui.json",
      details: {
        installationAuthorityRef: "auth-modlens",
      },
    });
    assert.ok(authorizedRecord.check);
    assert.equal(authorizedRecord.check.status, "passed");

    // Non-installing resolution succeeds without special authorization
    const nonInstallingRecord = await recordCheck({
      target,
      packageRoot,
      id: "modlens-check-no-install",
      kind: "command",
      requirement: "visual-check",
      status: "passed",
      evidenceKind: "OBSERVED",
      command: "npx --no-install @liustack/modlens --spec=ui.json",
    });
    assert.ok(nonInstallingRecord.check);
    assert.equal(nonInstallingRecord.check.status, "passed");
  });
});
