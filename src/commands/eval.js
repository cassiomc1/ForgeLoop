import { evaluateTrajectory } from "../core/trajectory-evaluation.js";
import { withResolvedTask } from "../core/task-command.js";
export async function runEval({ target, packageRoot, taskId, scenarioPath, runtimeContext = null }) {
  return withResolvedTask(target, { taskId, packageRoot }, (ctx) => evaluateTrajectory({
    target,
    packageRoot,
    taskId: ctx.taskId,
    scenarioPath,
    runtimeContext,
  }));
}
export function formatEvalResult(result) { return `${JSON.stringify(result, null, 2)}\n`; }
