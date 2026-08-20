import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { withTaskTransaction, findIncompleteTransactions, recoverIncompleteTransactions } from "../src/core/transaction.js";

test("withTaskTransaction publishes staged files only after callback completes", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    await withTaskTransaction({ target, taskId: "transaction-task", operation: "test" }, async (tx) => {
      await tx.stageText(".forgeloop/task-state/output.txt", "committed\n");
      assert.equal((await findIncompleteTransactions(target)).length, 1);
    });
    assert.equal(await readFile(path.join(target, ".forgeloop/task-state/output.txt"), "utf8"), "committed\n");
    assert.deepEqual(await findIncompleteTransactions(target), []);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("withTaskTransaction leaves an inspectable recovery record when the callback fails", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    await assert.rejects(() => withTaskTransaction({ target, taskId: "transaction-task", operation: "test" }, async (tx) => {
      await tx.stageText(".forgeloop/task-state/output.txt", "never published\n");
      throw new Error("injected failure");
    }), /injected failure/);
    const incomplete = await findIncompleteTransactions(target);
    assert.equal(incomplete.length, 1);
    assert.equal(incomplete[0].status, "ABANDONED");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("recoverIncompleteTransactions restores a pre-transaction file after an interrupted commit", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    const root = path.join(target, ".forgeloop/.txn/txn-interrupted");
    await mkdir(path.join(root, "backup/.forgeloop/task-state"), { recursive: true });
    await writeFile(path.join(root, "backup/.forgeloop/task-state/output.txt"), "before\n");
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      transactionId: "txn-interrupted",
      status: "COMMITTING",
      writes: [{ path: ".forgeloop/task-state/output.txt", hadPrevious: true, backupPending: true, backupCreated: true, published: true }],
    })}\n`);
    await mkdir(path.join(target, ".forgeloop/task-state"), { recursive: true });
    await writeFile(path.join(target, ".forgeloop/task-state/output.txt"), "partial\n");

    assert.deepEqual(await recoverIncompleteTransactions(target), [{ transactionId: "txn-interrupted", status: "ROLLED_BACK" }]);
    assert.equal(await readFile(path.join(target, ".forgeloop/task-state/output.txt"), "utf8"), "before\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
