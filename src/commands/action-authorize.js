import { authorizeAction } from "../core/action-authorization.js";
import { withTaskMutation } from "../core/task-command.js";

/**
 * Canonical public authorization surface. This command is only an adapter
 * over the core authorization service: it creates no new trust mechanism and
 * accepts no authority fields in actor-controlled arguments. Trusted host
 * authority arrives exclusively through the out-of-band executor context.
 */
export async function runActionAuthorize({
  target,
  packageRoot,
  taskId,
  actionId,
  approvalId,
  authorityContext,
}) {
  return withTaskMutation(
    target,
    { taskId, packageRoot },
    "action-authorize",
    (ctx) => authorizeAction({
      target,
      packageRoot,
      taskId: ctx.taskId,
      actionId,
      approvalId,
      authorityContext,
    }),
  );
}

export function formatActionAuthorizeResult(result) {
  return [
    "FORGELOOP ACTION AUTHORIZED",
    `action: ${result.action.actionId}`,
    `state: ${result.action.state}`,
    `decision: ${result.authorization.capabilityDecision}`,
    "",
  ].join("\n");
}
