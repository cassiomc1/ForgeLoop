import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendProtocolEvent, readEventTail } from "../src/core/events.js";
import { canonicalFingerprint } from "../src/core/artifacts.js";
import { getPackageRoot } from "../src/core/templates.js";

test("ledger tail reads only the requested recent events", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-ledger-tail-"));
  try {
    for (let index = 0; index < 12; index += 1) {
      await appendProtocolEvent(target, { taskId: "tail-task", event: `OBSERVATION_${index}` }, getPackageRoot());
    }
    const tail = await readEventTail(target, getPackageRoot(), { limit: 3 });
    assert.deepEqual(tail.map((event) => event.seq), [10, 11, 12]);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("ledger tail remains bounded for a 100k-event NDJSON ledger", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-ledger-scale-"));
  try {
    const ledgerPath = path.join(target, ".forgeloop", "events.ndjson");
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    const hash = "a".repeat(64);
    const lines = [];
    for (let index = 1; index <= 100_000; index += 1) {
      lines.push(JSON.stringify({
        seq: index,
        schemaVersion: 1,
        protocolVersion: 1,
        taskId: "scale-ledger",
        event: "OBSERVATION",
        at: "2026-01-01T00:00:00.000Z",
        previousHash: index === 1 ? null : hash,
        hash,
      }));
    }
    await writeFile(ledgerPath, `${lines.join("\n")}\n`);

    const tail = await readEventTail(target, getPackageRoot(), { limit: 5 });
    assert.deepEqual(tail.map((event) => event.seq), [99_996, 99_997, 99_998, 99_999, 100_000]);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("ledger checkpoint is rebuilt when an externally changed tail no longer matches", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-ledger-index-"));
  const packageRoot = getPackageRoot();
  try {
    const first = await appendProtocolEvent(target, { taskId: "index-task", event: "OBSERVATION_ONE" }, packageRoot);
    const indexPath = path.join(target, ".forgeloop", "events.ndjson.index.json");
    assert.deepEqual(JSON.parse(await readFile(indexPath, "utf8")), {
      schemaVersion: 1,
      seq: 1,
      lastHash: first.hash,
    });

    const external = {
      seq: 2,
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "index-task",
      event: "OBSERVATION_EXTERNAL",
      at: "2026-01-01T00:00:00.000Z",
      previousHash: first.hash,
    };
    external.hash = canonicalFingerprint(external);
    await appendFile(path.join(target, ".forgeloop", "events.ndjson"), `${JSON.stringify(external)}\n`);

    const third = await appendProtocolEvent(target, { taskId: "index-task", event: "OBSERVATION_THREE" }, packageRoot);
    assert.equal(third.seq, 3);
    assert.equal(third.previousHash, external.hash);
    assert.deepEqual(JSON.parse(await readFile(indexPath, "utf8")), {
      schemaVersion: 1,
      seq: 3,
      lastHash: third.hash,
    });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
