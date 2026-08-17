import { createHash } from "node:crypto";
import {
  E_TASK_DESCRIPTOR_INVALID,
  E_TASK_KEY_MISMATCH,
  E_TASK_REQUIRED,
} from "./error-codes.js";

const TASK_KEY_REGEX = /^[a-f0-9]{64}$/;

export function taskStorageKey(taskId) {
  assertTaskId(taskId);
  return createHash("sha256")
    .update(taskId, "utf8")
    .digest("hex");
}

export function assertTaskId(taskId, label = "taskId") {
  if (typeof taskId !== "string" || taskId.trim() === "") {
    const error = new Error(`${label} must be a non-empty string`);
    error.code = E_TASK_REQUIRED;
    throw error;
  }
  if (taskId.length > 256) {
    const error = new Error(`${label} must not exceed 256 characters`);
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }
  return taskId;
}

export function assertTaskKey(taskKey, label = "taskKey") {
  if (typeof taskKey !== "string" || !TASK_KEY_REGEX.test(taskKey)) {
    const error = new Error(`${label} must be a 64-character lowercase hexadecimal string`);
    error.code = E_TASK_KEY_MISMATCH;
    throw error;
  }
  return taskKey;
}

export function assertTaskDescriptorIdentity(descriptor, expectedTaskId = null, expectedTaskKey = null) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    const error = new Error("Task descriptor must be a valid object");
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  assertTaskId(descriptor.taskId, "descriptor.taskId");
  assertTaskKey(descriptor.taskKey, "descriptor.taskKey");

  const derivedKey = taskStorageKey(descriptor.taskId);
  if (descriptor.taskKey !== derivedKey) {
    const error = new Error(
      `Task key mismatch: descriptor has "${descriptor.taskKey}", but hash of "${descriptor.taskId}" is "${derivedKey}"`,
    );
    error.code = E_TASK_KEY_MISMATCH;
    throw error;
  }

  if (expectedTaskId && descriptor.taskId !== expectedTaskId) {
    const error = new Error(
      `Task ID mismatch: expected "${expectedTaskId}", but descriptor contains "${descriptor.taskId}"`,
    );
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  if (expectedTaskKey && descriptor.taskKey !== expectedTaskKey) {
    const error = new Error(
      `Task key mismatch: expected "${expectedTaskKey}", but descriptor contains "${descriptor.taskKey}"`,
    );
    error.code = E_TASK_KEY_MISMATCH;
    throw error;
  }

  return descriptor;
}
