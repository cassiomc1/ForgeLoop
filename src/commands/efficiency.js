import { buildEfficiencyReport } from "../core/efficiency.js";
import { withResolvedTask } from "../core/task-command.js";

export async function runEfficiency({ target, packageRoot, taskId, baselinePath = null, runtimeContext = null }) {
  return withResolvedTask(target, { taskId, packageRoot, explicitRequired: true }, (ctx) =>
    buildEfficiencyReport({ target, packageRoot, taskId: ctx.taskId, baselinePath, runtimeContext }));
}

export function formatEfficiencyResult(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

