import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { auditReceipts } from "../scripts/audit-receipts.mjs";
import { taskDirectory } from "../src/core/task-paths.js";
import { removeTempTree } from "./helpers/rm-safe.js";

for (const count of [0, 1, 2]) test(`receipt CI handles ${count} supplied task receipts explicitly`, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "receipt-ci-"));
  t.after(() => removeTempTree(root));
  for (let i = 0; i < count; i += 1) {
    const taskId = `task-${i}`;
    const dir = path.join(root, taskDirectory(taskId));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "execution-receipt.json"), JSON.stringify({ taskId }));
  }
  const calls = [];
  const result = await auditReceipts({ root, execute: (args) => { calls.push(args); return { status: 0 }; } });
  assert.equal(result.status, count ? "VERIFIED" : "NOT_VERIFIED");
  assert.equal(calls.length, count);
  for (let i = 0; i < count; i += 1) assert.deepEqual(calls[i], ["src/cli.js", "audit", "--strict", "--task", `task-${i}`]);
  if (count) await assert.rejects(auditReceipts({ root, execute: () => ({ status: 1 }) }), /audit failed/u);
});
