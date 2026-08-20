import { resolveTaskContext } from "../core/task-context.js";
import { classifyLockStaleness, readLockInfo } from "../core/task-lock.js";

export async function runTaskLockStatus({ target, packageRoot, taskId } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const lock = await readLockInfo(target, context.taskId);
  if (!lock) {
    return {
      taskId: context.taskId,
      taskKey: context.taskKey,
      status: "UNLOCKED",
      lock: null,
      classification: null,
    };
  }
  const classification = classifyLockStaleness(lock);
  return {
    taskId: context.taskId,
    taskKey: context.taskKey,
    status: classification.status,
    lock,
    classification,
  };
}

export function formatTaskLockStatusResult(result) {
  if (result.status === "UNLOCKED") return `Task ${result.taskId} is unlocked\n`;
  return `Task ${result.taskId} lock: ${result.status} (${result.lock.operation ?? "unknown operation"})\n`;
}
