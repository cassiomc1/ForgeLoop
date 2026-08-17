import { runPreflight as evaluateAndPersistPreflight } from "../core/preflight.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runPreflight(options = {}) {
  const target = options.target;
  const packageRoot = options.packageRoot;
  const taskId = options.taskId ?? options.task ?? null;
  return withTaskMutation(target, { taskId, packageRoot }, "preflight", async (ctx) => {
    return evaluateAndPersistPreflight({ ...options, taskId: ctx?.taskId ?? null });
  });
}

export function formatPreflightResult(result) {
  const lines = [`FORGELOOP PREFLIGHT: ${result.status}`];
  for (const error of result.errors) {
    lines.push(`${error.code}: ${error.message}`);
    if (error.next) lines.push(`NEXT: ${error.next}`);
  }
  return `${lines.join("\n")}\n`;
}
