import { ARTIFACT_PATHS } from "./artifacts.js";
import { reconcileContinuity } from "./continuity-reconciliation.js";
import { NEXT_ACTIONS, result } from "./next-action-model.js";

const REQUIRED_ARTIFACTS = Object.freeze([ARTIFACT_PATHS.state, ARTIFACT_PATHS.continuity]);

function reason(code, message, artifacts = REQUIRED_ARTIFACTS) {
  return { code, message, artifacts };
}

export function nextActionForContinuity({ context, continuity } = {}) {
  if (!continuity || ["ABSENT", "NOT_APPLICABLE"].includes(continuity.classification)) return null;

  if (continuity.classification === "FRESH") {
    const remaining = continuity.continuity?.remainingWork ?? [];
    if (remaining.length === 0) return null;
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.CONTINUE_IMPLEMENTATION,
      reasons: [reason(
        "CONTINUITY_REMAINING_WORK",
        `Execution continuity records ${remaining.length} remaining implementation item${remaining.length === 1 ? "" : "s"}.`,
        [ARTIFACT_PATHS.continuity],
      )],
      requiredArtifacts: REQUIRED_ARTIFACTS,
    });
  }

  if (continuity.classification === "RECONCILIATION_REQUIRED") {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      commands: ["forgeloop reconcile-continuity"],
      reasons: [reason(
        "E_CONTINUITY_RECONCILIATION_REQUIRED",
        "Execution continuity no longer matches canonical state or the current checkout; reconcile it before advancing verification.",
      )],
      requiredArtifacts: REQUIRED_ARTIFACTS,
    });
  }

  if (["INVALID", "INCONSISTENT"].includes(continuity.classification)) {
    const codes = continuity.reasonCodes?.length > 0
      ? continuity.reasonCodes
      : [continuity.classification === "INVALID" ? "E_CONTINUITY_INVALID" : "E_CONTINUITY_INCONSISTENT"];
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: codes.map((code, index) => reason(
        code,
        continuity.reasons?.[index] ?? `Execution continuity is ${continuity.classification.toLowerCase()}.`,
      )),
      requiredArtifacts: REQUIRED_ARTIFACTS,
    });
  }

  return null;
}

export async function evaluateContinuityNextAction({ target, packageRoot, context } = {}) {
  return nextActionForContinuity({
    context,
    continuity: await reconcileContinuity({ target, packageRoot }),
  });
}
