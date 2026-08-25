import test from "node:test";
import assert from "node:assert/strict";

import {
  TASK_ARTIFACT_FILES,
  PROJECT_ARTIFACT_PATHS,
  taskActionPath,
  taskApprovalPath,
  taskEvaluationPath,
  buildTaskArtifactPaths,
} from "../src/core/task-paths.js";

const TASK_ID = "some-task";

test("task artifact files declare action, approval, and evaluation directories", () => {
  assert.equal(TASK_ARTIFACT_FILES.actions, "actions");
  assert.equal(TASK_ARTIFACT_FILES.approvals, "approvals");
  assert.equal(TASK_ARTIFACT_FILES.evaluations, "evaluations");
  assert.equal(PROJECT_ARTIFACT_PATHS.capabilityPolicy, ".forgeloop/policy/capabilities.json");
});

test("action/approval/evaluation path builders accept valid IDs", () => {
  assert.match(taskActionPath(TASK_ID, "action-deploy-1"), /\/actions\/action-deploy-1\.json$/);
  assert.match(taskApprovalPath(TASK_ID, "approval-x_9"), /\/approvals\/approval-x_9\.json$/);
  assert.match(taskEvaluationPath(TASK_ID, "eval-standard"), /\/evaluations\/eval-standard\.json$/);
  const built = buildTaskArtifactPaths(TASK_ID);
  assert.ok(built.actions.endsWith("/actions"));
  assert.ok(built.approvals.endsWith("/approvals"));
  assert.ok(built.evaluations.endsWith("/evaluations"));
});

test("path builders reject traversal and malformed IDs", () => {
  const invalidIds = [
    undefined,
    null,
    "",
    "../x",
    "foo/bar",
    "foo\\bar",
    "/absolute/action-1",
    "action-../../escape",
    "exec-1",
    ".hidden",
  ];

  for (const id of invalidIds) {
    assert.throws(() => taskActionPath(TASK_ID, id), `action id ${id}`);
  }
  for (const id of invalidIds) {
    assert.throws(() => taskApprovalPath(TASK_ID, id), `approval id ${id}`);
  }
  for (const id of invalidIds) {
    assert.throws(() => taskEvaluationPath(TASK_ID, id), `evaluation id ${id}`);
  }

  // Cross-kind prefixes must not be accepted by another builder.
  assert.throws(() => taskActionPath(TASK_ID, "approval-1"));
  assert.throws(() => taskApprovalPath(TASK_ID, "action-1"));
});
