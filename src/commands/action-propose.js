import { proposeAction } from "../core/actions.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runActionPropose({ target, packageRoot, taskId, input }) {
  return withTaskMutation(target, { taskId, packageRoot }, "action-propose", (ctx) =>
    proposeAction(target, { packageRoot, taskId: ctx.taskId, input: { ...input, provenance: "HOST_REPORTED" } }));
}
export function formatActionProposeResult(result) {
  return `FORGELOOP ACTION PROPOSED\naction: ${result.action.actionId}\nstate: ${result.action.state}\n`;
}
