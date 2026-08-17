import { discoverTasks } from "../core/task-discovery.js";

export async function runTaskList({ target, packageRoot } = {}) {
  const tasks = await discoverTasks(target, packageRoot);
  return {
    tasks: tasks.map((task) => ({
      taskId: task.taskId,
      taskKey: task.taskKey,
      directory: task.directory,
      phase: task.phase,
      writeClaims: task.writeClaims ?? [],
      locked: task.locked,
      hasContinuity: task.hasContinuity,
      hasReceipt: task.hasReceipt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
  };
}

export function formatTaskListResult(result) {
  if (result.tasks.length === 0) {
    return "no tasks found\n";
  }
  const lines = ["Tasks:"];
  for (const task of result.tasks) {
    const lockStr = task.locked ? " [LOCKED]" : "";
    const claimsStr = task.writeClaims.length > 0 ? ` (claims: ${task.writeClaims.join(", ")})` : "";
    lines.push(`- ${task.taskId}: ${task.phase}${lockStr}${claimsStr}`);
  }
  return `${lines.join("\n")}\n`;
}
