import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
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

export function classifyLockStaleness(lock, now = Date.now()) {
  if (!lock || lock.corrupted) return { status: "UNKNOWN", stale: false };
  const heartbeat = Date.parse(lock.heartbeatAt ?? lock.acquiredAt);
  const leaseMs = Number.isInteger(lock.leaseMs) && lock.leaseMs > 0 ? lock.leaseMs : 300000;
  if (!Number.isFinite(heartbeat)) return { status: "UNKNOWN", stale: false };
  return now > heartbeat + leaseMs
    ? { status: "STALE", stale: true, expiresAt: new Date(heartbeat + leaseMs).toISOString() }
    : { status: "LIVE", stale: false, expiresAt: new Date(heartbeat + leaseMs).toISOString() };
}

/**
 * PID values can be reused. Pairing the PID with the process start epoch gives
 * a portable, serializable ownership token without a daemon or platform-only
 * process inspector. Consumers must still treat remote owners as unknown.
 */
export function currentProcessStartToken(now = Date.now(), uptimeSeconds = process.uptime()) {
  return `${process.pid}:${Math.max(0, Math.floor(now - (uptimeSeconds * 1000)))}`;
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

  const acquiredAt = new Date().toISOString();
  const lockData = {
    lockId: randomUUID(),
    scope: "claims-reservation",
    operation,
    pid: process.pid,
    hostname: os.hostname(),
    processStartToken: currentProcessStartToken(),
    ownerInstanceId: randomUUID(),
    acquiredAt,
    heartbeatAt: acquiredAt,
    leaseMs: 300000,
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

  const acquiredAt = new Date().toISOString();
  const lockData = {
    lockId: randomUUID(),
    taskId,
    operation,
    pid: process.pid,
    hostname: os.hostname(),
    processStartToken: currentProcessStartToken(),
    ownerInstanceId: randomUUID(),
    acquiredAt,
    heartbeatAt: acquiredAt,
    leaseMs: 300000,
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

export async function forceUnlockTask(target, taskId, { staleOnly = false } = {}) {
  const relativePath = taskLockPath(taskId);
  await assertSafePath(target, relativePath);
  const fullPath = ensureWithin(target, relativePath);

  if (!(await fileExists(fullPath))) {
    return { unlocked: false, message: "No active lock found" };
  }

  const existing = await readLockInfo(target, taskId);
  const classification = classifyLockStaleness(existing);
  if (staleOnly && !classification.stale) {
    return { unlocked: false, previousLock: existing, classification };
  }
  await unlink(fullPath);
  return { unlocked: true, previousLock: existing, classification };
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
