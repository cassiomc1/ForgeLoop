import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendProtocolEvent, readEventTail } from "../src/core/events.js";
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
