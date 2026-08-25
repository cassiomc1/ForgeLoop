import { transitionAction } from "../core/actions.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runActionRecord({ target, packageRoot, taskId, actionId, state, provenance, evidenceRef }) {
  if (!["HOST_REPORTED", "EXTERNAL_OBSERVED"].includes(provenance)) {
    const error = new Error("action-record provenance must be HOST_REPORTED or EXTERNAL_OBSERVED");
    error.code = "E_ACTION_INVALID";
    throw error;
  }
  return withTaskMutation(target, { taskId, packageRoot }, "action-record", (ctx) =>
    transitionAction(target, { packageRoot, taskId: ctx.taskId, actionId, to: state,
      details: { ...(evidenceRef ? { evidenceRef } : {}), reportedProvenance: provenance } }));
}
export function formatActionRecordResult(result) {
  return `FORGELOOP ACTION RECORDED\naction: ${result.actionId}\nstate: ${result.state}\n`;
}
