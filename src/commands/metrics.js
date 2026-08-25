import { buildTrajectoryMetrics } from "../core/trajectory-metrics.js";
import { withResolvedTask } from "../core/task-command.js";
export async function runMetrics({ target, packageRoot, taskId }) {
  return withResolvedTask(target, { taskId, packageRoot }, (ctx) =>
    buildTrajectoryMetrics({ target, packageRoot, taskId: ctx.taskId }));
}
export function formatMetricsResult(result) { return `${JSON.stringify(result, null, 2)}\n`; }
