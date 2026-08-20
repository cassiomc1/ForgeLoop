import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readdir, readFile, rename, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

import { assertSafePath, ensureWithin, fileExists, writeFileAtomic } from "./filesystem.js";
import { withTaskLock } from "./task-lock.js";
import { E_TASK_LOCKED } from "./error-codes.js";

const TRANSACTION_ROOT = ".forgeloop/.txn";
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const transactionContext = new AsyncLocalStorage();

export function getActiveTaskTransaction() {
  return transactionContext.getStore() ?? null;
}

function transactionPath(transactionId) {
  return `${TRANSACTION_ROOT}/${transactionId}`;
}

async function writeManifest(target, relativePath, manifest) {
  await writeFileAtomic(ensureWithin(target, relativePath), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function findIncompleteTransactions(target) {
  const root = ensureWithin(target, TRANSACTION_ROOT);
  if (!(await fileExists(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(path.join(root, entry.name, "manifest.json"), "utf8"));
      if (manifest.status !== "COMMITTED") found.push(manifest);
    } catch {
      found.push({ transactionId: entry.name, status: "ABANDONED", malformed: true });
    }
  }
  return found;
}

function writePath(entry) {
  return typeof entry === "string" ? entry : entry.path;
}

async function rollbackPublishedWrites(target, root, manifest) {
  const writes = [...manifest.writes].reverse();
  for (const entry of writes) {
    const relativePath = writePath(entry);
    if (!entry || typeof entry !== "object" || (!entry.published && !entry.backupPending && !entry.backupCreated)) continue;
    const destination = ensureWithin(target, relativePath);
    const backup = ensureWithin(target, `${root}/backup/${relativePath}`);
    if (entry.published && await fileExists(destination)) await unlink(destination);
    if (entry.hadPrevious && await fileExists(backup)) {
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(backup, destination);
    }
  }
}

export async function recoverIncompleteTransactions(target) {
  const rootPath = ensureWithin(target, TRANSACTION_ROOT);
  if (!(await fileExists(rootPath))) return [];
  const recovered = [];
  for (const entry of await readdir(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const root = transactionPath(entry.name);
    const manifestPath = `${root}/manifest.json`;
    try {
      const manifest = JSON.parse(await readFile(ensureWithin(target, manifestPath), "utf8"));
      if (manifest.status !== "COMMITTING") continue;
      await rollbackPublishedWrites(target, root, manifest);
      manifest.status = "ROLLED_BACK";
      manifest.recoveredAt = new Date().toISOString();
      await writeManifest(target, manifestPath, manifest);
      recovered.push({ transactionId: manifest.transactionId, status: manifest.status });
    } catch (error) {
      recovered.push({ transactionId: entry.name, status: "RECOVERY_FAILED", error: error.message });
    }
  }
  return recovered;
}

export async function withTaskTransaction({ target, taskId, lockTaskId = taskId, operation = "mutation" } = {}, callback) {
  if (!target || !taskId) throw new Error("target and taskId are required for a task transaction");
  const started = Date.now();
  const runWithLock = async () => withTaskLock(target, lockTaskId, operation, async (lock) => {
    const transactionId = `txn-${randomUUID()}`;
    const root = transactionPath(transactionId);
    const stageRoot = `${root}/stage`;
    const manifestPath = `${root}/manifest.json`;
    await assertSafePath(target, manifestPath);
    await mkdir(ensureWithin(target, stageRoot), { recursive: true });
    const manifest = { schemaVersion: 1, transactionId, taskId, operation, lockId: lock.lockId, startedAt: new Date().toISOString(), status: "STAGING", writes: [] };
    await writeManifest(target, manifestPath, manifest);
    const tx = {
      transactionId,
      lock,
      async readText(relativePath) {
        await assertSafePath(target, relativePath);
        const staged = ensureWithin(target, `${stageRoot}/${relativePath}`);
        if (await fileExists(staged)) return readFile(staged, "utf8");
        const destination = ensureWithin(target, relativePath);
        if (!(await fileExists(destination))) return null;
        return readFile(destination, "utf8");
      },
      async stageText(relativePath, text) {
        await assertSafePath(target, relativePath);
        const staged = `${stageRoot}/${relativePath}`;
        await assertSafePath(target, staged);
        await writeFileAtomic(ensureWithin(target, staged), text);
        if (!manifest.writes.some((entry) => writePath(entry) === relativePath)) {
          manifest.writes.push({ path: relativePath, hadPrevious: false, published: false });
        }
        await writeManifest(target, manifestPath, manifest);
      },
    };
    try {
      const result = await transactionContext.run(tx, () => callback(tx));
      manifest.status = "COMMITTING";
      await writeManifest(target, manifestPath, manifest);
      for (const entry of manifest.writes) {
        const relativePath = writePath(entry);
        const staged = ensureWithin(target, `${stageRoot}/${relativePath}`);
        const destination = ensureWithin(target, relativePath);
        const backup = ensureWithin(target, `${root}/backup/${relativePath}`);
        await mkdir(path.dirname(destination), { recursive: true });
        entry.hadPrevious = await fileExists(destination);
        if (entry.hadPrevious) {
          entry.backupPending = true;
          await writeManifest(target, manifestPath, manifest);
          await mkdir(path.dirname(backup), { recursive: true });
          await rename(destination, backup);
          entry.backupCreated = true;
        }
        await writeManifest(target, manifestPath, manifest);
        await rename(staged, destination);
        entry.published = true;
        await writeManifest(target, manifestPath, manifest);
      }
      manifest.status = "COMMITTED";
      manifest.committedAt = new Date().toISOString();
      await writeManifest(target, manifestPath, manifest);
      return result;
    } catch (error) {
      if (manifest.status === "COMMITTING") {
        try {
          await rollbackPublishedWrites(target, root, manifest);
          manifest.status = "ROLLED_BACK";
          manifest.recoveredAt = new Date().toISOString();
        } catch (rollbackError) {
          manifest.status = "ABANDONED";
          manifest.rollbackError = { message: rollbackError.message };
        }
      } else {
        manifest.status = "ABANDONED";
      }
      manifest.failedAt = new Date().toISOString();
      manifest.error = { message: error.message };
      await writeManifest(target, manifestPath, manifest);
      throw error;
    }
  });
  while (true) {
    try {
      return await runWithLock();
    } catch (error) {
      if (error.code !== E_TASK_LOCKED || Date.now() - started >= LOCK_WAIT_TIMEOUT_MS) throw error;
      await delay(20);
    }
  }
}
