import { taskArtifactPath } from "./task-paths.js";
import { evaluateStartExecutionPrerequisites, PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE } from "./execution-prerequisites.js";
import { NEXT_ACTIONS, commandFor, decision, result } from "./next-action-model.js";
import { artifactError } from "./next-action-artifacts.js";
import { projectStructuralQualityStatus } from "./structural-quality/service.js";
import { structuralQualityOptionalActions } from "./next-action-quality-guidance.js";

export async function resolvePlannedPhase({ target, packageRoot, explicitTaskId, state, runtimeContext, context, preflightArtifact }) {
    const quality = await projectStructuralQualityStatus({ target, packageRoot, taskId: explicitTaskId ?? state.taskId, runtimeContext });
    if (quality.mode === "gate" && quality.baseline.status !== "OBSERVED") {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.CAPTURE_STRUCTURAL_QUALITY_BASELINE,
        commands: [commandFor(NEXT_ACTIONS.CAPTURE_STRUCTURAL_QUALITY_BASELINE).replace("<id>", state.taskId)],
        reasons: [artifactError("E_STRUCTURAL_QUALITY_BASELINE_MISSING", "Gate mode requires a structural-quality baseline before execution", [quality.baseline.artifactRef ?? taskArtifactPath(state.taskId, "structuralQuality")])],
        requiredArtifacts: [taskArtifactPath(state.taskId, "structuralQuality")],
      });
    }
    const prerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot, taskId: explicitTaskId, runtimeContext });
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
    return decision(
      context,
      NEXT_ACTIONS.START_EXECUTION,
      artifactError("PHASE_PLANNED", "The persisted preflight is READY"),
      [],
      [],
      structuralQualityOptionalActions(quality, state.taskId),
    );
  }
