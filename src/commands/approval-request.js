import { readAction } from "../core/actions.js";
import { readWorkState } from "../core/work-state.js";
import { requestApproval } from "../core/approvals.js";
import { evaluateActionCapability } from "../core/capability-policy.js";
import { loadPolicyIdentity } from "../core/policy-engine.js";
import {
  E_ACTION_APPROVAL_NOT_REQUIRED,
  E_ACTION_AUTHORITY_REQUIRED,
  E_ACTION_CAPABILITY_DENIED,
} from "../core/error-codes.js";
import { withTaskMutation } from "../core/task-command.js";

function approvalPolicyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function runApprovalRequest({ target, packageRoot, taskId, approvalId, actionId, reason }) {
  return withTaskMutation(target, { taskId, packageRoot }, "approval-request", async (ctx) => {
    const action = await readAction(target, { packageRoot, taskId: ctx.taskId, actionId });
    const state = await readWorkState(target, { packageRoot, taskId: ctx.taskId });
    let policyIdentity;
    try {
      policyIdentity = await loadPolicyIdentity(target, packageRoot, ctx.taskId);
    } catch (error) {
      throw approvalPolicyError(
        error.code ?? "E_POLICY_INVALID",
        `Capability policy epoch validation failed before requesting approval: ${error.message}`,
      );
    }
    if (policyIdentity.status !== "VALID") {
      throw approvalPolicyError(
        policyIdentity.code ?? "E_ACTION_POLICY_LOCK_REQUIRED",
        "The current capability policy is not bound to a valid task policy epoch; repair or refresh policy state before requesting approval.",
      );
    }
    const capability = await evaluateActionCapability({ target, packageRoot, action });
    if (capability.decision === "ALLOW") {
      throw approvalPolicyError(
        E_ACTION_APPROVAL_NOT_REQUIRED,
        "The current capability policy allows this action without approval.",
      );
    }
    if (capability.decision === "DENY") {
      throw approvalPolicyError(
        capability.reasonCode ?? E_ACTION_CAPABILITY_DENIED,
        `The current capability policy denies ${action.capability}; approval cannot override a denial.`,
      );
    }
    if (capability.decision === "REQUIRE_AUTHORITY") {
      throw approvalPolicyError(
        capability.reasonCode ?? E_ACTION_AUTHORITY_REQUIRED,
        "The current capability policy requires trusted host authority; approval cannot substitute for it.",
      );
    }
    return requestApproval(target, { packageRoot, taskId: ctx.taskId, input: {
      approvalId, actionId: action.actionId, actionFingerprint: action.actionFingerprint,
      contractFingerprint: state.contractFingerprint, taskRevision: state.revision ?? 0,
      capability: action.capability, reason,
    } });
  });
}
export function formatApprovalRequestResult(result) { return `FORGELOOP APPROVAL REQUESTED\napproval: ${result.approval.approvalId}\nstatus: ${result.approval.status}\n`; }
