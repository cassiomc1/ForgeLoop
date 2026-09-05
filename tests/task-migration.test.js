import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  detectLegacySingletonLayout,
  migrateLegacyLayout,
} from "../src/core/task-migration.js";
import { taskStorageKey } from "../src/core/task-identity.js";
import { fileExists } from "../src/core/filesystem.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { createContract, writeContract } from "../src/core/contract.js";
import { readTaskDescriptor } from "../src/core/task-descriptor.js";
import { createGate } from "./helpers/gates.js";
import { writeJsonArtifact } from "../src/core/artifacts.js";
import {
  E_TASK_MIGRATION_IDENTITY_MISMATCH,
  E_TASK_MIGRATION_INVALID,
} from "../src/core/error-codes.js";

const packageRoot = getPackageRoot();

async function withTarget(fn) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-task-migration-"));
  try {
    await fn(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("detectLegacySingletonLayout detects presence of legacy root artifacts", async () => {
  await withTarget(async (target) => {
    // Empty directory
    const emptyDetect = await detectLegacySingletonLayout(target);
    assert.equal(emptyDetect.hasLegacy, false);

    // Write root contract and work-state
    const contract = createContract({
      taskId: "legacy-task-001",
      objective: "Legacy 1.0 task",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "legacy-task-001",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    const detected = await detectLegacySingletonLayout(target);
    assert.equal(detected.hasLegacy, true);
    assert.ok(detected.legacyFiles.length >= 2);
  });
});

test("migrateLegacyLayout moves legacy artifacts into namespaced directory and creates task.json", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "migrating-task",
      objective: "Migrate me",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "migrating-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // Dry run first
    const dryRunResult = await migrateLegacyLayout(target, { dryRun: true, packageRoot });
    assert.equal(dryRunResult.migrated, false);
    assert.equal(dryRunResult.dryRun, true);
    assert.equal(dryRunResult.taskId, "migrating-task");

    // Perform actual migration
    const result = await migrateLegacyLayout(target, { packageRoot });
    assert.equal(result.migrated, true);
    assert.equal(result.taskId, "migrating-task");
    assert.equal(result.taskKey, taskStorageKey("migrating-task"));

    // Legacy root files should no longer exist
    assert.equal(await fileExists(path.join(target, ".forgeloop", "current-contract.json")), false);
    assert.equal(await fileExists(path.join(target, ".forgeloop", "work-state.json")), false);

    // New namespaced files exist
    const taskDir = path.join(target, ".forgeloop", "task-state", result.taskKey);
    assert.equal(await fileExists(path.join(taskDir, "task.json")), true);
    assert.equal(await fileExists(path.join(taskDir, "contract.json")), true);
    assert.equal(await fileExists(path.join(taskDir, "work-state.json")), true);
    assert.equal(await fileExists(path.join(taskDir, "migration-receipt.json")), true);

    const descriptor = await readTaskDescriptor(target, "migrating-task", packageRoot);
    assert.equal(descriptor.taskId, "migrating-task");
    assert.equal(descriptor.taskKey, result.taskKey);
  });
});

test("migration rejects malformed event line and preserves legacy files", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "event-corrupt-task",
      objective: "Test corrupt event line",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "event-corrupt-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // Write malformed events.ndjson
    await writeFile(path.join(target, ".forgeloop", "events.ndjson"), "{\"schemaVersion\":1}\n{broken json\n", "utf8");

    await assert.rejects(
      () => migrateLegacyLayout(target, { packageRoot }),
      (error) => error.code === E_TASK_MIGRATION_INVALID,
    );

    // Legacy files remain untouched
    assert.equal(await fileExists(path.join(target, ".forgeloop", "current-contract.json")), true);
    assert.equal(await fileExists(path.join(target, ".forgeloop", "work-state.json")), true);
    assert.equal(await fileExists(path.join(target, ".forgeloop", "events.ndjson")), true);

    // Target task directory does not exist
    const taskKey = taskStorageKey("event-corrupt-task");
    assert.equal(await fileExists(path.join(target, ".forgeloop", "task-state", taskKey)), false);
  });
});

test("migration rejects gate or execution with mismatched taskId and preserves legacy files", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "mismatch-task",
      objective: "Test gate mismatch",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "mismatch-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // Create legacy gate with different taskId
    const gatesDir = path.join(target, ".forgeloop", "gates");
    await mkdir(gatesDir, { recursive: true });
    const gateObj = createGate({
      taskId: "other-task-id",
      gate: "approval",
      status: "satisfied",
      requiredBy: ["preflight"],
      artifacts: [],
      decisions: ["DECISION-1"],
      unknowns: [],
      approvedAssumptions: [],
    });
    await writeJsonArtifact(
      target,
      ".forgeloop/gates/gate-1.json",
      gateObj,
      "gate",
      packageRoot,
    );

    await assert.rejects(
      () => migrateLegacyLayout(target, { packageRoot }),
      (error) => error.code === E_TASK_MIGRATION_IDENTITY_MISMATCH || error.code === E_TASK_MIGRATION_INVALID,
    );

    // Legacy files untouched
    assert.equal(await fileExists(path.join(target, ".forgeloop", "current-contract.json")), true);
    assert.equal(await fileExists(path.join(target, ".forgeloop", "gates", "gate-1.json")), true);
  });
});

test("migration rejects execution with mismatched taskId and preserves legacy files", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "exec-mismatch-task",
      objective: "Test execution mismatch",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "exec-mismatch-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // Create legacy execution with different taskId
    const execsDir = path.join(target, ".forgeloop", "executions");
    await mkdir(execsDir, { recursive: true });
    await writeJsonArtifact(
      target,
      ".forgeloop/executions/exec-001.json",
      {
        schemaVersion: 1,
        protocolVersion: 1,
        executionId: "exec-001",
        taskId: "other-task-id",
        checkId: "check-1",
        requirement: "verification",
        verificationCycle: 1,
        kind: "COMMAND_EXECUTION",
        argv: ["npm", "test"],
        cwd: target,
        resolution: {
          resolutionMode: "DIRECT_EXEC",
          mayInstall: false,
          installer: null,
          tool: "npm",
        },
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "passed",
        exitCode: 0,
      },
      "execution",
      packageRoot,
    );

    await assert.rejects(
      () => migrateLegacyLayout(target, { packageRoot }),
      (error) => error.code === E_TASK_MIGRATION_IDENTITY_MISMATCH || error.code === E_TASK_MIGRATION_INVALID,
    );

    assert.equal(await fileExists(path.join(target, ".forgeloop", "current-contract.json")), true);
    assert.equal(await fileExists(path.join(target, ".forgeloop", "executions", "exec-001.json")), true);
  });
});

test("migration rejects temp-copy corruption and rolls back cleanly", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "rollback-task",
      objective: "Test rollback on temp corruption",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "rollback-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // Inject corruption in temp directory via afterCopyForTest
    await assert.rejects(
      () =>
        migrateLegacyLayout(target, {
          packageRoot,
          afterCopyForTest: async ({ tempDirAbs }) => {
            await writeFile(path.join(tempDirAbs, "events.ndjson"), "{broken\n", "utf8");
          },
        }),
      (error) => error.code === E_TASK_MIGRATION_INVALID,
    );

    const taskKey = taskStorageKey("rollback-task");
    const finalDir = path.join(target, ".forgeloop", "task-state", taskKey);
    const tempDir = path.join(target, ".forgeloop", "task-state", `.tmp-${taskKey}`);

    assert.equal(await fileExists(finalDir), false, "Final task directory must not exist");
    assert.equal(await fileExists(tempDir), false, "Temp directory must be cleaned up");
    assert.equal(await fileExists(path.join(target, ".forgeloop", "current-contract.json")), true, "Legacy source must remain");
  });
});

test("migration rejects post-publish corruption when published namespace fingerprints diverge from source", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "post-publish-corrupt-task",
      objective: "Test post-publish validation",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "post-publish-corrupt-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // In afterPublishForTest, corrupt contract.json in the published final directory
    await assert.rejects(
      () =>
        migrateLegacyLayout(target, {
          packageRoot,
          afterPublishForTest: async ({ finalDirAbs }) => {
            await writeFile(path.join(finalDirAbs, "contract.json"), '{"corrupted":true}\n', "utf8");
          },
        }),
      (error) => error.code === E_TASK_MIGRATION_INVALID,
    );

    const taskKey = taskStorageKey("post-publish-corrupt-task");
    const finalDir = path.join(target, ".forgeloop", "task-state", taskKey);

    // Assert invalid published namespace was rolled back before cleanup started
    assert.equal(
      await fileExists(finalDir),
      false,
      "Invalid published namespace must be rolled back before legacy cleanup begins",
    );

    // Assert legacy source files remain intact
    assert.equal(
      await fileExists(path.join(target, ".forgeloop", "current-contract.json")),
      true,
      "Legacy contract must remain intact",
    );
    assert.equal(
      await fileExists(path.join(target, ".forgeloop", "work-state.json")),
      true,
      "Legacy state must remain intact",
    );

    // Assert retry succeeds cleanly
    const retry = await migrateLegacyLayout(target, { packageRoot });
    assert.equal(retry.migrated, true);
    assert.equal(retry.taskId, "post-publish-corrupt-task");
    assert.equal(
      await fileExists(finalDir),
      true,
      "Final task directory must exist after successful retry",
    );
    assert.equal(
      await fileExists(path.join(target, ".forgeloop", "current-contract.json")),
      false,
      "Legacy contract must be cleaned up after successful retry",
    );
  });
});

test("migration preserves valid published namespace if legacy cleanup fails after publication", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "cleanup-fail-task",
      objective: "Test cleanup failure preservation",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "cleanup-fail-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // In removeLegacyArtifactForTest, throw to simulate failure during cleanup
    await assert.rejects(
      () =>
        migrateLegacyLayout(target, {
          packageRoot,
          removeLegacyArtifactForTest: async () => {
            throw new Error("Simulated filesystem cleanup failure");
          },
        }),
      (error) => error.code === E_TASK_MIGRATION_INVALID && error.message.includes("legacy cleanup failed"),
    );

    const taskKey = taskStorageKey("cleanup-fail-task");
    const finalDir = path.join(target, ".forgeloop", "task-state", taskKey);
    assert.equal(
      await fileExists(finalDir),
      true,
      "Valid published namespace must be preserved if cleanup fails",
    );
  });
});

test("migration result contract matches exact required keys for success, dry-run, and no-state", async () => {
  await withTarget(async (target) => {
    // 1. No legacy state
    const noLegacyRes = await migrateLegacyLayout(target, { packageRoot });
    assert.equal(noLegacyRes.migrated, false);
    assert.equal(noLegacyRes.reason, "NO_LEGACY_STATE");
    assert.ok(noLegacyRes.message);

    // Setup legacy files
    const contract = createContract({
      taskId: "shape-test-task",
      objective: "Test result shape",
      deliverables: ["src/index.js"],
      constraints: ["none"],
      risks: ["low"],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: ["error"],
      unresolvedDecisions: [],
      sourceRefs: ["src"],
    });
    await writeContract(target, contract, packageRoot);

    const state = createWorkState({
      taskId: "shape-test-task",
      contractFingerprint: "0".repeat(64),
      repositoryFingerprint: { branch: null, head: null },
      phase: "PLANNED",
      completedSteps: [],
      pendingSteps: [],
      checks: [],
      failures: [],
      blockers: [],
    });
    await writeWorkState(target, state, { packageRoot });

    // 2. Dry run result shape
    const dryRes = await migrateLegacyLayout(target, { packageRoot, dryRun: true });
    assert.deepEqual(
      Object.keys(dryRes).sort(),
      ["dryRun", "legacyFiles", "migrated", "targetDirectory", "taskId", "taskKey"].sort(),
    );
    assert.equal(dryRes.migrated, false);
    assert.equal(dryRes.dryRun, true);
    assert.equal(dryRes.taskId, "shape-test-task");
    assert.ok(Array.isArray(dryRes.legacyFiles));

    // 3. Success result shape
    const successRes = await migrateLegacyLayout(target, { packageRoot, dryRun: false });
    assert.deepEqual(
      Object.keys(successRes).sort(),
      ["migrated", "migratedArtifacts", "targetDirectory", "taskId", "taskKey"].sort(),
    );
    assert.equal(successRes.migrated, true);
    assert.equal(successRes.taskId, "shape-test-task");
    assert.ok(Array.isArray(successRes.migratedArtifacts));
  });
});
