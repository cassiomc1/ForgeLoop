import { clearContinuity } from "../core/continuity.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runClearContinuity({ target, taskId, task, packageRoot } = {}) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "clear-continuity", async (ctx) => {
    return clearContinuity(target, { taskId: ctx?.taskId ?? null });
  });
}

export function formatClearContinuityResult(result) {
  return `${result.removed ? "cleared" : "absent"}: ${result.path}\n`;
}
