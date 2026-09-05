import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { compactTransactions } from "../src/core/transaction-maintenance.js";
import { withTaskLock } from "../src/core/task-lock.js";
import { removeTempTree } from "./helpers/rm-safe.js";

test("compaction preserves history, ambiguity, recent payloads and locked tasks", async (t) => {
  const target = await mkdtemp(path.join(os.tmpdir(), "txn-compact-"));
  t.after(() => removeTempTree(target));
  const now = Date.now();
  for (const [id, status, age] of [["old", "COMMITTED", 10], ["rollback", "ROLLED_BACK", 10], ["ambiguous", "COMMITTING", 10], ["recent", "COMMITTED", 0], ["locked", "ABORTED", 10]]) {
    const root = path.join(target, ".forgeloop/.txn", id);
    await mkdir(path.join(root, "stage"), { recursive: true });
    await writeFile(path.join(root, "stage/payload"), "payload");
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({ transactionId: id, taskId: id, status, startedAt: new Date(now - age * 86400000).toISOString() }));
  }
  const preview = await compactTransactions({ target, now });
  assert.equal(preview.eligible, 3);
  assert.equal(preview.bytes, 21);
  assert.equal(preview.compacted, 0);
  await withTaskLock(target, "locked", "test", async () => {
    const report = await compactTransactions({ target, now, apply: true });
    assert.equal(report.compacted, 2);
    assert.equal(report.skipped.length, 1);
  });
  for (const id of ["old", "rollback"]) {
    assert.ok(JSON.parse(await readFile(path.join(target, ".forgeloop/.txn", id, "manifest.json"))).compactedAt);
    await assert.rejects(readFile(path.join(target, ".forgeloop/.txn", id, "stage/payload")), { code: "ENOENT" });
  }
  for (const id of ["ambiguous", "recent", "locked"]) assert.equal(await readFile(path.join(target, ".forgeloop/.txn", id, "stage/payload"), "utf8"), "payload");
  const outside = path.join(target, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "keep"), "keep");
  await symlink(outside, path.join(target, ".forgeloop/.txn/locked/backup"), process.platform === "win32" ? "junction" : "dir");
  const unsafe = await compactTransactions({ target, now, apply: true });
  assert.equal(unsafe.compacted, 0);
  assert.equal(await readFile(path.join(outside, "keep"), "utf8"), "keep");
});
