import { ARTIFACT_PATHS, readJsonArtifact } from "./artifacts.js";
import { taskArtifactPath } from "./task-paths.js";
import { completionIdentityErrors, evaluateCompletion } from "./completion.js";
import { readContract } from "./contract.js";
import { evaluatePreflight, validatePersistedPreflight, validateReadyProtocolConsistency } from "./preflight.js";
import { validateReceipt } from "./receipt.js";
import { readPersistedRoute } from "./route-artifact.js";
import { completionRelationshipErrors } from "./completion-relationships.js";
import { classifyLoadedWorkState, readWorkState } from "./work-state.js";
import { evaluateRequiredEvidence, authoritativeChecksForRequirements, ordinaryLeafRequirements, classifyRequirement } from "./evidence-readiness.js";
import {
  evaluateStartExecutionPrerequisites,
  PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE,
} from "./execution-prerequisites.js";
import { validateEventLedger, validateCompletionRecoveryAuthorization } from "./events.js";
import {
  NEXT_ACTIONS,
  commandFor,
  directCommandSpec,
  decision,
  recordCheckCommandSpec,
  recordDiagnosisCommandSpec,
  recordInterventionCommandSpec,
  recordTerminalResultCommandSpec,
  recoveryGuidanceForClassification,
  result,
  uniqueSorted,
} from "./next-action-model.js";
import {
  artifactError,
  checkListReasons,
  freshnessReasons,
  loadArtifact,
  requirementsAndCoverage,
  staleReasons,
} from "./next-action-artifacts.js";
import { PHASES_REQUIRING_EXECUTION_CHRONOLOGY } from "./next-action-phases.js";
import { evaluateContinuityNextAction } from "./next-action-continuity.js";
import { resolveCurrentCycleDiagnostic } from "./diagnostic-projection.js";
import { buildTaskReflection } from "./reflection.js";
import { evaluateProgress, PROGRESS_STATUS } from "./progress.js";
import { criterionForDecision } from "./settlement-model.js";
import { readEvents } from "./events.js";
import { inspectTaskConflictState } from "./task-conflict-inspection.js";
import { listActions } from "./actions.js";
import { listApprovals, validateApprovalForAction } from "./approvals.js";
import { evaluateActionCapability } from "./capability-policy.js";
import { loadPolicyIdentity } from "./policy-engine.js";

export { NEXT_ACTIONS } from "./next-action-model.js";

function capabilityDecisionMetadata(action, capability, approvalId = null) {
  return {
    capability: action.capability,
    decision: capability.decision,
    reasonCode: capability.reasonCode ?? null,
    policyFingerprint: capability.policyFingerprint ?? null,
    ...(capability.authority?.authorityRef ? { authorityRef: capability.authority.authorityRef } : {}),
    ...(capability.approval?.approvalId
      ? { approvalId: capability.approval.approvalId }
      : approvalId ? { approvalId } : {}),
  };
}

function authorizeActionGuidance({ context, state, action, capability, eventsRel }) {
  const approvalId = capability.approval?.approvalId ?? null;
  const approvalSuffix = approvalId ? ` --approval ${approvalId}` : "";
  return result({
    ...context,
    nextAction: NEXT_ACTIONS.AUTHORIZE_ACTION,
    commands: [`forgeloop action-authorize --task ${state.taskId} --action ${action.actionId}${approvalSuffix}`],
    reasons: [artifactError(
      "E_ACTION_AUTHORIZATION_REQUIRED",
      `Required action ${action.actionId} is PROPOSED and is authorizable under the canonical capability policy.`,
    )],
    capabilityDecision: capabilityDecisionMetadata(action, capability),
    requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
  });
}

function actionApprovalGuidance({ context, state, action, capability, eventsRel }) {
  return result({
    ...context,
    nextAction: NEXT_ACTIONS.REQUEST_ACTION_APPROVAL,
    commands: [
      `forgeloop approval-request --task ${state.taskId} --action ${action.actionId} --approval <approval-id> --reason <reason>`,
    ],
    commandSpecs: [{
      ...directCommandSpec("approval-request", state.taskId, [
        { name: "approvalId", option: "--approval=<approval-id>" },
        { name: "actionId", option: "--action=<action-id>" },
        { name: "reason", option: "--reason=<text>" },
      ]),
    }],
    reasons: [artifactError(
      "E_ACTION_APPROVAL_REQUIRED",
      `Capability policy requires a current approval before required action ${action.actionId} can be authorized.`,
    )],
    approvalRequired: {
      actionId: action.actionId,
      capability: action.capability,
      reason: "Capability policy requires approval before authorization.",
    },
    capabilityDecision: capabilityDecisionMetadata(action, capability),
    requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
  });
}

function actionAuthorityGuidance({ context, state, action, capability, eventsRel }) {
  return result({
    ...context,
    nextAction: NEXT_ACTIONS.AUTHORIZE_ACTION,
    commands: [],
    reasons: [artifactError(
      capability.reasonCode ?? "E_ACTION_AUTHORITY_REQUIRED",
      `Required action ${action.actionId} needs trusted host authority before it can be authorized.`,
    )],
    authorityRequired: {
      kind: "HOST_ATTESTED",
      actionId: action.actionId,
      capability: action.capability,
      reason: capability.allowed
        ? "Authorization must be performed by a trusted host boundary that preserves authority context."
        : "Capability policy requires trusted host authority; no standalone CLI command can create it.",
    },
    hostActionRequired: {
      action: "action-authorize",
      actionId: action.actionId,
      executionBoundary: "HOST",
      requiresAuthorityContext: true,
    },
    capabilityDecision: capabilityDecisionMetadata(action, capability),
    requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
  });
}

function actionApprovalResolutionGuidance({ context, state, action, approval, eventsRel }) {
  return result({
    ...context,
    nextAction: NEXT_ACTIONS.RESOLVE_ACTION_APPROVAL,
    commands: [],
    reasons: [artifactError(
      "E_ACTION_APPROVAL_REQUIRED",
      `Required action ${action.actionId} is waiting for approval.`,
    )],
    requiredArtifacts: [taskArtifactPath(state.taskId, "approvals"), eventsRel],
    authorityRequired: {
      kind: "HOST_ATTESTED",
      approvalId: approval.approvalId,
      actionId: action.actionId,
      reason: "This approval must be resolved by a trusted host/operator boundary.",
    },
  });
}

function actionDeniedGuidance({ context, state, action, capability, eventsRel }) {
  return result({
    ...context,
    nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
    commands: [],
    reasons: [artifactError(
      capability.reasonCode ?? "E_ACTION_CAPABILITY_DENIED",
      `Capability policy does not authorize required action ${action.actionId}: ${capability.decision}.`,
    )],
    capabilityDecision: capabilityDecisionMetadata(action, capability),
    requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
  });
}

function actionPolicyEpochGuidance({ context, state, action, policyIdentity, eventsRel }) {
  const code = policyIdentity.code ?? "E_ACTION_POLICY_LOCK_REQUIRED";
  const recoveryAction = policyRecoveryAction([{ code }]);
  return result({
    ...context,
    nextAction: recoveryAction ?? NEXT_ACTIONS.RESOLVE_BLOCKER,
    commands: [],
    reasons: [artifactError(
      code,
      policyIdentity.message
        ?? `Required action ${action.actionId} cannot be evaluated because the capability policy is not bound to the active task policy epoch.`,
      [taskArtifactPath(state.taskId, "actions"), eventsRel],
    )],
    requiredArtifacts: [taskArtifactPath(state.taskId, "actions"), eventsRel],
  });
}

async function evaluateProposedActionCapability({ target, packageRoot, action, approvals, authorityContext }) {
  const current = await evaluateActionCapability({ target, packageRoot, action, authorityContext });
  if (current.decision !== "REQUIRE_APPROVAL" || !approvals) return current;
  const approved = approvals.filter((approval) => approval.actionId === action.actionId && approval.status === "APPROVED");
  for (const approval of approved) {
    const evaluated = await evaluateActionCapability({
      target,
      packageRoot,
      action,
      authorityContext,
      approval: { approvalId: approval.approvalId },
    });
    if (evaluated.allowed) return evaluated;
  }
  return current;
}

async function findApplicablePendingApproval({ target, packageRoot, taskId, action, approvals }) {
  for (const approval of approvals) {
    if (approval.status !== "PENDING" || approval.actionId !== action.actionId) continue;
    try {
      return await validateApprovalForAction(target, {
        packageRoot,
        taskId,
        action,
        approvalId: approval.approvalId,
        requireApproved: false,
      });
    } catch (error) {
      if (["E_APPROVAL_STALE", "E_APPROVAL_INVALID"].includes(error.code)) continue;
      throw error;
    }
  }
  return null;
}

export function policyRecoveryAction(errors = []) {
  if (errors.some((e) => [
    "E_POLICY_WEAKENING",
    "E_POLICY_LOCK_MISMATCH",
    "E_ACTION_POLICY_DRIFT",
  ].includes(e.code))) {
    return NEXT_ACTIONS.RESTORE_POLICY;
  }
  if (errors.some((e) => e.code === "E_CHECK_MUTATION_EXECUTION_ERROR" || e.code === "E_CHECK_MUTATION_NOT_DETECTED")) {
    return NEXT_ACTIONS.REPAIR_CHECKER;
  }
  if (errors.some((e) => e.code === "E_POLICY_INVALID" || e.code === "E_POLICY_EVALUATION_FAILED")) {
    return NEXT_ACTIONS.REPAIR_POLICY;
  }
  if (errors.some((e) => e.code === "E_POLICY_DRIFT_UNKNOWN")) {
    return NEXT_ACTIONS.REVERIFY_AFTER_POLICY_CHANGE;
  }
  if (errors.some((e) => e.code === "E_BASELINE_EXPANSION")) {
    return NEXT_ACTIONS.RESTORE_BASELINE;
  }
  if (errors.some((e) => e.code === "E_BASELINE_RECORD_DURING_ACTIVE_TASK")) {
    return NEXT_ACTIONS.CONTINUE_WITH_EXISTING_BASELINE;
  }
  if (errors.some((e) => e.code === "E_CHECK_INERT")) {
    return NEXT_ACTIONS.RESOLVE_INERT_CHECK;
  }
  return null;
}

async function computeNextAction(targetOrOptions = {}, packageRootOption) {
  const normalized = typeof targetOrOptions === "string"
    ? { target: targetOrOptions, packageRoot: packageRootOption }
    : targetOrOptions;
  const { target, packageRoot, taskId: explicitTaskId, authorityContext, runtimeContext } = normalized ?? {};

  const stateRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "state") : ARTIFACT_PATHS.state;
  const preflightRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "preflight") : ARTIFACT_PATHS.preflight;
  const contractRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "contract") : ARTIFACT_PATHS.contract;
  const routeRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "route") : ARTIFACT_PATHS.route;
  const receiptRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "receipt") : ARTIFACT_PATHS.receipt;
  const eventsRel = explicitTaskId ? taskArtifactPath(explicitTaskId, "events") : ARTIFACT_PATHS.events;

  const workState = await loadArtifact(
    () => readWorkState(target, { packageRoot, taskId: explicitTaskId }),
    stateRel,
  );
  if (workState.error) {
    return decision(
      {},
      NEXT_ACTIONS.RESOLVE_BLOCKER,
      artifactError("WORK_STATE_INVALID", workState.error.message, [stateRel]),
      [stateRel],
      workState.missingArtifacts,
    );
  }
  if (!workState.value) {
    const persistedPreflight = await loadArtifact(
      () => readJsonArtifact(target, preflightRel, "preflight", packageRoot),
      preflightRel,
    );
    if (!persistedPreflight.error && persistedPreflight.value?.value?.status === "READY") {
      try {
        const consistencyErrors = await validateReadyProtocolConsistency({
          target,
          packageRoot,
          taskId: explicitTaskId,
          persisted: persistedPreflight.value.value,
        });
        if (consistencyErrors.length > 0) {
          return result({
            taskId: persistedPreflight.value.value.taskId ?? explicitTaskId ?? "unknown",
            currentPhase: "ROUTED",
            nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
            reasons: consistencyErrors,
            requiredArtifacts: [
              stateRel,
              contractRel,
              routeRel,
              preflightRel,
              eventsRel,
            ],
            missingArtifacts: [stateRel],
          });
        }
      } catch (error) {
        return result({
          taskId: persistedPreflight.value.value.taskId ?? explicitTaskId ?? "unknown",
          currentPhase: "ROUTED",
          nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
          reasons: [artifactError(
            error.code ?? "E_PREFLIGHT_READY_INCONSISTENT",
            error.message,
            error.artifacts ?? [preflightRel, eventsRel],
          )],
          requiredArtifacts: [preflightRel, eventsRel],
        });
      }
    }
    return decision(
      {},
      NEXT_ACTIONS.DISCOVER,
      artifactError("WORK_STATE_ABSENT", "No work-state checkpoint is present", [stateRel]),
      [stateRel],
      [stateRel],
    );
  }

  const state = workState.value;
  const context = { taskId: state.taskId, currentPhase: state.phase };
  if (explicitTaskId) {
    let inspection;
    try {
      inspection = await inspectTaskConflictState(target, {
        taskId: explicitTaskId,
        packageRoot,
      });
    } catch (error) {
      inspection = {
        classification: "INCONSISTENT",
        reasonCodes: [error.code ?? "E_TASK_RECOVERY_INCONSISTENT"],
      };
    }
    if (!["ACTIVE", "COMPLETE"].includes(inspection.classification)) {
      const guidance = recoveryGuidanceForClassification(inspection.classification, explicitTaskId);
      return result({
        ...context,
        nextAction: guidance.nextAction,
        commands: guidance.commands,
        commandSpecs: guidance.commandSpecs,
        reasons: inspection.reasonCodes.map((code) => artifactError(
          code,
          `Task conflict state is ${inspection.classification}; follow the structured recovery guidance.`,
          [stateRel, eventsRel, taskArtifactPath(explicitTaskId, "recovery")],
        )),
        requiredArtifacts: [stateRel, eventsRel],
      });
    }
  }
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
  if (state.phase === "RECEIVED") {
    return decision(
      context,
      NEXT_ACTIONS.DISCOVER,
      artifactError("PHASE_RECEIVED", "Discovery has not started"),
      [stateRel],
    );
  }
  if (state.phase === "DISCOVERING") {
    return decision(
      context,
      NEXT_ACTIONS.CREATE_CONTRACT,
      artifactError("PHASE_DISCOVERING", "Create and validate the task contract"),
      [stateRel],
    );
  }
  const contractResult = await loadArtifact(
    () => readContract(target, packageRoot, { taskId: explicitTaskId }),
    contractRel,
  );
  const contractArtifacts = [stateRel, contractRel];

  if (contractResult.error) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: [artifactError(
        contractResult.error.code === "ARTIFACT_MISSING" ? "E_CONTRACT_MISSING" : "E_CONTRACT_INVALID",
        contractResult.error.message,
        contractResult.error.artifacts ?? [],
      )],
      requiredArtifacts: contractArtifacts,
      missingArtifacts: contractResult.missingArtifacts,
    });
  }

  const contract = contractResult.value;
  const identityErrors = completionIdentityErrors({ contract: contract.value, state });
  if (identityErrors.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: identityErrors,
      requiredArtifacts: contractArtifacts,
    });
  }
  const freshness = await classifyLoadedWorkState({
    target,
    state,
    contractFile: contractRel,
  });
  if (freshness.status === "REVALIDATION_REQUIRED") {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: freshnessReasons(state, freshness),
      requiredArtifacts: uniqueSorted([
        stateRel,
        contractRel,
        ...(state.requiredArtifacts?.map((artifact) => artifact.path) ?? []),
      ]),
    });
  }
  if (state.phase === "CONTRACT_READY") {
    return decision(
      context,
      NEXT_ACTIONS.ROUTE,
      artifactError("PHASE_CONTRACT_READY", "Persist deterministic routing for the validated contract"),
      contractArtifacts,
      [routeRel],
    );
  }
  const routeResult = await loadArtifact(
    () => readPersistedRoute(target, packageRoot, { taskId: explicitTaskId }),
    routeRel,
  );
  const requiredArtifacts = [...contractArtifacts, routeRel];
  const missingArtifacts = [...routeResult.missingArtifacts];

  if (routeResult.error) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: [artifactError(
        routeResult.error.code === "ARTIFACT_MISSING" ? "E_ROUTE_MISSING" : "E_ROUTE_INVALID",
        routeResult.error.message,
        routeResult.error.artifacts ?? [],
      )],
      requiredArtifacts,
      missingArtifacts,
    });
  }

  const route = routeResult.value;
  const stale = staleReasons(state, contract, route);
  if (stale.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_STALE_ROUTE,
      reasons: stale,
      requiredArtifacts,
    });
  }

  const phaseNeedsChronology = PHASES_REQUIRING_EXECUTION_CHRONOLOGY.has(state.phase);
  let executionPrerequisites = null;
  if (phaseNeedsChronology) {
    try {
      executionPrerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot, taskId: explicitTaskId });
    } catch (error) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: [artifactError(
          error?.code ?? "E_PHASE_CHRONOLOGY_INVALID",
          `Unable to evaluate post-execution prerequisites: ${error?.message ?? String(error)}`,
          Array.isArray(error?.artifacts) ? error.artifacts : [eventsRel],
        )],
        requiredArtifacts: [
          stateRel,
          contractRel,
          routeRel,
          preflightRel,
          eventsRel,
        ],
      });
    }
    if (executionPrerequisites.errors.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: executionPrerequisites.errors,
        requiredArtifacts: executionPrerequisites.requiredArtifacts,
      });
    }
  }

  const preflight = executionPrerequisites?.preflight ?? await evaluatePreflight({ target, packageRoot, taskId: explicitTaskId });
  const preflightArtifact = phaseNeedsChronology
    ? null
    : await loadArtifact(
      () => readJsonArtifact(target, preflightRel, "preflight", packageRoot),
      preflightRel,
    );
  const missingGates = preflight.requiredGates.filter((gate) => !preflight.satisfiedGates.includes(gate));
  const preflightArtifacts = [...requiredArtifacts, preflightRel];
  const persistedPreflightErrors = phaseNeedsChronology
    ? []
    : validatePersistedPreflight(preflightArtifact.value?.value, preflight);

  if (["ROUTED", "DESIGNING", "PLANNED"].includes(state.phase) && missingGates.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.SATISFY_GATES,
      reasons: missingGates.map((gate) => artifactError(
        "E_GATE_UNVERIFIED",
        `Required gate is missing or unverified: ${gate}`,
        [`${ARTIFACT_PATHS.gates}/${gate}.json`],
      )),
      requiredArtifacts: [...preflightArtifacts, ...missingGates.map((gate) => `${ARTIFACT_PATHS.gates}/${gate}.json`)],
      missingArtifacts: missingGates.map((gate) => `${ARTIFACT_PATHS.gates}/${gate}.json`),
    });
  }
  if (state.phase === "ROUTED") {
    if (persistedPreflightErrors.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RUN_PREFLIGHT,
        reasons: persistedPreflightErrors,
        commands: [commandFor(NEXT_ACTIONS.RUN_PREFLIGHT)],
        requiredArtifacts: preflightArtifacts,
        missingArtifacts: preflightArtifact.missingArtifacts,
      });
    }
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_ROUTED", "Routing and required gates are ready for planning"));
  }
  if (state.phase === "DESIGNING") {
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_DESIGNING", "Required gates are ready for planning"));
  }
  if (state.phase === "PLANNED") {
    const prerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot, taskId: explicitTaskId });
    if (prerequisites.errors.length > 0) {
      const preflightOnly = prerequisites.errors.every((error) => error.code.startsWith("E_PREFLIGHT_")
        || (error.code === "E_PHASE_CHRONOLOGY_INVALID"
          && error.message === PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE));
      if (preflightOnly) {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RUN_PREFLIGHT,
          reasons: prerequisites.errors,
          commands: [commandFor(NEXT_ACTIONS.RUN_PREFLIGHT)],
          requiredArtifacts: prerequisites.requiredArtifacts,
          missingArtifacts: preflightArtifact.missingArtifacts,
        });
      }
      const routeOnly = prerequisites.errors.every((error) => error.code === "E_ROUTE_STALE" || error.code === "E_ROUTE_GUIDE_MISMATCH");
      return result({
        ...context,
        nextAction: routeOnly ? NEXT_ACTIONS.RESOLVE_STALE_ROUTE : NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: prerequisites.errors,
        requiredArtifacts: prerequisites.requiredArtifacts,
        missingArtifacts: preflightArtifact.missingArtifacts,
      });
    }
    return decision(context, NEXT_ACTIONS.START_EXECUTION, artifactError("PHASE_PLANNED", "The persisted preflight is READY"));
  }
  if (state.phase === "EXECUTING") {
    const continuityAction = await evaluateContinuityNextAction({ target, packageRoot, context });
    if (continuityAction) return continuityAction;
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_EXECUTING", "Execution is complete enough to enter verification"));
  }
  if (state.phase === "VERIFYING") {
    const invalidChecks = checkListReasons(state);
    if (invalidChecks.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: invalidChecks,
        requiredArtifacts,
      });
    }
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
      authorityContext,
      runtimeContext,
    });
    const authoritative = authoritativeChecksForRequirements({
      requirements: ordinaryLeafRequirements(evidence.requirements),
      checks: state.checks,
    });
    const failed = authoritative.find(({ check }) => check?.status === "failed");
    if (failed) {
      return decision(
        context,
        NEXT_ACTIONS.DIAGNOSE,
        artifactError("E_CHECK_FAILED", `Observed check failed: ${failed.check.id}`, [stateRel]),
      );
    }
    const blocked = authoritative.find(({ check }) => check?.status === "blocked");
    if (blocked) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_CHECK_BLOCKED", `Observed check is blocked: ${blocked.check.id}`, [stateRel]),
      );
    }
    const receipt = await loadArtifact(
      () => readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot),
      receiptRel,
    );
    if (receipt.error) {
      if (receipt.error.code === "ARTIFACT_MISSING") {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_MISSING", "Prepare the execution receipt before recording verification checks", [receiptRel]),
          [...requiredArtifacts, receiptRel],
          receipt.missingArtifacts,
        );
      }
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${receipt.error.message}`, [receiptRel]),
        [...requiredArtifacts, receiptRel],
      );
    }
    try {
      await validateReceipt(receipt.value.value, packageRoot, {
        target,
        taskId: contract?.value?.taskId,
        authorityContext,
        runtimeContext,
      });
    } catch (error) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${error.message}`, [receiptRel]),
        [...requiredArtifacts, receiptRel],
      );
    }
    const readiness = evaluateRequiredEvidence({
      requirements: evidence.requirements,
      checks: state.checks,
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    });
    const receiptRelationships = completionRelationshipErrors({
      contract,
      route,
      state,
      receipt: receipt.value.value,
      requiredEvidence: evidence.requirements,
      requireRequiredChecks: false,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    if (receiptRelationships.length > 0) {
      if (receiptRelationships.some((err) => (
        err.code === "E_RECEIPT_STATE_MISMATCH"
        || err.code === "E_RECEIPT_CYCLE_MISMATCH"
        || err.code === "E_RECEIPT_CONTRACT_MISMATCH"
        || err.code === "E_ROUTE_GUIDE_MISMATCH"
        || err.code === "E_EVIDENCE_COVERAGE_INVALID"
      ))) {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_STATE_MISMATCH", "Run forgeloop prepare-completion to refresh the execution receipt with current state", [receiptRel]),
          [...requiredArtifacts, receiptRel],
        );
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: receiptRelationships,
        requiredArtifacts: [...requiredArtifacts, receiptRel],
      });
    }
    if (readiness.ready) {
      return decision(context, NEXT_ACTIONS.ENTER_REVIEWING, artifactError("EVIDENCE_COVERED", "All required observed verification evidence is covered"));
    }
    const uncovered = [...readiness.invalid, ...readiness.partial, ...readiness.missing];
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RECORD_VERIFICATION,
      commands: ["forgeloop record-check"],
      commandSpecs: uncovered.map((item) => recordCheckCommandSpec(item.text)),
      reasons: uncovered
        .map((item) => artifactError(
          readiness.invalid.some((candidate) => candidate.id === item.id)
            ? "E_EVIDENCE_INVALID"
            : readiness.partial.some((candidate) => candidate.id === item.id)
              ? "E_EVIDENCE_PARTIAL"
              : "E_EVIDENCE_REQUIRED",
          "Run the required check and record observed evidence through the structured command specification.",
          [stateRel],
        )),
      requiredArtifacts: requiredArtifacts,
    });
  }
  if (state.phase === "DIAGNOSING") {
    const ledger = await validateEventLedger(target, packageRoot, { taskId: normalized.taskId ?? null });
    const cycle = state.verificationCycle ?? 1;
    const diagEvent = resolveCurrentCycleDiagnostic(ledger.events, state.taskId, cycle);
    if (!diagEvent) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RECORD_DIAGNOSIS,
        reasons: [
          artifactError(
            "E_DIAGNOSIS_REQUIRED",
            "Current correction cycle has no append-only diagnosis record.",
            [eventsRel],
          ),
        ],
        commandSpecs: [recordDiagnosisCommandSpec()],
        requiredArtifacts: [...requiredArtifacts, eventsRel],
      });
    }
    const progress = evaluateProgress({ state, events: ledger.events });
    if (progress.status === PROGRESS_STATUS.STALLED) {
      let oscillating = false;
      try {
        const reflection = await buildTaskReflection({ target, packageRoot, taskId: normalized.taskId ?? null });
        oscillating = reflection.oscillation.detected;
      } catch {
        // Reflection is advisory guidance; stall handling must not depend on it.
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.CHANGE_STRATEGY,
        reasons: [
          artifactError(
            "E_PROGRESS_STALLED",
            "The current correction strategy has no new diagnostic information.",
            [stateRel, eventsRel],
          ),
        ],
        progress,
        diagnosticGuidance: {
          action: oscillating ? NEXT_ACTIONS.INTRODUCE_NEW_OBSERVATION : NEXT_ACTIONS.REQUIRE_NEW_DIAGNOSTIC_INFORMATION,
          signals: oscillating ? ["OSCILLATING_STRATEGY"] : ["NO_INFORMATION_GAIN", ...progress.signals.map((signal) => signal.code)],
          errorCodes: oscillating ? ["E_STRATEGY_OSCILLATION", "E_PROGRESS_STALLED"] : ["E_PROGRESS_STALLED"],
        },
        requiredArtifacts,
      });
    }
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.CORRECT,
      commands: [commandFor(NEXT_ACTIONS.CORRECT)],
      reasons: [
        artifactError("PHASE_DIAGNOSING", "The persisted diagnosis hypothesis permits correction"),
      ],
      ...(progress.status === PROGRESS_STATUS.WATCH ? { progress } : {}),
      requiredArtifacts,
    });
  }
  if (state.phase === "CORRECTING") {
    const ledgerForCorrection = await validateEventLedger(target, packageRoot, { taskId: normalized.taskId ?? null });
    const correctionCycle = state.verificationCycle ?? 1;
    const hasStructuredCase = ledgerForCorrection.events.some(
      (event) => event.event === "DIAGNOSTIC_CASE_RECORDED"
        && event.taskId === state.taskId
        && event.details?.verificationCycle === correctionCycle,
    );
    const hasIntervention = ledgerForCorrection.events.some(
      (event) => event.event === "INTERVENTION_RECORDED"
        && event.taskId === state.taskId
        && event.details?.verificationCycle === correctionCycle,
    );
    if (hasStructuredCase && !hasIntervention) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.ENTER_VERIFYING,
        reasons: [
          artifactError("PHASE_CORRECTING", "A structured diagnostic case is awaiting a recorded intervention"),
        ],
        diagnosticGuidance: {
          action: NEXT_ACTIONS.RECORD_INTERVENTION,
          signals: ["INTERVENTION_NOT_BOUND_TO_HYPOTHESIS"],
          errorCodes: [],
          commandSpecs: [recordInterventionCommandSpec(normalized.taskId)],
        },
        requiredArtifacts,
      });
    }
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_CORRECTING", "Correction is ready for verification"));
  }
  if (state.phase === "REVIEWING") {
    const invalidChecks = checkListReasons(state);
    if (invalidChecks.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: invalidChecks,
        requiredArtifacts,
      });
    }
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
      authorityContext,
      runtimeContext,
    });
    const readiness = evaluateRequiredEvidence({
      requirements: evidence.requirements,
      checks: state.checks,
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    });
    if (!readiness.ready) {
      let recoveryAuthorized = false;
      if (state.lastCompletionAttempt?.status === "REJECTED") {
        try {
          const ledger = await validateEventLedger(target, packageRoot, { taskId: explicitTaskId, eventsPath: eventsRel });
          let currentReceipt = null;
          try {
            const receiptArtifact = await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot);
            currentReceipt = receiptArtifact?.value;
          } catch {}
          const recoveryAuth = validateCompletionRecoveryAuthorization({
            state,
            receipt: currentReceipt,
            events: ledger.events,
          });
          recoveryAuthorized = recoveryAuth.authorized;
        } catch {
          recoveryAuthorized = false;
        }
      }
      return result({
        ...context,
        nextAction: recoveryAuthorized
          ? NEXT_ACTIONS.ENTER_VERIFYING
          : NEXT_ACTIONS.RESOLVE_BLOCKER,
        commands: recoveryAuthorized
          ? [commandFor(NEXT_ACTIONS.ENTER_VERIFYING)]
          : [],
        reasons: [...readiness.invalid, ...readiness.partial, ...readiness.missing]
          .map((item) => artifactError(
            readiness.missing.some((candidate) => candidate.id === item.id)
              ? "E_EVIDENCE_REQUIRED"
              : item.reasonCode ?? "E_EVIDENCE_PARTIAL",
            `Evidence is not ready: ${item.text}`,
            [stateRel],
          )),
        requiredArtifacts,
      });
    }
    const receipt = await loadArtifact(
      () => readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot),
      receiptRel,
    );
    if (receipt.error) {
      if (receipt.error.code !== "ARTIFACT_MISSING") {
        return decision(
          context,
          NEXT_ACTIONS.RESOLVE_BLOCKER,
          artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${receipt.error.message}`, [receiptRel]),
          [...requiredArtifacts, receiptRel],
        );
      }
      return decision(
        context,
        NEXT_ACTIONS.PREPARE_COMPLETION,
        artifactError(
          receipt.error.code === "ARTIFACT_MISSING" ? "E_RECEIPT_MISSING" : "E_RECEIPT_INVALID",
          receipt.error.message,
          [receiptRel],
        ),
        [...requiredArtifacts, receiptRel],
        receipt.missingArtifacts,
      );
    }
    try {
      await validateReceipt(receipt.value.value, packageRoot, {
        target,
        taskId: contract?.value?.taskId,
        authorityContext,
        runtimeContext,
      });
    } catch (error) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${error.message}`, [receiptRel]),
        [...requiredArtifacts, receiptRel],
      );
    }
    const receiptRelationships = completionRelationshipErrors({
      contract,
      route,
      state,
      receipt: receipt.value.value,
      requiredEvidence: evidence.requirements,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    if (receiptRelationships.length > 0) {
      if (receiptRelationships.some((err) => (
        err.code === "E_RECEIPT_STATE_MISMATCH"
        || err.code === "E_RECEIPT_CYCLE_MISMATCH"
        || err.code === "E_RECEIPT_CONTRACT_MISMATCH"
        || err.code === "E_ROUTE_GUIDE_MISMATCH"
        || err.code === "E_EVIDENCE_COVERAGE_INVALID"
      ))) {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_STATE_MISMATCH", "Run forgeloop prepare-completion to refresh the execution receipt with current state", [receiptRel]),
          [...requiredArtifacts, receiptRel],
        );
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: receiptRelationships,
        requiredArtifacts: [...requiredArtifacts, receiptRel],
      });
    }

    const completion = await evaluateCompletion({ target, packageRoot, taskId: explicitTaskId, authorityContext, runtimeContext });
    if (completion.status !== "VALID") {
      const terminalPendingErrors = completion.errors.filter((err) => (
        err.code === "E_PUBLICATION_REQUIREMENT_PENDING" || err.code === "E_PRODUCTION_REQUIREMENT_PENDING"
      ));
      if (terminalPendingErrors.length > 0 && terminalPendingErrors.length === completion.errors.length) {
        const terminalPendingReqs = terminalPendingErrors.map((err) => {
          const reqId = err.requirementId;
          const matchingReq = evidence.requirements.find((r) => r.id === reqId)
            ?? evidence.requirements.find((r) => r.text === reqId)
            ?? classifyRequirement(reqId ?? err.message);
          return matchingReq;
        });
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RECORD_TERMINAL_RESULT,
          commands: ["forgeloop record-terminal-result"],
          commandSpecs: terminalPendingReqs.map(recordTerminalResultCommandSpec),
          reasons: completion.errors,
          requiredArtifacts: [...requiredArtifacts, receiptRel, eventsRel],
        });
      }
      const policyAction = policyRecoveryAction(completion.errors);
      if (policyAction) {
        return result({
          ...context,
          nextAction: policyAction,
          reasons: completion.errors,
          requiredArtifacts: [...requiredArtifacts, receiptRel, eventsRel],
        });
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: completion.errors,
        requiredArtifacts: [...requiredArtifacts, receiptRel, eventsRel],
      });
    }
    return decision(context, NEXT_ACTIONS.RUN_COMPLETE, artifactError("COMPLETION_READY", "Completion artifacts and cross-artifact validation are valid"));
  }
  if (state.phase === "COMPLETE") {
    const completion = await evaluateCompletion({ target, packageRoot, taskId: explicitTaskId, authorityContext, runtimeContext });
    if (completion.status === "VALID") {
      return decision(context, NEXT_ACTIONS.NONE, artifactError("PHASE_COMPLETE", "Completion is validator-backed and terminal"));
    }
    const policyAction = policyRecoveryAction(completion.errors);
    return result({
      ...context,
      nextAction: policyAction ?? NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: completion.errors,
      requiredArtifacts: [...requiredArtifacts, receiptRel, eventsRel],
    });
  }
  if (state.phase === "BLOCKED") {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: state.blockers.map((blocker) => artifactError(
        "WORK_STATE_BLOCKED",
        blocker.reason ?? "Work state has a recorded blocker",
        [stateRel],
      )),
      requiredArtifacts,
    });
  }

  return decision(
    context,
    NEXT_ACTIONS.RESOLVE_BLOCKER,
    artifactError("E_PHASE_UNSUPPORTED", `Unsupported persisted phase: ${state.phase}`, [ARTIFACT_PATHS.state]),
    requiredArtifacts,
  );
}

export async function getNextAction(targetOrOptions = {}, packageRootOption) {
  const res = await computeNextAction(targetOrOptions, packageRootOption);
  if (res && res.reasons && res.reasons.some((r) => r.code === "E_CONTRACT_UNRESOLVED_DECISION" || r.code === "E_UNRESOLVED_DECISION")) {
    const normalized = typeof targetOrOptions === "string" ? { target: targetOrOptions, packageRoot: packageRootOption } : targetOrOptions;
    const { target, packageRoot, taskId } = normalized ?? {};
    try {
      const explicitTaskId = taskId ?? null;
      const contract = await readContract(target, packageRoot, { taskId: explicitTaskId });
      const events = await readEvents(target, packageRoot, { taskId: explicitTaskId });
      if (contract?.value?.unresolvedDecisions?.length > 0) {
        const foundCriteria = [];
        for (const dec of contract.value.unresolvedDecisions) {
          const criterion = criterionForDecision(events, res.taskId, dec, contract.fingerprint);
          if (criterion) {
            foundCriteria.push({
              decisionId: criterion.decisionId,
              decision: dec,
              settledBy: criterion.settledBy,
            });
          }
        }

        if (foundCriteria.length > 0) {
          let resolution;
          if (foundCriteria.length === 1) {
            resolution = {
              kind: "SETTLEMENT_CRITERION",
              itemId: foundCriteria[0].decisionId,
              decision: foundCriteria[0].decision,
              settledBy: foundCriteria[0].settledBy,
            };
          } else {
            resolution = {
              kind: "SETTLEMENT_CRITERIA",
              items: foundCriteria,
            };
          }

          const enrichedReasons = res.reasons.map((r) => {
            if (r.code === "E_CONTRACT_UNRESOLVED_DECISION" || r.code === "E_UNRESOLVED_DECISION") {
              return {
                ...r,
                resolution,
              };
            }
            return r;
          });

          return result({
            ...res,
            reasons: enrichedReasons,
          });
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return res;
}
