import { clearContinuity } from "../core/continuity.js";

export async function runClearContinuity({ target, taskId, task } = {}) {
  const effectiveTaskId = taskId ?? task ?? null;
  return clearContinuity(target, { taskId: effectiveTaskId });
}

export function formatClearContinuityResult(result) {
  return `${result.removed ? "cleared" : "absent"}: ${result.path}\n`;
}
