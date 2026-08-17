import { clearWorkState } from "../core/work-state.js";

export { clearWorkState };

export async function runClearState({ target, taskId, task } = {}) {
  const effectiveTaskId = taskId ?? task ?? null;
  return clearWorkState(target, { taskId: effectiveTaskId });
}

export function formatClearStateResult(result) {
  return `${result.removed ? "removed" : "absent"}: ${result.path}\n`;
}
