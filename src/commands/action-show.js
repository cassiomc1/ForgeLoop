import { readAction } from "../core/actions.js";
import { resolveTaskContext } from "../core/task-context.js";

export async function runActionShow({ target, packageRoot, taskId, actionId }) {
  const ctx = await resolveTaskContext(target, { packageRoot, taskId });
  return readAction(target, { packageRoot, taskId: ctx.taskId, actionId });
}
export function formatActionShowResult(result) {
  return `FORGELOOP ACTION\naction: ${result.actionId}\nstate: ${result.state}\ncapability: ${result.capability}\n`;
}
