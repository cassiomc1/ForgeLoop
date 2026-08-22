import { discoverTasks } from "../core/task-discovery.js";

export async function runTaskList({ target, packageRoot } = {}) {
  const tasks = await discoverTasks(target, packageRoot);
  return {
    tasks: tasks.map((task) => {
      if (task.healthy === false) {
        return {
          taskId: task.taskId ?? null,
          taskKey: task.taskKey,
          directory: task.directory,
          healthy: false,
          error: task.error,
        };
      }
      return {
        taskId: task.taskId,
        taskKey: task.taskKey,
        directory: task.directory,
        healthy: true,
        phase: task.phase,
        writeClaims: task.writeClaims ?? [],
        historicalWriteClaims: task.historicalWriteClaims ?? [],
        effectiveWriteClaims: task.effectiveWriteClaims ?? [],
        claimState: task.claimState,
        recovery: task.recovery,
        mutationAllowed: task.mutationAllowed,
        locked: task.locked,
        hasContinuity: task.hasContinuity,
        hasReceipt: task.hasReceipt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }),
  };
}

export function formatTaskListResult(result) {
  if (result.tasks.length === 0) {
    return "no tasks found\n";
  }
  const lines = ["Tasks:"];
  for (const task of result.tasks) {
    if (task.healthy === false) {
      lines.push(`- ${task.taskKey} [CORRUPT]: ${task.error?.message ?? "unhealthy task namespace"}`);
    } else {
      const lockStr = task.locked ? " [LOCKED]" : "";
      const recoveryStr = task.claimState === "RELEASED_BY_RECOVERY" ? " [RECOVERED]" : "";
      const claimsStr = task.writeClaims.length > 0 ? ` (claims: ${task.writeClaims.join(", ")})` : "";
      lines.push(`- ${task.taskId}: ${task.phase ?? "UNINITIALIZED"}${lockStr}${recoveryStr}${claimsStr}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
