import { runComplete as evaluateAndComplete } from "../core/completion.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runComplete(options = {}) {
  const target = options.target;
  const packageRoot = options.packageRoot;
  const taskId = options.taskId ?? options.task ?? null;
  return withTaskMutation(target, { taskId, packageRoot }, "complete", async (ctx) => {
    return evaluateAndComplete({ ...options, taskId: ctx?.taskId ?? null });
  });
}

export function formatCompleteResult(result) {
  const lines = [`FORGELOOP COMPLETE: ${result.status}`];
  if (result.status === "VALID") {
    lines.push(`TASK: ${result.taskStatus}`);
    lines.push(`VERIFICATION: ${result.verificationStatus}`);
    lines.push(`PUBLICATION: ${result.publicationStatus}`);
    lines.push(`PRODUCTION_READINESS: ${result.productionReadiness}`);
  }
  for (const error of result.errors) {
    lines.push(`${error.code}: ${error.message}`);
    if (error.next) lines.push(`NEXT: ${error.next}`);
  }
  return `${lines.join("\n")}\n`;
}
