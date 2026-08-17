import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { taskLockPath } from "./task-paths.js";
import { E_TASK_LOCKED } from "./error-codes.js";

export async function readLockInfo(target, taskId) {
  const relativePath = taskLockPath(taskId);
  await assertSafePath(target, relativePath);
  const fullPath = ensureWithin(target, relativePath);

  if (!(await fileExists(fullPath))) {
    return null;
  }

  try {
    const raw = await readFile(fullPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { taskId, corrupted: true };
  }
}

export const CLAIMS_LOCK_REL_PATH = ".forgeloop/.claims.lock";

export async function readProjectClaimsLockInfo(target) {
  await assertSafePath(target, CLAIMS_LOCK_REL_PATH);
  const fullPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);

  if (!(await fileExists(fullPath))) {
    return null;
  }

  try {
    const raw = await readFile(fullPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { corrupted: true };
  }
}

export async function acquireProjectClaimsLock(target, operation = "claim-reservation") {
  await assertSafePath(target, CLAIMS_LOCK_REL_PATH);
  const fullPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);

  await mkdir(path.dirname(fullPath), { recursive: true });

  const lockData = {
    lockId: randomUUID(),
    scope: "claims-reservation",
    operation,
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
  };

  let fileHandle;
  try {
    fileHandle = await open(fullPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      const existing = await readProjectClaimsLockInfo(target);
      const err = new Error(
        `Project write claims reservation is locked by operation "${existing?.operation ?? "unknown"}" (pid: ${existing?.pid ?? "unknown"}, acquired: ${existing?.acquiredAt ?? "unknown"}).`,
      );
      err.code = E_TASK_LOCKED;
      err.lockInfo = existing;
      throw err;
    }
    throw error;
  }

  try {
    await fileHandle.writeFile(`${JSON.stringify(lockData, null, 2)}\n`, "utf8");
    await fileHandle.close();
    return {
      lockData,
      release: async () => {
        try {
          const current = await readProjectClaimsLockInfo(target);
          if (current && current.lockId === lockData.lockId) {
            await unlink(fullPath);
          }
        } catch {
          // ignore
        }
      },
    };
  } catch (error) {
    try {
      await fileHandle.close();
    } catch {
      // ignore
    }
    try {
      await unlink(fullPath);
    } catch {
      // ignore
    }
    throw error;
  }
}

export async function withProjectClaimsLock(target, operationOrCallback, callback) {
  let operation = operationOrCallback;
  let fn = callback;
  if (typeof operationOrCallback === "function" && callback === undefined) {
    fn = operationOrCallback;
    operation = "claim-reservation";
  }
  const lock = await acquireProjectClaimsLock(target, operation);
  try {
    return await fn(lock.lockData);
  } finally {
    await lock.release();
  }
}

export async function acquireTaskLock(target, taskId, operation = "mutation") {
  const relativePath = taskLockPath(taskId);
  await assertSafePath(target, relativePath);
  const fullPath = ensureWithin(target, relativePath);

  await mkdir(path.dirname(fullPath), { recursive: true });

  const lockData = {
    lockId: randomUUID(),
    taskId,
    operation,
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
  };

  let fileHandle;
  try {
    fileHandle = await open(fullPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      const existing = await readLockInfo(target, taskId);
      const err = new Error(
        `Task "${taskId}" is locked by operation "${existing?.operation ?? "unknown"}" (pid: ${existing?.pid ?? "unknown"}, acquired: ${existing?.acquiredAt ?? "unknown"}). Use 'forgeloop task-unlock --task ${taskId} --force' if the process died.`,
      );
      err.code = E_TASK_LOCKED;
      err.lockInfo = existing;
      err.taskId = taskId;
      throw err;
    }
    throw error;
  }

  try {
    await fileHandle.writeFile(`${JSON.stringify(lockData, null, 2)}\n`, "utf8");
    await fileHandle.close();
    return {
      lockData,
      release: async () => {
        try {
          const current = await readLockInfo(target, taskId);
          if (current && current.lockId === lockData.lockId) {
            await unlink(fullPath);
          }
        } catch {
          // ignore already unlinked or overwritten
        }
      },
    };
  } catch (error) {
    try {
      await fileHandle.close();
    } catch {
      // ignore
    }
    try {
      await unlink(fullPath);
    } catch {
      // ignore
    }
    throw error;
  }
}

export async function forceUnlockTask(target, taskId) {
  const relativePath = taskLockPath(taskId);
  await assertSafePath(target, relativePath);
  const fullPath = ensureWithin(target, relativePath);

  if (!(await fileExists(fullPath))) {
    return { unlocked: false, message: "No active lock found" };
  }

  const existing = await readLockInfo(target, taskId);
  await unlink(fullPath);
  return { unlocked: true, previousLock: existing };
}

export async function withTaskLock(target, taskId, operationOrCallback, callback) {
  let operation = operationOrCallback;
  let fn = callback;
  if (typeof operationOrCallback === "function" && callback === undefined) {
    fn = operationOrCallback;
    operation = "mutation";
  }
  const lock = await acquireTaskLock(target, taskId, operation);
  try {
    return await fn(lock.lockData);
  } finally {
    await lock.release();
  }
}
