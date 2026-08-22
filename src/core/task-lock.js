import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { taskLockPath } from "./task-paths.js";
import {
  E_PROJECT_CLAIMS_LOCK_INCONSISTENT,
  E_TASK_LOCKED,
} from "./error-codes.js";

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

/**
 * Structural identity requirements shared by every persisted lease lock.
 * Incomplete identity is UNKNOWN and is never eligible for stale release;
 * default lease values belong at creation time, never validation time.
 */
function hasLeaseIdentity(lock) {
  return typeof lock.lockId === "string"
    && lock.lockId !== ""
    && typeof lock.ownerInstanceId === "string"
    && lock.ownerInstanceId !== ""
    && typeof lock.operation === "string"
    && lock.operation !== ""
    && Number.isInteger(lock.leaseMs)
    && lock.leaseMs > 0;
}

export function isValidTaskLockIdentity(lock) {
  return Boolean(lock)
    && !lock.corrupted
    && typeof lock.taskId === "string"
    && lock.taskId !== ""
    && hasLeaseIdentity(lock);
}

export function isValidProjectClaimsLockIdentity(lock) {
  return Boolean(lock)
    && !lock.corrupted
    && lock.scope === "claims-reservation"
    && hasLeaseIdentity(lock);
}

function classifyLeaseWindow(lock, now) {
  const heartbeat = Date.parse(lock.heartbeatAt ?? lock.acquiredAt);
  if (!Number.isFinite(heartbeat)) return { status: "UNKNOWN", stale: false };
  return now > heartbeat + lock.leaseMs
    ? { status: "STALE", stale: true, expiresAt: new Date(heartbeat + lock.leaseMs).toISOString() }
    : { status: "LIVE", stale: false, expiresAt: new Date(heartbeat + lock.leaseMs).toISOString() };
}

export function classifyLockStaleness(lock, now = Date.now()) {
  if (!lock) return { status: "NONE", stale: false };
  if (lock.corrupted) return { status: "CORRUPT", stale: false };
  if (!isValidTaskLockIdentity(lock)) return { status: "UNKNOWN", stale: false };
  return classifyLeaseWindow(lock, now);
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

export function classifyProjectClaimsLock(lock, now = Date.now()) {
  if (!lock) return { status: "NONE", stale: false };
  if (lock.corrupted) return { status: "CORRUPT", stale: false };
  if (!isValidProjectClaimsLockIdentity(lock)) return { status: "UNKNOWN", stale: false };
  return classifyLeaseWindow(lock, now);
}

function projectClaimsLockError(classification, lockInfo, reason = null) {
  if (classification.status === "LIVE") {
    const error = new Error(
      `Project write claims reservation is locked by operation "${lockInfo?.operation ?? "unknown"}" (pid: ${lockInfo?.pid ?? "unknown"}, acquired: ${lockInfo?.acquiredAt ?? "unknown"}).`,
    );
    error.code = E_TASK_LOCKED;
    error.lockInfo = lockInfo;
    error.classification = classification;
    return error;
  }
  const error = new Error(
    `Project write claims lock ownership is ${classification.status}${reason ? ` (${reason})` : ""}; refusing unsafe claim mutation`,
  );
  error.code = E_PROJECT_CLAIMS_LOCK_INCONSISTENT;
  error.lockInfo = lockInfo;
  error.classification = classification;
  if (reason) error.reason = reason;
  return error;
}

export async function releaseStaleProjectClaimsLockIfUnchanged(target, expectedLock, { now = Date.now() } = {}) {
  await assertSafePath(target, CLAIMS_LOCK_REL_PATH);
  const fullPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);
  const expectedClassification = classifyProjectClaimsLock(expectedLock, now);
  if (expectedClassification.status !== "STALE") {
    return { released: false, reason: "EXPECTED_LOCK_NOT_STALE", classification: expectedClassification };
  }

  const quarantinePath = `${fullPath}.releasing-${randomUUID()}`;
  try {
    await rename(fullPath, quarantinePath);
  } catch (error) {
    if (error.code === "ENOENT") return { released: false, reason: "LOCK_MISSING" };
    throw error;
  }

  let observed;
  try {
    observed = JSON.parse(await readFile(quarantinePath, "utf8"));
  } catch {
    await restoreQuarantinedLock(quarantinePath, fullPath);
    return { released: false, reason: "LOCK_CORRUPT", classification: { status: "CORRUPT", stale: false } };
  }

  const observedClassification = classifyProjectClaimsLock(observed, now);
  if (!sameObservedLock(observed, expectedLock, { identityIsValid: isValidProjectClaimsLockIdentity })
    || observedClassification.status !== "STALE") {
    await restoreQuarantinedLock(quarantinePath, fullPath);
    return {
      released: false,
      reason: sameObservedLock(observed, expectedLock, { identityIsValid: isValidProjectClaimsLockIdentity })
        ? "LOCK_NOT_STALE"
        : "LOCK_CHANGED",
      currentLock: observed,
      classification: observedClassification,
    };
  }

  await unlink(quarantinePath);
  return { released: true, previousLock: observed, classification: observedClassification };
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

  let fileHandle = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fileHandle = await open(fullPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = await readProjectClaimsLockInfo(target);
      const classification = classifyProjectClaimsLock(existing);
      if (classification.status === "STALE" && attempt === 0) {
        const released = await releaseStaleProjectClaimsLockIfUnchanged(target, existing);
        if (released.released || released.reason === "LOCK_MISSING") continue;
        throw projectClaimsLockError(
          released.classification ?? { status: "UNKNOWN", stale: false },
          released.currentLock ?? existing,
          released.reason,
        );
      }
      throw projectClaimsLockError(classification, existing);
    }
  }
  if (!fileHandle) {
    throw projectClaimsLockError({ status: "UNKNOWN", stale: false }, null, "ACQUISITION_RETRY_EXHAUSTED");
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
  if (staleOnly) {
    if (!classification.stale) {
      return { unlocked: false, previousLock: existing, classification };
    }
    const released = await releaseStaleTaskLockIfUnchanged(target, taskId, existing);
    return {
      unlocked: released.released,
      previousLock: released.previousLock ?? existing,
      classification: released.classification ?? classification,
      ...(released.reason ? { reason: released.reason } : {}),
    };
  }
  await unlink(fullPath);
  return { unlocked: true, previousLock: existing, classification };
}

function sameObservedLock(left, right, { identityIsValid = isValidTaskLockIdentity } = {}) {
  if (!identityIsValid(left) || !identityIsValid(right)) return false;
  return left.lockId === right.lockId
    && left.heartbeatAt === right.heartbeatAt
    && left.ownerInstanceId === right.ownerInstanceId;
}

function sameObservedTaskLock(left, right, taskId) {
  return taskId !== null
    && sameObservedLock(left, right)
    && left.taskId === right.taskId
    && right.taskId === taskId;
}

async function restoreQuarantinedLock(quarantinePath, fullPath) {
  try {
    await link(quarantinePath, fullPath);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  } finally {
    try {
      await unlink(quarantinePath);
    } catch {
      // ignore an already-consumed quarantine entry
    }
  }
}

export async function releaseStaleTaskLockIfUnchanged(target, taskId, expectedLock, { now = Date.now() } = {}) {
  const relativePath = taskLockPath(taskId);
  await assertSafePath(target, relativePath);
  const fullPath = ensureWithin(target, relativePath);
  const expectedClassification = classifyLockStaleness(expectedLock, now);
  if (expectedClassification.status !== "STALE") {
    return { released: false, reason: "EXPECTED_LOCK_NOT_STALE", classification: expectedClassification };
  }

  const quarantinePath = `${fullPath}.releasing-${randomUUID()}`;
  try {
    await rename(fullPath, quarantinePath);
  } catch (error) {
    if (error.code === "ENOENT") return { released: false, reason: "LOCK_MISSING" };
    throw error;
  }

  let observed;
  try {
    observed = JSON.parse(await readFile(quarantinePath, "utf8"));
  } catch {
    await restoreQuarantinedLock(quarantinePath, fullPath);
    return { released: false, reason: "LOCK_CORRUPT" };
  }

  const observedClassification = classifyLockStaleness(observed, now);
  if (!sameObservedTaskLock(observed, expectedLock, taskId) || observedClassification.status !== "STALE") {
    await restoreQuarantinedLock(quarantinePath, fullPath);
    return {
      released: false,
      reason: sameObservedTaskLock(observed, expectedLock, taskId) ? "LOCK_NOT_STALE" : "LOCK_CHANGED",
      currentLock: observed,
      classification: observedClassification,
    };
  }

  await unlink(quarantinePath);
  return { released: true, previousLock: observed, classification: observedClassification };
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
