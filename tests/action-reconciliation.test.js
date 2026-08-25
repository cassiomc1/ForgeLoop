import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { proposeAction, transitionAction } from "../src/core/actions.js";
import { reconcileAction } from "../src/core/action-reconciliation.js";
import { getPackageRoot } from "../src/core/templates.js";
const packageRoot = getPackageRoot();

async function ambiguous(suffix) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-reconcile-"));
  const taskId = `task-${suffix}`;
  const { action } = await proposeAction(target, { packageRoot, taskId, input: {
    actionId: `action-${suffix}`, effectClass: "EXTERNAL_PUBLICATION", capability: "external.publish",
    target: "registry/release", operation: "publish", idempotencyKey: `publish:${suffix}`,
    requiredForCompletion: true, requirement: "publication", provenance: "HOST_REPORTED" } });
  await transitionAction(target, { packageRoot, taskId, actionId: action.actionId, to: "AUTHORIZED" });
  await transitionAction(target, { packageRoot, taskId, actionId: action.actionId, to: "STARTED" });
  const unknown = await transitionAction(target, { packageRoot, taskId, actionId: action.actionId, to: "COMMIT_UNKNOWN" });
  return { target, taskId, action: unknown };
}

for (const [outcome, state] of [["COMMITTED", "COMMITTED"], ["NOT_COMMITTED", "AUTHORIZED"], ["UNKNOWN", "COMMIT_UNKNOWN"]]) {
  test(`reconciliation ${outcome} produces ${state}`, async () => {
    const f = await ambiguous(outcome.toLowerCase());
    try {
      const result = await reconcileAction({ target: f.target, packageRoot, taskId: f.taskId,
        actionId: f.action.actionId, outcome, evidenceRefs: ["external:observation"] });
      assert.equal(result.action.state, state);
    } finally { await rm(f.target, { recursive: true, force: true }); }
  });
}
