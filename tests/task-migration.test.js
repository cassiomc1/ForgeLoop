import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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

    const descriptor = await readTaskDescriptor(target, "migrating-task", packageRoot);
    assert.equal(descriptor.taskId, "migrating-task");
    assert.equal(descriptor.taskKey, result.taskKey);
  });
});
