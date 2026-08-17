import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { getPackageRoot } from "../src/core/templates.js";
import { createContract, writeContract } from "../src/core/contract.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";

const packageRoot = getPackageRoot();
const cliPath = path.join(packageRoot, "src", "cli.js");

async function withTarget(fn) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-task-cli-"));
  try {
    await fn(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function runCli(target, ...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: target,
    encoding: "utf8",
    env: { ...process.env, FORGELOOP_TASK: "" },
  });
  return result;
}

test("forgeloop task-create, task-list, task-show, task-scope, task-unlock CLI lifecycle", async () => {
  await withTarget(async (target) => {
    // 1. task-create
    const createRes = runCli(target, "task-create", "--task", "cli-task-1", "--claim", "src/auth", "--json");
    assert.equal(createRes.status, 0, `task-create failed: ${createRes.stderr}`);
    const created = JSON.parse(createRes.stdout);
    assert.equal(created.taskId, "cli-task-1");
    assert.deepEqual(created.writeClaims, ["src/auth"]);

    // 2. task-list
    const listRes = runCli(target, "task-list", "--json");
    assert.equal(listRes.status, 0, `task-list failed: ${listRes.stderr}`);
    const listed = JSON.parse(listRes.stdout);
    assert.ok(Array.isArray(listed.tasks));
    assert.equal(listed.tasks.length, 1);
    assert.equal(listed.tasks[0].taskId, "cli-task-1");

    // 3. task-show
    const showRes = runCli(target, "task-show", "--task", "cli-task-1", "--json");
    assert.equal(showRes.status, 0, `task-show failed: ${showRes.stderr}`);
    const shown = JSON.parse(showRes.stdout);
    assert.equal(shown.taskId, "cli-task-1");
    assert.deepEqual(shown.writeClaims, ["src/auth"]);

    // 4. task-scope
    const scopeRes = runCli(target, "task-scope", "--task", "cli-task-1", "--claim", "src/auth", "--claim", "tests/auth", "--json");
    assert.equal(scopeRes.status, 0, `task-scope failed: ${scopeRes.stderr}`);
    const scoped = JSON.parse(scopeRes.stdout);
    assert.deepEqual(scoped.writeClaims, ["src/auth", "tests/auth"]);

    // 5. task-unlock
    const unlockRes = runCli(target, "task-unlock", "--task", "cli-task-1", "--force", "--json");
    assert.equal(unlockRes.status, 0, `task-unlock failed: ${unlockRes.stderr}`);
    const unlocked = JSON.parse(unlockRes.stdout);
    assert.equal(unlocked.unlocked, false); // no active lock was held
  });
});

test("forgeloop task-migrate converts 1.0 layout via CLI", async () => {
  await withTarget(async (target) => {
    const contract = createContract({
      taskId: "cli-migrated-task",
      objective: "Migrate CLI",
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
      taskId: "cli-migrated-task",
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

    const migrateRes = runCli(target, "task-migrate", "--json");
    assert.equal(migrateRes.status, 0, `task-migrate failed: ${migrateRes.stderr}`);
    const migrated = JSON.parse(migrateRes.stdout);
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.taskId, "cli-migrated-task");
  });
});
