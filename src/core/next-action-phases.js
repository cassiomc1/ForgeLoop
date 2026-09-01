import { ARTIFACT_PATHS, readJsonArtifact } from "./artifacts.js";
import { taskArtifactPath, taskStructuralQualityDirectory } from "./task-paths.js";
import { completionIdentityErrors, evaluateCompletion } from "./completion.js";
import { readContract } from "./contract.js";
import { evaluatePreflight, validatePersistedPreflight } from "./preflight.js";
import { validateReceipt } from "./receipt.js";
import { readPersistedRoute } from "./route-artifact.js";
import { completionRelationshipErrors } from "./completion-relationships.js";
import { classifyLoadedWorkState } from "./work-state.js";
import { evaluateRequiredEvidence, authoritativeChecksForRequirements, ordinaryLeafRequirements, classifyRequirement } from "./evidence-readiness.js";
import { evaluateStartExecutionPrerequisites, PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE } from "./execution-prerequisites.js";
import { validateEventLedger, validateCompletionRecoveryAuthorization } from "./events.js";
import { NEXT_ACTIONS, commandFor, decision, recordCheckCommandSpec, recordDiagnosisCommandSpec, recordInterventionCommandSpec, recordTerminalResultCommandSpec, recoveryGuidanceForClassification, result, uniqueSorted } from "./next-action-model.js";
import { artifactError, checkListReasons, freshnessReasons, loadArtifact, requirementsAndCoverage, staleReasons } from "./next-action-artifacts.js";
import { resolveCurrentCycleDiagnostic } from "./diagnostic-projection.js";
import { buildTaskReflection } from "./reflection.js";
import { evaluateProgress, PROGRESS_STATUS } from "./progress.js";
import { inspectTaskConflictState } from "./task-conflict-inspection.js";
import { listActions } from "./actions.js";
import { listApprovals } from "./approvals.js";
import { loadPolicyIdentity } from "./policy-engine.js";
import { evaluateContinuityNextAction } from "./next-action-continuity.js";
import { projectStructuralQualityStatus } from "./structural-quality/service.js";

export const PHASES_REQUIRING_EXECUTION_CHRONOLOGY = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

export function phaseRequiresExecutionChronology(phase) {
  return PHASES_REQUIRING_EXECUTION_CHRONOLOGY.has(phase);
}

export async function resolveNextActionPhase({
  target,
  packageRoot,
  explicitTaskId,
  normalized,
  state,
  context,
  stateRel,
  preflightRel,
  contractRel,
  routeRel,
  receiptRel,
  eventsRel,
  authorityContext,
  runtimeContext,
  helpers,
} = {}) {
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
    policyRecoveryAction,
  } = helpers;
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
    const quality = await projectStructuralQualityStatus({ target, packageRoot, taskId: explicitTaskId ?? state.taskId });
    if (quality.mode === "gate" && quality.baseline.status !== "OBSERVED") {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.CAPTURE_STRUCTURAL_QUALITY_BASELINE,
        commands: [commandFor(NEXT_ACTIONS.CAPTURE_STRUCTURAL_QUALITY_BASELINE).replace("<id>", state.taskId)],
        reasons: [artifactError("E_STRUCTURAL_QUALITY_BASELINE_MISSING", "Gate mode requires a structural-quality baseline before execution", [quality.baseline.artifactRef ?? taskArtifactPath(state.taskId, "structuralQuality")])],
        requiredArtifacts: [taskArtifactPath(state.taskId, "structuralQuality")],
      });
    }
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
    const quality = await projectStructuralQualityStatus({ target, packageRoot, taskId: explicitTaskId ?? state.taskId });
    if (quality.mode === "gate") {
      if (quality.baseline.status !== "OBSERVED") {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RESOLVE_STRUCTURAL_QUALITY_BLOCKER,
          reasons: [artifactError("E_STRUCTURAL_QUALITY_BASELINE_MISSING", "Structural-quality gate cannot verify without its immutable baseline", [taskArtifactPath(state.taskId, "structuralQuality")])],
          requiredArtifacts: [taskArtifactPath(state.taskId, "structuralQuality")],
        });
      }
      if (!quality.current.artifactRef || quality.current.verificationCycle !== (state.verificationCycle ?? 1)) {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.VERIFY_STRUCTURAL_QUALITY,
          commands: [commandFor(NEXT_ACTIONS.VERIFY_STRUCTURAL_QUALITY).replace("<id>", state.taskId)],
          reasons: [artifactError("E_STRUCTURAL_QUALITY_EVIDENCE_STALE", "The current verification cycle has no structural-quality evaluation", [taskStructuralQualityDirectory(state.taskId)])],
          requiredArtifacts: [taskStructuralQualityDirectory(state.taskId)],
        });
      }
      if (quality.current.status === "FAIL") {
        return decision(context, NEXT_ACTIONS.DIAGNOSE_STRUCTURAL_QUALITY_REGRESSION, artifactError("E_STRUCTURAL_QUALITY_REGRESSION", "Structural-quality verification detected a regression", [quality.current.artifactRef]));
      }
      if (quality.current.status === "BLOCKED") {
        return decision(context, NEXT_ACTIONS.RESOLVE_STRUCTURAL_QUALITY_BLOCKER, artifactError("E_STRUCTURAL_QUALITY_EVALUATION_INCOMPARABLE", "Structural-quality verification is blocked", [quality.current.artifactRef]));
      }
    }
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
