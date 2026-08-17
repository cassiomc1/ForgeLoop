import { resolveTaskContext } from "../core/task-context.js";
import { forceUnlockTask, readLockInfo } from "../core/task-lock.js";

export async function runTaskUnlock({ target, packageRoot, taskId, force = false } = {}) {
  const context = await resolveTaskContext(target, { taskOption: taskId, packageRoot });
  const effectiveTaskId = context.taskId;

  const lockInfo = await readLockInfo(target, effectiveTaskId);
  if (!lockInfo) {
    return {
      taskId: effectiveTaskId,
      taskKey: context.taskKey,
      unlocked: false,
      message: "Task is not locked",
    };
  }

  if (!force) {
    const error = new Error(`Task ${effectiveTaskId} is locked by operation "${lockInfo.operation ?? "unknown"}" (PID ${lockInfo.pid ?? "unknown"}). Use --force to unlock.`);
    error.code = "E_TASK_LOCKED";
    throw error;
  }

  await forceUnlockTask(target, effectiveTaskId);
  return {
    taskId: effectiveTaskId,
    taskKey: context.taskKey,
    unlocked: true,
    message: `Released lock for task ${effectiveTaskId}`,
  };
}

export function formatTaskUnlockResult(result) {
  return `${result.message}\n`;
}
