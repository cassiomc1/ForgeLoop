import { reconcileAction } from "../core/action-reconciliation.js";
import { withTaskMutation } from "../core/task-command.js";
export async function runActionReconcile(args) {
  const { target, packageRoot, taskId } = args;
  return withTaskMutation(target, { taskId, packageRoot }, "action-reconcile", (ctx) =>
    reconcileAction({ ...args, taskId: ctx.taskId }));
}
export function formatActionReconcileResult(result) {
  return `FORGELOOP ACTION RECONCILED\naction: ${result.action.actionId}\noutcome: ${result.outcome}\nstate: ${result.action.state}\n`;
}
