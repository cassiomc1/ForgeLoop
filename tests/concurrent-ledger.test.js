import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { appendProtocolEvent, readEvents } from "../src/core/events.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

test("concurrent event writers serialize a shared ledger without duplicate sequence numbers", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-concurrent-ledger-"));
  try {
    await Promise.all([
      appendProtocolEvent(target, { taskId: "concurrent-a", event: "CONTRACT_VALIDATED" }, packageRoot),
      appendProtocolEvent(target, { taskId: "concurrent-b", event: "CONTRACT_VALIDATED" }, packageRoot),
    ]);
    const events = await readEvents(target, packageRoot);
    assert.deepEqual(events.map((event) => event.seq), [1, 2]);
    assert.equal(new Set(events.map((event) => event.seq)).size, 2);
    assert.equal(events[0].previousHash, null);
    assert.equal(events[1].previousHash, events[0].hash);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
