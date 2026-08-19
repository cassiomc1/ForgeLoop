import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { taskStorageKey } from "../src/core/task-identity.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repositoryRoot, "src", "cli.js");

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-vr-task-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function runCli(target, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args, "--path", target], {
    encoding: "utf8",
  });
}

function receiptFixture(taskId, overrides = {}) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    contractFingerprint: "a".repeat(64),
    selectedGuides: ["clean"],
    changedPaths: [],
    checks: [],
    review: { status: "not-run", independent: false },
    limitations: [],
    publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
    ...overrides,
  };
}

async function writeTaskReceipt(target, taskId, receipt) {
  const directory = path.join(target, ".forgeloop", "task-state", taskStorageKey(taskId));
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "execution-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
}

test("VR-TASK-1: validate-receipt --task validates the namespaced receipt when no singleton exists", async () => {
  await withTarget(async (target) => {
    const created = runCli(target, "task-create", "--task", "task-a", "--json");
    assert.equal(created.status, 0, created.stderr);

    await writeTaskReceipt(target, "task-a", receiptFixture("task-a"));

    const result = runCli(target, "validate-receipt", "--task", "task-a", "--json");
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.taskId, "task-a");
  });
});

test("VR-TASK-2: validate-receipt --task A validates only task A's receipt", async () => {
  await withTarget(async (target) => {
    for (const taskId of ["task-a", "task-b"]) {
      const created = runCli(target, "task-create", "--task", taskId, "--json");
      assert.equal(created.status, 0, created.stderr);
    }

    // Task A receipt is valid; task B receipt is schema-invalid (bad protocolVersion).
    await writeTaskReceipt(target, "task-a", receiptFixture("task-a"));
    await writeTaskReceipt(target, "task-b", receiptFixture("task-b", { protocolVersion: 999 }));

    const resultA = runCli(target, "validate-receipt", "--task", "task-a", "--json");
    assert.equal(resultA.status, 0, resultA.stderr);
    assert.equal(JSON.parse(resultA.stdout).taskId, "task-a");

    const resultB = runCli(target, "validate-receipt", "--task", "task-b", "--json");
    assert.equal(resultB.status, 1, "task B's invalid receipt must fail");
    assert.match(resultB.stderr, /Invalid receipt .*task-state/);
    assert.match(resultB.stderr, /protocolVersion/);
  });
});

test("VR-TASK-3: --file overrides task-derived receipt resolution", async () => {
  await withTarget(async (target) => {
    const created = runCli(target, "task-create", "--task", "task-a", "--json");
    assert.equal(created.status, 0, created.stderr);

    // The task's namespaced receipt is invalid; the explicit --file receipt is valid.
    await writeTaskReceipt(target, "task-a", receiptFixture("task-a", { protocolVersion: 999 }));
    await writeFile(
      path.join(target, "explicit-receipt.json"),
      `${JSON.stringify(receiptFixture("explicit-file"), null, 2)}\n`,
      "utf8",
    );

    const result = runCli(target, "validate-receipt", "--task", "task-a", "--file", "explicit-receipt.json", "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).taskId, "explicit-file");
  });
});

test("VR-TASK-4: legacy singleton receipt still validates when no task descriptors exist", async () => {
  await withTarget(async (target) => {
    await mkdir(path.join(target, ".forgeloop"), { recursive: true });
    await writeFile(
      path.join(target, ".forgeloop", "execution-receipt.json"),
      `${JSON.stringify(receiptFixture("legacy-singleton"), null, 2)}\n`,
      "utf8",
    );

    const result = runCli(target, "validate-receipt", "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).taskId, "legacy-singleton");
  });
});

test("VR-TASK-5: multiple active tasks without --task or --file fail with E_TASK_AMBIGUOUS", async () => {
  await withTarget(async (target) => {
    for (const taskId of ["task-a", "task-b"]) {
      const created = runCli(target, "task-create", "--task", taskId, "--json");
      assert.equal(created.status, 0, created.stderr);
      await writeTaskReceipt(target, taskId, receiptFixture(taskId));
    }

    const result = runCli(target, "validate-receipt", "--json");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /E_TASK_AMBIGUOUS|Multiple active tasks/i);
  });
});
