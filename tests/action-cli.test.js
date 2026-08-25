import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { proposeAction, transitionAction } from "../src/core/actions.js";
import { runActionRecord } from "../src/commands/action-record.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

test("host-reported transitions cannot skip states or claim ForgeLoop execution", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-action-cli-"));
  const taskId = "host-task";
  try {
    const { action } = await proposeAction(target, { packageRoot, taskId, input: {
      actionId: "action-host", effectClass: "REVERSIBLE_WRITE", capability: "network.write",
      target: "service/item", operation: "update item", idempotencyKey: "host:update:v1",
      requiredForCompletion: false, requirement: null, provenance: "HOST_REPORTED",
    } });
    await assert.rejects(transitionAction(target, { packageRoot, taskId,
      actionId: action.actionId, to: "COMMITTED" }),
    (error) => error.code === "E_ACTION_STATE_MISMATCH");
    const authorized = await transitionAction(target, { packageRoot, taskId,
      actionId: action.actionId, to: "AUTHORIZED" });
    assert.equal(authorized.provenance, "HOST_REPORTED");
    await assert.rejects(runActionRecord({ target, packageRoot, taskId,
      actionId: action.actionId, state: "STARTED", provenance: "FORGELOOP_EXECUTED" }),
    (error) => error.code === "E_ACTION_INVALID");
  } finally { await rm(target, { recursive: true, force: true }); }
});
