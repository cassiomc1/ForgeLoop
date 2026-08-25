import { verifyAction } from "../core/action-verification.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runActionVerify({ target, packageRoot, taskId, actionId, evidenceRef }) {
  return withTaskMutation(target, { taskId, packageRoot }, "action-verify", (ctx) =>
    verifyAction({ target, packageRoot, taskId: ctx.taskId, actionId, evidenceRef }));
}
export function formatActionVerifyResult(result) {
  return `FORGELOOP ACTION VERIFIED\naction: ${result.actionId}\nstate: ${result.state}\nevidence: ${result.lastEvidenceRef}\n`;
}
