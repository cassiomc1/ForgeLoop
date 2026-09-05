import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { withTaskTransaction, findIncompleteTransactions, recoverIncompleteTransactions } from "../src/core/transaction.js";
import { appendProtocolEvent, readEvents } from "../src/core/events.js";
import { getPackageRoot } from "../src/core/templates.js";
import { readJsonArtifact, writeJsonArtifact } from "../src/core/artifacts.js";

test("nested transaction for the same task reuses the active transaction", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    await withTaskTransaction({ target, taskId: "nested-task", operation: "outer" }, async (outer) => {
      await withTaskTransaction({ target, taskId: "nested-task", operation: "inner" }, async (inner) => {
        assert.equal(inner, outer);
        await inner.stageText(".forgeloop/task-state/nested.txt", "committed\n");
      });
    });
    assert.equal(await readFile(path.join(target, ".forgeloop/task-state/nested.txt"), "utf8"), "committed\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("nested transaction cannot cross task boundaries", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    await withTaskTransaction({ target, taskId: "outer-task", operation: "outer" }, async () => {
      await assert.rejects(
        withTaskTransaction({ target, taskId: "inner-task", operation: "inner" }, async () => {}),
        /cannot nest task transaction for inner-task inside outer-task/,
      );
    });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

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

test("withTaskTransaction stages append-only ledger deltas until commit", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  const relativePath = ".forgeloop/task-state/events.ndjson";
  try {
    await withTaskTransaction({ target, taskId: "append-transaction", operation: "test" }, async (tx) => {
      await tx.appendText(relativePath, "first\n");
      await tx.appendText(relativePath, "second\n");
      assert.equal(await tx.readText(relativePath), "first\nsecond\n");
      await assert.rejects(() => readFile(path.join(target, relativePath), "utf8"), { code: "ENOENT" });
    });
    assert.equal(await readFile(path.join(target, relativePath), "utf8"), "first\nsecond\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("withTaskTransaction stages deletion and publishes it only at commit", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  const relativePath = ".forgeloop/task-state/recovery.json";
  try {
    await mkdir(path.dirname(path.join(target, relativePath)), { recursive: true });
    await writeFile(path.join(target, relativePath), "recovery\n");

    await withTaskTransaction({ target, taskId: "delete-transaction", operation: "test" }, async (tx) => {
      assert.equal(typeof tx.stageDelete, "function");
      await tx.stageDelete(relativePath);
      assert.equal(await tx.readText(relativePath), null);
      assert.equal(await readFile(path.join(target, relativePath), "utf8"), "recovery\n");
    });

    await assert.rejects(() => readFile(path.join(target, relativePath), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("withTaskTransaction leaves no temporary atomic-write artifacts after durable publication", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    await withTaskTransaction({ target, taskId: "durable-transaction", operation: "test" }, async (tx) => {
      await tx.stageText(".forgeloop/task-state/output.txt", "durable\n");
    });
    const transactionRoot = path.join(target, ".forgeloop/.txn");
    const transactionIds = await readdir(transactionRoot);
    for (const transactionId of transactionIds) {
      const files = await readdir(path.join(transactionRoot, transactionId), { recursive: true });
      assert.equal(files.some((file) => file.endsWith(".tmp")), false);
    }
    assert.equal(await readFile(path.join(target, ".forgeloop/task-state/output.txt"), "utf8"), "durable\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("transaction commit witness is the final published ledger event", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  const packageRoot = getPackageRoot();
  try {
    await withTaskTransaction({ target, taskId: "witness-transaction", operation: "test", packageRoot, recordCommitEvent: true }, async (tx) => {
      await tx.stageText(".forgeloop/task-state/output.txt", "published-first\n");
      await appendProtocolEvent(target, { taskId: "witness-transaction", event: "TASK_RECEIVED" }, packageRoot, { taskId: "witness-transaction" });
    });
    assert.equal(await readFile(path.join(target, ".forgeloop/task-state/output.txt"), "utf8"), "published-first\n");
    const events = await readEvents(target, packageRoot, { taskId: "witness-transaction" });
    assert.equal(events.at(-1).event, "TRANSACTION_COMMITTED");
    assert.equal(events.at(-1).details.transactionId.startsWith("txn-"), true);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("task-scoped JSON artifacts stage through the active transaction", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  const packageRoot = getPackageRoot();
  const relativePath = ".forgeloop/task-state/config.json";
  try {
    await withTaskTransaction({ target, taskId: "artifact-transaction", operation: "test", packageRoot }, async () => {
      await writeJsonArtifact(target, relativePath, { schemaVersion: 1, protocolVersion: 1, complianceMode: "standard" }, "config", packageRoot, { taskId: "artifact-transaction" });
      await assert.rejects(() => readFile(path.join(target, relativePath), "utf8"), { code: "ENOENT" });
      assert.equal((await readJsonArtifact(target, relativePath, "config", packageRoot)).value.complianceMode, "standard");
    });
    assert.equal(JSON.parse(await readFile(path.join(target, relativePath), "utf8")).complianceMode, "standard");
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
    assert.deepEqual(incomplete, []);
    const ids = await readdir(path.join(target, ".forgeloop/.txn"));
    const manifest = JSON.parse(await readFile(path.join(target, ".forgeloop/.txn", ids[0], "manifest.json"), "utf8"));
    assert.equal(manifest.status, "ABORTED");
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

test("recoverIncompleteTransactions truncates an interrupted append to its recorded size", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    const root = path.join(target, ".forgeloop/.txn/txn-interrupted-append");
    const ledgerPath = path.join(target, ".forgeloop/task-state/events.ndjson");
    await mkdir(path.dirname(root), { recursive: true });
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, "before\nafter\n");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      transactionId: "txn-interrupted-append",
      status: "COMMITTING",
      writes: [{ path: ".forgeloop/task-state/events.ndjson", kind: "APPEND", originalSize: 7, appendStarted: true, published: false }],
    })}\n`);

    assert.deepEqual(await recoverIncompleteTransactions(target), [{ transactionId: "txn-interrupted-append", status: "ROLLED_BACK" }]);
    assert.equal(await readFile(ledgerPath, "utf8"), "before\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("recoverIncompleteTransactions rolls back an interrupted recovery publication", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    const transactionId = "txn-interrupted-task-recover";
    const root = path.join(target, `.forgeloop/.txn/${transactionId}`);
    const recoveryPath = path.join(target, ".forgeloop/task-state/task/recovery.json");
    const eventsPath = path.join(target, ".forgeloop/task-state/task/events.ndjson");
    await mkdir(root, { recursive: true });
    await mkdir(path.dirname(recoveryPath), { recursive: true });
    await writeFile(recoveryPath, "partially-published-recovery\n");
    await writeFile(eventsPath, "partially-published-event\n");
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      transactionId,
      status: "COMMITTING",
      writes: [
        {
          path: ".forgeloop/task-state/task/recovery.json",
          hadPrevious: false,
          published: true,
        },
        {
          path: ".forgeloop/task-state/task/events.ndjson",
          kind: "APPEND",
          originalSize: 0,
          appendStarted: true,
          published: true,
        },
      ],
    })}\n`);

    assert.deepEqual(await recoverIncompleteTransactions(target), [{ transactionId, status: "ROLLED_BACK" }]);
    await assert.rejects(() => readFile(recoveryPath, "utf8"), { code: "ENOENT" });
    await assert.rejects(() => readFile(eventsPath, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("recoverIncompleteTransactions restores recovery state after an interrupted resume", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-transaction-"));
  try {
    const transactionId = "txn-interrupted-task-resume";
    const root = path.join(target, `.forgeloop/.txn/${transactionId}`);
    const relativeRecoveryPath = ".forgeloop/task-state/task/recovery.json";
    const relativeEventsPath = ".forgeloop/task-state/task/events.ndjson";
    const recoveryPath = path.join(target, relativeRecoveryPath);
    const eventsPath = path.join(target, relativeEventsPath);
    await mkdir(path.join(root, "backup/.forgeloop/task-state/task"), { recursive: true });
    await mkdir(path.dirname(eventsPath), { recursive: true });
    await writeFile(path.join(root, `backup/${relativeRecoveryPath}`), "recovery-before-resume\n");
    await writeFile(eventsPath, "before\nafter\n");
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      transactionId,
      status: "COMMITTING",
      writes: [
        {
          path: relativeRecoveryPath,
          kind: "DELETE",
          hadPrevious: true,
          backupPending: true,
          backupCreated: true,
          published: true,
        },
        {
          path: relativeEventsPath,
          kind: "APPEND",
          originalSize: 7,
          appendStarted: true,
          published: true,
        },
      ],
    })}\n`);

    assert.deepEqual(await recoverIncompleteTransactions(target), [{ transactionId, status: "ROLLED_BACK" }]);
    assert.equal(await readFile(recoveryPath, "utf8"), "recovery-before-resume\n");
    assert.equal(await readFile(eventsPath, "utf8"), "before\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
