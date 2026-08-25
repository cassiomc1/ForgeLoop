import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { proposeAction, validateActionLedgerConsistency } from "../src/core/actions.js";
import { taskActionPath, taskApprovalPath, taskEvaluationPath } from "../src/core/task-paths.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

test("action, approval, and evaluation IDs reject traversal", () => {
  assert.throws(() => taskActionPath("task", "../x"));
  assert.throws(() => taskApprovalPath("task", "approval-../x"));
  assert.throws(() => taskEvaluationPath("task", "eval-../../x"));
});

test("forged action artifact without a matching proposal is audit-visible", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-action-security-"));
  try {
    const taskId = "security-task";
    const { action } = await proposeAction(target, { packageRoot, taskId, input: {
      actionId: "action-safe", effectClass: "REVERSIBLE_WRITE", capability: "filesystem.write",
      target: "file", operation: "write", idempotencyKey: "security:file:v1", requiredForCompletion: false,
      requirement: null, provenance: "HOST_REPORTED",
    } });
    const actionPath = taskActionPath(taskId, action.actionId);
    await writeFile(path.join(target, actionPath), JSON.stringify({ ...action, actionId: "action-forged" }), "utf8");
    const issues = await validateActionLedgerConsistency(target, { packageRoot, taskId });
    assert.ok(issues.some((issue) => issue.code === "E_ACTION_EVIDENCE_INVALID"));
  } finally { await rm(target, { recursive: true, force: true }); }
});
