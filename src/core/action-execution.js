import { proposeAction, transitionAction } from "./actions.js";
import { actionRequiresIdempotency } from "./action-model.js";
import { evaluateActionCapability } from "./capability-policy.js";
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
  const capability = await evaluateActionCapability({
    target, packageRoot, action, authorityContext, approval: approvalId ? { approvalId } : undefined,
  });
  if (!capability.allowed) {
    throw actionExecutionError(capability.reasonCode, `capability ${action.capability} is not authorized: ${capability.decision}`);
  }
  const authorized = await transitionAction(target, {
    packageRoot, taskId, actionId: action.actionId, to: "AUTHORIZED",
    expectedRevision: action.revision, expectedFingerprint: action.actionFingerprint,
    details: {
      capabilityDecision: capability.decision,
      capabilityPolicyFingerprint: capability.policyFingerprint,
      ...(capability.approvalId ? { approvalId: capability.approvalId } : {}),
      ...(authorityContext?.trustMode === "HOST_ATTESTED"
        ? { authorityKind: "HOST_ATTESTED", authorityRef: authorityContext.grantRef ?? null }
        : {}),
    },
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
      commitResultCode: to === "COMMIT_UNKNOWN" ? "AMBIGUOUS" : execution.execution.exitCode,
      ...(to === "COMMIT_UNKNOWN"
        ? { reason: `started execution ended via ${execution.execution.termination} without proving external commit state` }
        : {}),
    },
  });
  return { action: result, execution: execution.execution, executionPath: execution.path, capability };
}
