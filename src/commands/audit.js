import { evaluateAudit } from "../core/audit.js";
import { withResolvedTask } from "../core/task-command.js";

export { evaluateAudit };

export async function runAudit(options = {}) {
  const target = options.target;
  const packageRoot = options.packageRoot;
  const taskId = options.taskId ?? options.task ?? null;
  return withResolvedTask(target, { taskId, packageRoot }, async (ctx) => {
    return evaluateAudit({ ...options, taskId: ctx?.taskId ?? null });
  });
}

export function formatAuditResult(result) {
  const lines = [`FORGELOOP AUDIT: ${result.status}`];
  for (const error of result.errors) {
    lines.push(`${error.code}: ${error.message}`);
    if (error.next) lines.push(`NEXT: ${error.next}`);
  }
  return `${lines.join("\n")}\n`;
}
