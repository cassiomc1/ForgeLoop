import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INTEGRATION_RESOURCE_DEFINITIONS,
  readForgeLoopIntegrationResource,
} from "../src/integration.js";
import { packageRoot, setupAbandonedTask, withRecoveryTarget } from "./helpers/task-recovery-fixture.js";
import { readWorkState, createWorkState, writeWorkState } from "../src/core/work-state.js";

test("resource allowlist is closed and ownership is canonical", async () => {
  await assert.rejects(
    () => readForgeLoopIntegrationResource("project/events-tail", { projectPath: "." }),
    (error) => error.code === "E_INTEGRATION_RESOURCE_UNKNOWN",
  );
  await assert.rejects(
    () => readForgeLoopIntegrationResource("../../etc/passwd", { projectPath: "." }),
    (error) => error.code === "E_INTEGRATION_RESOURCE_UNKNOWN",
  );
  assert.ok(INTEGRATION_RESOURCE_DEFINITIONS["task/ownership"]);
});

test("ownership resource uses the canonical resolver across all states", async () => {
  // ACTIVE task.
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "resource-active" });
    const resource = await readForgeLoopIntegrationResource("task/ownership", {
      projectPath: target,
      packageRoot,
      taskId,
    });
    assert.equal(resource.data.claimState, "ACTIVE");
    assert.deepEqual(resource.data.effectiveWriteClaims, ["tests"]);
    assert.equal(resource.data.mutationAllowed, true);
    assert.equal(resource.data.ownershipValid, true);

    // RECOVERED task releases effective claims through validated recovery.
    const { runTaskRecover } = await import("../src/commands/task-recover.js");
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });
    const recovered = await readForgeLoopIntegrationResource("task/ownership", {
      projectPath: target,
      packageRoot,
      taskId,
    });
    assert.equal(recovered.data.claimState, "RELEASED_BY_RECOVERY");
    assert.deepEqual(recovered.data.effectiveWriteClaims, []);
    assert.equal(recovered.data.mutationAllowed, false);
  });

  // Forged COMPLETE fails closed and retains historical claims.
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "resource-forged-complete" });
    const state = await readWorkState(target, { packageRoot, taskId });
    await writeWorkState(target, createWorkState({
      ...state,
      phase: "COMPLETE",
      previousPhase: "REVIEWING",
      verificationEvidence: [{ kind: "OBSERVED", source: "fixture", result: "passed" }],
      evidenceCoverage: [],
      checks: [],
    }), { packageRoot, taskId });

    const forged = await readForgeLoopIntegrationResource("task/ownership", {
      projectPath: target,
      packageRoot,
      taskId,
    });
    assert.equal(forged.data.claimState, "INCONSISTENT");
    assert.deepEqual(forged.data.effectiveWriteClaims, ["tests"]);
    assert.equal(forged.data.mutationAllowed, false);
    assert.equal(forged.data.ownershipValid, false);
    assert.ok(forged.data.reasonCodes.includes("E_COMPLETION_OWNERSHIP_UNPROVEN"));
  });

  // Missing taskId is refused.
  await withRecoveryTarget(async (target) => {
    await assert.rejects(
      () => readForgeLoopIntegrationResource("task/ownership", { projectPath: target, packageRoot }),
      (error) => error.code === "E_TASK_REQUIRED",
    );
  });
});

test("task resources require an existing subject and protocol/info works without one", async () => {
  await withRecoveryTarget(async (target) => {
    const info = await readForgeLoopIntegrationResource("protocol/info", {
      projectPath: target,
      packageRoot,
      packageVersion: "test",
    });
    assert.equal(info.data.features.taskClaimRecovery.validatedClaimProjection, true);
    assert.equal(info.data.features.integrationApi.version, 1);

    await assert.rejects(
      () => readForgeLoopIntegrationResource("task/contract", {
        projectPath: target,
        packageRoot,
        taskId: "no-such-task",
      }),
    );
  });
});
