import { clearWorkState } from "../core/work-state.js";
import { withTaskMutation } from "../core/task-command.js";

export { clearWorkState };

export async function runClearState({ target, taskId, task, packageRoot } = {}) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "clear-state", async (ctx) => {
    return clearWorkState(target, { taskId: ctx?.taskId ?? null });
  });
}

export function formatClearStateResult(result) {
  return `${result.removed ? "removed" : "absent"}: ${result.path}\n`;
}
