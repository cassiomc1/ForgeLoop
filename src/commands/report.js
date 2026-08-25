import { evaluateReport } from "../core/report.js";
import { withResolvedTask } from "../core/task-command.js";

export async function runReport(options = {}) {
  const target = options.target;
  const packageRoot = options.packageRoot;
  const taskId = options.taskId ?? options.task ?? null;
  return withResolvedTask(target, { taskId, packageRoot }, async (ctx) => {
    return evaluateReport({ ...options, taskId: ctx?.taskId ?? null });
  });
}

export function formatReportResult(result) {
  const lines = ["ForgeLoop Compliance"];
  for (const item of result.sections) lines.push(`${item.label.padEnd(20)} ${item.status}`);
  lines.push(`\nVERDICT: ${result.verdict}`);
  return `${lines.join("\n")}\n`;
}
