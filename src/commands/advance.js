import { advanceWorkState } from "../core/phase.js";
import { withTaskMutation } from "../core/task-command.js";

export { advanceWorkState };

export async function runAdvance({ target, packageRoot, to, taskId, task, authorityContext, runtimeContext }) {
  if (!to) throw new Error("--to is required for advance");
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "advance", async (ctx) => {
    return advanceWorkState(target, to, {
      packageRoot,
      taskId: ctx?.taskId ?? null,
      authorityContext,
      runtimeContext,
    });
  });
}

export function formatAdvanceResult(result) {
  return `phase: ${result.phase}\nprevious: ${result.previousPhase ?? "none"}\n`;
}
