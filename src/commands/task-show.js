import { resolveTaskContext } from "../core/task-context.js";
import { readTaskDescriptor } from "../core/task-descriptor.js";
import { readLockInfo } from "../core/task-lock.js";
import { taskDirectory, taskArtifactPath } from "../core/task-paths.js";
import { readWorkState } from "../core/work-state.js";
import { readContract } from "../core/contract.js";
import { fileExists, ensureWithin } from "../core/filesystem.js";
import { E_TASK_NOT_FOUND } from "../core/error-codes.js";

function taskError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export async function runTaskShow({ target, packageRoot, taskId } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const effectiveTaskId = context.taskId;

  let descriptor = null;
  try {
    const descArtifact = await readTaskDescriptor(target, effectiveTaskId, packageRoot);
    descriptor = descArtifact.value;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") {
      throw taskError(E_TASK_NOT_FOUND, `Task descriptor not found for task: ${effectiveTaskId}`);
    }
    throw error;
  }

  const state = await readWorkState(target, { packageRoot, taskId: effectiveTaskId });
  let contract = null;
  try {
    const contractArtifact = await readContract(target, packageRoot, { taskId: effectiveTaskId });
    contract = contractArtifact.value;
  } catch {
    // contract may not be present
  }

  const lockInfo = await readLockInfo(target, effectiveTaskId);
  const artifacts = {};
  for (const name of ["contract", "route", "state", "preflight", "receipt", "continuity", "events"]) {
    const rel = taskArtifactPath(effectiveTaskId, name);
    artifacts[name] = {
      path: rel,
      exists: await fileExists(ensureWithin(target, rel)),
    };
  }

  return {
    taskId: effectiveTaskId,
    taskKey: context.taskKey,
    directory: taskDirectory(effectiveTaskId),
    phase: state?.phase ?? "UNINITIALIZED",
    writeClaims: descriptor.writeClaims ?? [],
    lock: lockInfo,
    contract: contract ? { title: contract.title ?? null, taskType: contract.taskType ?? null } : null,
    artifacts,
    createdAt: descriptor.createdAt,
    updatedAt: descriptor.updatedAt,
  };
}

export function formatTaskShowResult(result) {
  const claims = result.writeClaims.length === 0 ? "none" : result.writeClaims.join(", ");
  const lockStatus = result.lock.locked ? `locked by PID ${result.lock.pid} since ${result.lock.acquiredAt}` : "unlocked";
  const lines = [
    `Task: ${result.taskId}`,
    `Key: ${result.taskKey}`,
    `Directory: ${result.directory}`,
    `Phase: ${result.phase}`,
    `Write Claims: ${claims}`,
    `Lock: ${lockStatus}`,
    `Created: ${result.createdAt}`,
    `Updated: ${result.updatedAt}`,
  ];
  return `${lines.join("\n")}\n`;
}
