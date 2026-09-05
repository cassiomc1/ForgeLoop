import { taskArtifactPath } from "./task-paths.js";
import { NEXT_ACTIONS, result } from "./next-action-model.js";
import { artifactError } from "./next-action-artifacts.js";
import { listActions } from "./actions.js";
import { listApprovals } from "./approvals.js";
import { loadPolicyIdentity } from "./policy-engine.js";

export async function resolvePendingActionGuidance({ target, packageRoot, state, context, eventsRel, authorityContext, runtimeContext, helpers }) {
  const {
    capabilityDecisionMetadata,
    actionApprovalGuidance,
    actionAuthorityGuidance,
    actionApprovalResolutionGuidance,
    actionDeniedGuidance,
    actionPolicyEpochGuidance,
    authorizeActionGuidance,
    evaluateProposedActionCapability,
    findApplicablePendingApproval,
  } = helpers;
  let actionsForApproval;
  try {
    actionsForApproval = await listActions(target, { packageRoot, taskId: state.taskId });
  } catch (error) {
    if (error.code === "E_ACTION_INVALID") {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        commands: [],
        reasons: [artifactError(
          error.code,
          `A durable action artifact is invalid and cannot be offered for authorization: ${error.message}`,
          [taskArtifactPath(state.taskId, "actions"), eventsRel],
        )],
        requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
      });
    }
    throw error;
  }
  const ambiguousAction = actionsForApproval.find((action) => action.state === "COMMIT_UNKNOWN");
  if (ambiguousAction) {
    return result({ ...context, nextAction: NEXT_ACTIONS.RECONCILE_ACTION,
      commands: [`forgeloop action-reconcile --task ${state.taskId} --action ${ambiguousAction.actionId} --outcome UNKNOWN`],
      reasons: [artifactError("E_ACTION_RECONCILIATION_REQUIRED",
        `Action ${ambiguousAction.actionId} has an unknown external commit outcome; retry is forbidden until reconciliation.`)],
      reconciliationAuthorityRequired: {
        outcomesRequiringTrust: ["COMMITTED", "NOT_COMMITTED"],
        reason: "Recording an UNKNOWN observation is safe from any surface; settling COMMITTED or NOT_COMMITTED requires a trusted host boundary and evidence.",
      },
      requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel] });
  }
  // A PROPOSED required action ready for authorization should use the
  // canonical authorization surface; host/approval blockers remain structured.
  const authorizableAction = actionsForApproval.find((action) => action.requiredForCompletion
    && action.state === "PROPOSED");
  if (authorizableAction) {
    let policyIdentity;
    try {
      policyIdentity = await loadPolicyIdentity(target, packageRoot, state.taskId);
    } catch (error) {
      return actionPolicyEpochGuidance({
        context,
        state,
        action: authorizableAction,
        policyIdentity: {
          code: error.code ?? "E_POLICY_INVALID",
          message: `Capability policy epoch validation failed for required action ${authorizableAction.actionId}: ${error.message}`,
        },
        eventsRel,
      });
    }
    if (policyIdentity.status !== "VALID") {
      return actionPolicyEpochGuidance({
        context,
        state,
        action: authorizableAction,
        policyIdentity,
        eventsRel,
      });
    }

    let capability;
    try {
      capability = await evaluateProposedActionCapability({
        target,
        packageRoot,
        action: authorizableAction,
        authorityContext,
      });
    } catch (error) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        commands: [],
        reasons: [artifactError(
          error.code ?? "E_ACTION_CAPABILITY_INVALID",
          `Capability policy evaluation failed for required action ${authorizableAction.actionId}: ${error.message}`,
          [taskArtifactPath(state.taskId, "actions"), eventsRel],
        )],
        capabilityDecision: {
          capability: authorizableAction.capability,
          decision: "DENY",
          reasonCode: error.code ?? "E_ACTION_CAPABILITY_INVALID",
          policyFingerprint: null,
        },
        requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
      });
    }
    if (capability.decision === "REQUIRE_AUTHORITY") {
      return actionAuthorityGuidance({
        context,
        state,
        action: authorizableAction,
        capability,
        eventsRel,
      });
    }
    if (capability.allowed) {
      return authorizeActionGuidance({
        context,
        state,
        action: authorizableAction,
        capability,
        eventsRel,
      });
    }
    if (capability.decision === "REQUIRE_APPROVAL") {
      let approvals;
      try {
        approvals = await listApprovals(target, { packageRoot, taskId: state.taskId });
      } catch (error) {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
          commands: [],
          reasons: [artifactError(
            error.code ?? "E_APPROVAL_INVALID",
            `Approval artifact inspection failed for required action ${authorizableAction.actionId}: ${error.message}`,
            [taskArtifactPath(state.taskId, "approvals"), eventsRel],
          )],
          capabilityDecision: capabilityDecisionMetadata(authorizableAction, capability),
          requiredArtifacts: [taskArtifactPath(state.taskId, "approvals"), eventsRel],
        });
      }
      try {
        capability = await evaluateProposedActionCapability({
          target,
          packageRoot,
          action: authorizableAction,
          approvals,
          authorityContext,
        });
      } catch (error) {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
          commands: [],
          reasons: [artifactError(
            error.code ?? "E_ACTION_CAPABILITY_INVALID",
            `Capability policy evaluation failed for required action ${authorizableAction.actionId}: ${error.message}`,
            [taskArtifactPath(state.taskId, "actions"), eventsRel],
          )],
          capabilityDecision: {
            capability: authorizableAction.capability,
            decision: "DENY",
            reasonCode: error.code ?? "E_ACTION_CAPABILITY_INVALID",
            policyFingerprint: null,
          },
          requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
        });
      }
      if (capability.allowed) {
        return authorizeActionGuidance({
          context,
          state,
          action: authorizableAction,
          capability,
          eventsRel,
        });
      }
      if (capability.decision !== "REQUIRE_APPROVAL") {
        if (capability.decision === "REQUIRE_AUTHORITY") {
          return actionAuthorityGuidance({
            context,
            state,
            action: authorizableAction,
            capability,
            eventsRel,
          });
        }
        if (capability.allowed) {
          return authorizeActionGuidance({
            context,
            state,
            action: authorizableAction,
            capability,
            eventsRel,
          });
        }
        return actionDeniedGuidance({
          context,
          state,
          action: authorizableAction,
          capability,
          eventsRel,
        });
      }
      const pendingApproval = await findApplicablePendingApproval({
        target,
        packageRoot,
        taskId: state.taskId,
        action: authorizableAction,
        approvals,
      });
      if (pendingApproval) {
        return actionApprovalResolutionGuidance({
          context,
          state,
          action: authorizableAction,
          approval: pendingApproval,
          eventsRel,
        });
      }
      return actionApprovalGuidance({
        context,
        state,
        action: authorizableAction,
        capability,
        eventsRel,
      });
    }
    return actionDeniedGuidance({
      context,
      state,
      action: authorizableAction,
      capability,
      eventsRel,
    });
  }
  // Committed-but-unverified required action needs canonical postcondition
  // evidence before it can satisfy completion.
  const committedActions = actionsForApproval;
  const unverifiedRequired = committedActions.find((action) => action.requiredForCompletion
    && action.state === "COMMITTED");
  if (unverifiedRequired) {
    return result({ ...context, nextAction: NEXT_ACTIONS.VERIFY_EXTERNAL_ACTION,
      commands: [
        `forgeloop run-check --task ${state.taskId} --id check-postcondition --requirement <requirement> -- <independent verification argv>`,
        `forgeloop action-verify --task ${state.taskId} --action ${unverifiedRequired.actionId} --evidence <execution-ref>`,
      ],
      reasons: [artifactError("E_ACTION_VERIFICATION_REQUIRED",
        `Committed action ${unverifiedRequired.actionId} requires independent canonical postcondition evidence; exit code 0 alone is not verification.`)],
      requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel] });
  }
  return null;
}
