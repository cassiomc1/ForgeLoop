import { lstat, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafePath, ensureWithin, fileExists, writeFileAtomic } from "./filesystem.js";
import { withTaskLock } from "./task-lock.js";

const ROOT = ".forgeloop/.txn";
const TERMINAL = new Set(["COMMITTED", "ROLLED_BACK", "ABORTED"]);
const DAY_MS = 86_400_000;

async function payloadBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    const metadata = await lstat(child);
    if (metadata.isSymbolicLink()) throw new Error("Transaction payload contains a symlink");
    if (metadata.isDirectory()) bytes += await payloadBytes(child);
    else if (metadata.isFile()) bytes += metadata.size;
    else throw new Error("Transaction payload contains a special file");
  }
  return bytes;
}

/** Compact terminal payloads only; preserve manifests and all event ledgers. */
export async function compactTransactions({ target, retainDays = 7, apply = false, now = Date.now() } = {}) {
  if (!Number.isFinite(retainDays) || retainDays < 1) throw new Error("retainDays must be at least one day");
  await assertSafePath(target, ROOT);
  const root = ensureWithin(target, ROOT);
  const report = { apply, scanned: 0, eligible: 0, bytes: 0, compacted: 0, skipped: [] };
  if (!await fileExists(root)) return report;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    report.scanned += 1;
    const relative = `${ROOT}/${entry.name}`;
    const manifestPath = `${relative}/manifest.json`;
    try {
      await assertSafePath(target, manifestPath);
      const original = JSON.parse(await readFile(ensureWithin(target, manifestPath), "utf8"));
      const lockTaskId = original.lockTaskId ?? original.taskId;
      if (typeof lockTaskId !== "string" || !lockTaskId) throw new Error("Missing lock identity");
      await withTaskLock(target, lockTaskId, "compact-transactions", async () => {
        const manifest = JSON.parse(await readFile(ensureWithin(target, manifestPath), "utf8"));
        if ((manifest.lockTaskId ?? manifest.taskId) !== lockTaskId || manifest.transactionId !== entry.name) throw new Error("Changed transaction identity");
        const timestamp = Date.parse(manifest.committedAt ?? manifest.recoveredAt ?? manifest.failedAt ?? manifest.startedAt);
        if (!TERMINAL.has(manifest.status) || !Number.isFinite(timestamp) || now - timestamp < retainDays * DAY_MS) return;
        const payloads = [];
        let bytes = 0;
        for (const name of ["stage", "backup"]) {
          const payload = `${relative}/${name}`;
          await assertSafePath(target, payload);
          const fullPath = ensureWithin(target, payload);
          if (await fileExists(fullPath)) {
            bytes += await payloadBytes(fullPath);
            payloads.push(fullPath);
          }
        }
        if (!payloads.length) return;
        report.eligible += 1;
        report.bytes += bytes;
        if (!apply) return;
        for (const payload of payloads) await rm(payload, { recursive: true, force: true, maxRetries: 3 });
        manifest.compactedAt = new Date(now).toISOString();
        await writeFileAtomic(ensureWithin(target, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
        report.compacted += 1;
      });
    } catch (error) {
      report.skipped.push({ transactionId: entry.name, reason: error.message });
    }
  }
  return report;
}
