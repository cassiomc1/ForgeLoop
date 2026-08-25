import { resolveApproval } from "../core/approvals.js";
import { withTaskMutation } from "../core/task-command.js";
export async function runApprovalResolve({ target, packageRoot, taskId, approvalId, decision, authorityKind, hostGrantRef, reason }) {
  return withTaskMutation(target, { taskId, packageRoot }, "approval-resolve", (ctx) => resolveApproval(target, {
    packageRoot, taskId: ctx.taskId, approvalId, decision, authorityKind, hostGrantRef, reason,
  }));
}
export function formatApprovalResolveResult(result) { return `FORGELOOP APPROVAL RESOLVED\napproval: ${result.approvalId}\ndecision: ${result.decision}\n`; }
