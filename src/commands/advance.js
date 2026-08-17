import { advanceWorkState } from "../core/phase.js";

export { advanceWorkState };

export async function runAdvance({ target, packageRoot, to, taskId, task }) {
  if (!to) throw new Error("--to is required for advance");
  const effectiveTaskId = taskId ?? task ?? null;
  return advanceWorkState(target, to, { packageRoot, taskId: effectiveTaskId });
}

export function formatAdvanceResult(result) {
  return `phase: ${result.phase}\nprevious: ${result.previousPhase ?? "none"}\n`;
}
