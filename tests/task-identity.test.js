import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertTaskDescriptorIdentity,
  assertTaskId,
  assertTaskKey,
  taskStorageKey,
} from "../src/core/task-identity.js";

test("task identity is deterministic and descriptor validation binds both task ID and storage key", () => {
  const taskId = "identity-coverage-task";
  const taskKey = taskStorageKey(taskId);
  const descriptor = { taskId, taskKey };
  assert.equal(assertTaskDescriptorIdentity(descriptor, taskId, taskKey), descriptor);
  assert.equal(assertTaskId(taskId), taskId);
  assert.equal(assertTaskKey(taskKey), taskKey);
});

test("task identity rejects malformed descriptors and selector mismatches", () => {
  const taskId = "identity-coverage-task";
  const taskKey = taskStorageKey(taskId);
  assert.throws(
    () => assertTaskDescriptorIdentity(null),
    (error) => error.code === "E_TASK_DESCRIPTOR_INVALID",
  );
  assert.throws(
    () => assertTaskDescriptorIdentity({ taskId, taskKey: "a".repeat(64) }),
    (error) => error.code === "E_TASK_KEY_MISMATCH",
  );
  assert.throws(
    () => assertTaskDescriptorIdentity({ taskId, taskKey }, "other-task"),
    (error) => error.code === "E_TASK_DESCRIPTOR_INVALID",
  );
  assert.throws(
    () => assertTaskDescriptorIdentity({ taskId, taskKey }, taskId, "b".repeat(64)),
    (error) => error.code === "E_TASK_KEY_MISMATCH",
  );
  assert.throws(
    () => assertTaskId("x".repeat(257)),
    (error) => error.code === "E_TASK_DESCRIPTOR_INVALID",
  );
  assert.throws(
    () => assertTaskKey("../unsafe"),
    (error) => error.code === "E_TASK_KEY_MISMATCH",
  );
});
