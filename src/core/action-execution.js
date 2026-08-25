import { proposeAction, transitionAction } from "./actions.js";
import { actionRequiresIdempotency } from "./action-model.js";
import { authorizeAction } from "./action-authorization.js";
import { runCommandExecution } from "./execution.js";

function actionExecutionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function startedExecutionOutcome(action, execution) {
  if (execution.status === "passed") return "COMMITTED";
  if (!actionRequiresIdempotency(action.effectClass)) return "FAILED";
  if (execution.termination === "spawn-error") return "FAILED";
  return "COMMIT_UNKNOWN";
}

export async function executeDurableAction({
  target, packageRoot, taskId, input, argv, approvalId, authorityContext, timeoutMs,
}) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw actionExecutionError("E_ACTION_INVALID", "run-action requires exact argv after --");
  }
  const proposed = await proposeAction(target, { packageRoot, taskId, input: {
    ...input,
    provenance: "FORGELOOP_EXECUTED",
  } });
  const action = proposed.action;
  if (action.state === "COMMIT_UNKNOWN") {
    throw actionExecutionError("E_ACTION_RECONCILIATION_REQUIRED", `action ${action.actionId} must be reconciled before retry`);
  }
  if (action.state !== "PROPOSED") {
    throw actionExecutionError("E_ACTION_STATE_MISMATCH", `action ${action.actionId} is already ${action.state}`);
  }
  const { action: authorized, capability } = await authorizeAction({
    target, packageRoot, taskId, actionId: action.actionId,
    approvalId, authorityContext,
  });
  const started = await transitionAction(target, {
    packageRoot, taskId, actionId: action.actionId, to: "STARTED",
    expectedRevision: authorized.revision, expectedFingerprint: action.actionFingerprint,
  });
  let execution;
  try {
    execution = await runCommandExecution({
      target, packageRoot, taskId, checkId: `action:${action.actionId}`,
      requirement: input.requirement ?? `durable action ${action.actionId}`,
      argv, timeoutMs, authorityContext,
    });
  } catch (error) {
    const to = actionRequiresIdempotency(action.effectClass) ? "COMMIT_UNKNOWN" : "FAILED";
    await transitionAction(target, {
      packageRoot, taskId, actionId: action.actionId, to,
      expectedRevision: started.revision,
      details: {
        reason: to === "COMMIT_UNKNOWN"
          ? "execution outcome could not be proven after action start"
          : "process did not launch",
        ...(to === "COMMIT_UNKNOWN" ? { commitResultCode: "AMBIGUOUS" } : {}),
      },
    });
    throw error;
  }
  const to = startedExecutionOutcome(action, execution.execution);
  const result = await transitionAction(target, {
    packageRoot, taskId, actionId: action.actionId, to,
    expectedRevision: started.revision,
    details: {
      evidenceRef: execution.execution.executionId,
      ...(to === "COMMIT_UNKNOWN" ? {
        commitResultCode: "AMBIGUOUS",
        reason: `started execution ended via ${execution.execution.termination} without proving external commit state`,
      } : {}),
    },
  });
  return { action: result, execution: execution.execution, executionPath: execution.path, capability };
}
