import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  acquireTaskLock,
  readLockInfo,
  forceUnlockTask,
  classifyLockStaleness,
  currentProcessStartToken,
  withTaskLock,
} from "../src/core/task-lock.js";
import { taskLockPath } from "../src/core/task-paths.js";
import { fileExists } from "../src/core/filesystem.js";

async function withTarget(fn) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-task-lock-"));
  try {
    await fn(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("acquireTaskLock acquires exclusive lock and release removes it", async () => {
  await withTarget(async (target) => {
    const taskId = "task-lock-test";
    const lockHandle = await acquireTaskLock(target, taskId, "test-cmd");
    assert.ok(lockHandle);
    assert.equal(lockHandle.lockData.taskId, taskId);
    assert.equal(lockHandle.lockData.operation, "test-cmd");
    assert.equal(typeof lockHandle.lockData.hostname, "string");
    assert.equal(typeof lockHandle.lockData.ownerInstanceId, "string");
    assert.equal(lockHandle.lockData.leaseMs, 300000);
    assert.match(lockHandle.lockData.processStartToken, new RegExp(`^${process.pid}:\\d+$`));
    assert.equal(lockHandle.lockData.heartbeatAt, lockHandle.lockData.acquiredAt);
    assert.equal(typeof lockHandle.release, "function");

    const fullLockPath = path.join(target, taskLockPath(taskId));
    assert.equal(await fileExists(fullLockPath), true);

    const info = await readLockInfo(target, taskId);
    assert.ok(info);
    assert.equal(info.operation, "test-cmd");
    assert.equal(info.taskId, taskId);

    // Re-acquiring same task while locked must fail with E_TASK_LOCKED
    await assert.rejects(
      () => acquireTaskLock(target, taskId, "second-cmd"),
      (err) => err.code === "E_TASK_LOCKED",
    );

    // Release lock
    await lockHandle.release();
    assert.equal(await fileExists(fullLockPath), false);

    const infoAfter = await readLockInfo(target, taskId);
    assert.equal(infoAfter, null);
  });
});

test("process start token pairs the active PID with a stable start epoch", () => {
  const token = currentProcessStartToken(10_000, 2.5);
  assert.equal(token, `${process.pid}:7500`);
});

test("classifyLockStaleness distinguishes an expired lease", () => {
  assert.equal(classifyLockStaleness({ acquiredAt: "2020-01-01T00:00:00.000Z", heartbeatAt: "2020-01-01T00:00:00.000Z", leaseMs: 1 }, Date.parse("2020-01-01T00:00:00.002Z")).status, "STALE");
});

test("withTaskLock runs mutation under lock and releases cleanly on complete or error", async () => {
  await withTarget(async (target) => {
    const taskId = "task-with-lock";

    let executed = false;
    const res = await withTaskLock(target, taskId, "mutate", async (lockData) => {
      executed = true;
      const info = await readLockInfo(target, taskId);
      assert.ok(info);
      assert.equal(info.taskId, taskId);
      assert.equal(lockData.taskId, taskId);
      return "result-123";
    });

    assert.equal(executed, true);
    assert.equal(res, "result-123");

    // Lock released after function finishes
    const infoAfter = await readLockInfo(target, taskId);
    assert.equal(infoAfter, null);

    // Lock released even when error thrown inside function
    await assert.rejects(
      () => withTaskLock(target, taskId, "failing-op", async () => {
        throw new Error("inner failure");
      }),
      /inner failure/,
    );

    const infoAfterError = await readLockInfo(target, taskId);
    assert.equal(infoAfterError, null);
  });
});

test("forceUnlockTask removes active lock", async () => {
  await withTarget(async (target) => {
    const taskId = "task-force-unlock";
    await acquireTaskLock(target, taskId, "crashed-cmd");

    const before = await readLockInfo(target, taskId);
    assert.ok(before);

    const unlocked = await forceUnlockTask(target, taskId);
    assert.equal(unlocked.unlocked, true);

    const after = await readLockInfo(target, taskId);
    assert.equal(after, null);
  });
});
