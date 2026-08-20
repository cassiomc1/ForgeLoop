import { resolveTaskContext } from "../core/task-context.js";
import { classifyLockStaleness, forceUnlockTask, readLockInfo } from "../core/task-lock.js";

export async function runTaskUnlock({ target, packageRoot, taskId, force = false, staleOnly = false } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
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

  const classification = classifyLockStaleness(lockInfo);
  if (!force && !(staleOnly && classification.stale)) {
    const error = new Error(`Task ${effectiveTaskId} is locked by operation "${lockInfo.operation ?? "unknown"}" (PID ${lockInfo.pid ?? "unknown"}). Use --force to unlock.`);
    error.code = "E_TASK_LOCKED";
    throw error;
  }

  const unlocked = await forceUnlockTask(target, effectiveTaskId, { staleOnly });
  return {
    taskId: effectiveTaskId,
    taskKey: context.taskKey,
    unlocked: unlocked.unlocked,
    classification: unlocked.classification,
    message: unlocked.unlocked ? `Released lock for task ${effectiveTaskId}` : `Task ${effectiveTaskId} lock is not stale`,
  };
}

export function formatTaskUnlockResult(result) {
  return `${result.message}\n`;
}
