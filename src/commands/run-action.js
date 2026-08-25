import { executeDurableAction } from "../core/action-execution.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runAction({ target, packageRoot, taskId, actionId, capability,
  effectClass, actionTarget, idempotencyKey, requirement, requiredForCompletion,
  argv, approvalId, timeoutMs, authorityContext }) {
  return withTaskMutation(target, { taskId, packageRoot }, "run-action", async (ctx) =>
    executeDurableAction({ target, packageRoot, taskId: ctx.taskId, argv, approvalId, timeoutMs,
      authorityContext, input: { actionId, capability, effectClass, target: actionTarget,
        operation: argv.join(" ").slice(0, 512), idempotencyKey,
        requirement: requirement ?? null, requiredForCompletion: Boolean(requiredForCompletion) } }));
}

export function formatRunActionResult(result) {
  return ["FORGELOOP ACTION EXECUTED", `action: ${result.action.actionId}`,
    `state: ${result.action.state}`, `execution: ${result.execution.executionId}`,
    `exit code: ${result.execution.exitCode ?? "not-started"}`, ""].join("\n");
}
