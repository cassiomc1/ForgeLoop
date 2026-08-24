import { buildTaskHistory, formatHistoryResult } from "../core/history.js";
import { resolveTaskContext, TASK_SELECTION_MODES } from "../core/task-context.js";

export { buildTaskHistory, formatHistoryResult };

export async function runHistory({ target, packageRoot, taskId, task, filters = {} }) {
  const resolved = await resolveTaskContext(target, {
    packageRoot,
    taskId: taskId ?? task,
    selectionMode: TASK_SELECTION_MODES.READ,
  });
  return buildTaskHistory({
    target,
    packageRoot,
    taskId: resolved?.taskId ?? null,
    filters,
  });
}
