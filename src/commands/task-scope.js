import { resolveTaskContext } from "../core/task-context.js";
import { readTaskDescriptor, writeTaskDescriptor } from "../core/task-descriptor.js";
import { normalizeWriteClaims, assertNoScopeConflicts, assertScopeClean, assertScopeNotFrozen } from "../core/task-scope.js";
import { discoverTasks } from "../core/task-discovery.js";
import { readWorkState } from "../core/work-state.js";
import { withTaskLock } from "../core/task-lock.js";
import { E_TASK_NOT_FOUND } from "../core/error-codes.js";

function taskError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export async function runTaskScope({ target, packageRoot, taskId, claims } = {}) {
  const context = await resolveTaskContext(target, { taskOption: taskId, packageRoot });
  const effectiveTaskId = context.taskId;

  let descriptorArtifact;
  try {
    descriptorArtifact = await readTaskDescriptor(target, effectiveTaskId, packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") {
      throw taskError(E_TASK_NOT_FOUND, `Task descriptor not found for task: ${effectiveTaskId}`);
    }
    throw error;
  }

  const descriptor = descriptorArtifact.value;

  if (claims !== undefined && claims !== null) {
    const state = await readWorkState(target, { packageRoot, taskId: effectiveTaskId });
    if (state?.phase) {
      assertScopeNotFrozen(state.phase);
    }

    const normalizedClaims = normalizeWriteClaims(claims);
    const allTasks = await discoverTasks(target, packageRoot);
    assertNoScopeConflicts(normalizedClaims, allTasks, effectiveTaskId);
    if (normalizedClaims.length > 0) {
      await assertScopeClean(target, normalizedClaims);
    }

    return withTaskLock(target, effectiveTaskId, async () => {
      const updatedDescriptor = {
        ...descriptor,
        writeClaims: normalizedClaims,
        updatedAt: new Date().toISOString(),
      };
      await writeTaskDescriptor(target, updatedDescriptor, packageRoot);
      return {
        taskId: effectiveTaskId,
        taskKey: context.taskKey,
        writeClaims: updatedDescriptor.writeClaims,
        updated: true,
      };
    });
  }

  return {
    taskId: effectiveTaskId,
    taskKey: context.taskKey,
    writeClaims: descriptor.writeClaims ?? [],
    updated: false,
  };
}

export function formatTaskScopeResult(result) {
  const claims = result.writeClaims.length === 0 ? "none" : result.writeClaims.join(", ");
  const action = result.updated ? "updated scope" : "current scope";
  return `${action} for ${result.taskId}: ${claims}\n`;
}
