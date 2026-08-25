import { readAction } from "../core/actions.js";
import { readWorkState } from "../core/work-state.js";
import { requestApproval } from "../core/approvals.js";
import { withTaskMutation } from "../core/task-command.js";
export async function runApprovalRequest({ target, packageRoot, taskId, approvalId, actionId, reason }) {
  return withTaskMutation(target, { taskId, packageRoot }, "approval-request", async (ctx) => {
    const action = await readAction(target, { packageRoot, taskId: ctx.taskId, actionId });
    const state = await readWorkState(target, { packageRoot, taskId: ctx.taskId });
    return requestApproval(target, { packageRoot, taskId: ctx.taskId, input: {
      approvalId, actionId: action.actionId, actionFingerprint: action.actionFingerprint,
      contractFingerprint: state.contractFingerprint, taskRevision: state.revision ?? 0,
      capability: action.capability, reason,
    } });
  });
}
export function formatApprovalRequestResult(result) { return `FORGELOOP APPROVAL REQUESTED\napproval: ${result.approval.approvalId}\nstatus: ${result.approval.status}\n`; }
