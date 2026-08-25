import { proposeAction, transitionAction } from "./actions.js";
import { evaluateActionCapability } from "./capability-policy.js";
import { runCommandExecution } from "./execution.js";

function actionExecutionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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
  const capability = await evaluateActionCapability({
    target, packageRoot, action, authorityContext, approval: approvalId ? { approvalId } : undefined,
  });
  if (!capability.allowed) {
    throw actionExecutionError(capability.reasonCode, `capability ${action.capability} is not authorized: ${capability.decision}`);
  }
  const authorized = await transitionAction(target, {
    packageRoot, taskId, actionId: action.actionId, to: "AUTHORIZED",
    expectedRevision: action.revision, expectedFingerprint: action.actionFingerprint,
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
    await transitionAction(target, {
      packageRoot, taskId, actionId: action.actionId, to: "FAILED",
      expectedRevision: started.revision, details: { reason: "process did not launch" },
    });
    throw error;
  }
  const to = execution.execution.status === "passed" ? "COMMITTED" : "FAILED";
  const result = await transitionAction(target, {
    packageRoot, taskId, actionId: action.actionId, to,
    expectedRevision: started.revision,
    details: { evidenceRef: execution.execution.executionId, commitResultCode: execution.execution.exitCode },
  });
  return { action: result, execution: execution.execution, executionPath: execution.path, capability };
}
