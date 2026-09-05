import { NEXT_ACTIONS } from "./next-action-model.js";

export function structuralQualityOptionalActions(quality, taskId) {
  if (quality?.mode !== "observe") return [];
  if (quality.baseline?.status !== "OBSERVED") {
    return [{
      action: NEXT_ACTIONS.CAPTURE_STRUCTURAL_QUALITY_BASELINE,
      command: `forgeloop quality-baseline --task ${taskId} --json`,
    }];
  }
  if (quality.freshness === "STALE" || quality.current?.verificationCycle === null
    || quality.current?.verificationCycle === undefined) {
    return [{
      action: NEXT_ACTIONS.VERIFY_STRUCTURAL_QUALITY,
      command: `forgeloop quality-verify --task ${taskId} --json`,
    }];
  }
  return [];
}
