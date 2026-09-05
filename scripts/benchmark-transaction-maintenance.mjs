#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { compactTransactions } from "../src/core/transaction-maintenance.js";
import { findIncompleteTransactions } from "../src/core/transaction.js";

const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-maintenance-benchmark-"));
try {
  const count = 1000;
  const payloadBytes = 4096;
  const payload = Buffer.alloc(payloadBytes);
  for (let offset = 0; offset < count; offset += 25) {
    await Promise.all(Array.from({ length: 25 }, async (_, index) => {
      const id = `txn-${offset + index}`;
      const root = path.join(target, ".forgeloop/.txn", id);
      await mkdir(path.join(root, "stage"), { recursive: true });
      await writeFile(path.join(root, "stage/payload"), payload);
      await writeFile(path.join(root, "manifest.json"), JSON.stringify({ transactionId: id, taskId: "benchmark", status: "COMMITTED", committedAt: "2020-01-01T00:00:00.000Z" }));
    }));
  }
  const inspectionStarted = performance.now();
  const incomplete = await findIncompleteTransactions(target);
  const inspectMs = performance.now() - inspectionStarted;
  const start = performance.now();
  const report = await compactTransactions({ target, apply: true });
  if (report.compacted !== count || report.bytes !== count * payloadBytes || incomplete.length || report.skipped.length) throw new Error(`Unexpected benchmark outcome: ${JSON.stringify(report)}`);
  console.log(JSON.stringify({ transactions: count, payloadBytesBefore: count * payloadBytes, payloadBytesAfter: 0, manifestsRetained: count, inspectMs, compactMs: performance.now() - start, node: process.version, platform: process.platform }));
} finally {
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
