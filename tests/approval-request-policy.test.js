import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runApprovalRequest } from "../src/commands/approval-request.js";
import { proposeAction } from "../src/core/actions.js";
import { getPackageRoot } from "../src/core/templates.js";
import { taskApprovalPath } from "../src/core/task-paths.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";

const packageRoot = getPackageRoot();

async function withApprovalRequestPolicy(decision, run) {
  const taskId = `approval-request-${decision.toLowerCase().replaceAll("_", "-")}`;
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-approval-request-policy-"));
  try {
    await setupVerifyingTask(target, packageRoot, {
      taskId,
      capabilityPolicy: {
        schemaVersion: 1,
        defaultDecision: "DENY",
        rules: [{ capability: "filesystem.write", decision }],
      },
    });
    const { action } = await proposeAction(target, {
      packageRoot,
      taskId,
      input: {
        actionId: "action-approval-request",
        effectClass: "REVERSIBLE_WRITE",
        capability: "filesystem.write",
        target: "workspace/item",
        operation: "update item",
        idempotencyKey: `${taskId}:action:v1`,
        requiredForCompletion: true,
        requirement: "postcondition",
        provenance: "CALLER_REPORTED",
      },
    });
    await run({ target, taskId, action });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("approval-request is policy-aware and never mints an unnecessary approval", async () => {
  const cases = [
    ["ALLOW", "E_ACTION_APPROVAL_NOT_REQUIRED"],
    ["DENY", "E_ACTION_CAPABILITY_DENIED"],
    ["REQUIRE_AUTHORITY", "E_ACTION_AUTHORITY_REQUIRED"],
  ];

  for (const [decision, expectedCode] of cases) {
    await withApprovalRequestPolicy(decision, async ({ target, taskId, action }) => {
      await assert.rejects(
        runApprovalRequest({
          target,
          packageRoot,
          taskId,
          approvalId: "approval-not-created",
          actionId: action.actionId,
          reason: "should be rejected by current policy",
        }),
        (error) => error.code === expectedCode,
      );

      await assert.rejects(
        access(path.join(target, taskApprovalPath(taskId, "approval-not-created"))),
        (error) => error.code === "ENOENT",
      );
    });
  }
});

test("approval-request creates a pending approval only when policy requires it", async () => {
  await withApprovalRequestPolicy("REQUIRE_APPROVAL", async ({ target, taskId, action }) => {
    const result = await runApprovalRequest({
      target,
      packageRoot,
      taskId,
      approvalId: "approval-required",
      actionId: action.actionId,
      reason: "current policy requires approval",
    });

    assert.equal(result.created, true);
    await access(path.join(target, taskApprovalPath(taskId, "approval-required")));
  });
});
