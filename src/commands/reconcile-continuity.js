import { reconcileContinuity } from "../core/continuity-reconciliation.js";

export async function runReconcileContinuity({ target, packageRoot } = {}) {
  return reconcileContinuity({ target, packageRoot });
}

export function formatReconcileContinuityResult(result) {
  const lines = [
    `Continuity: ${result.path ?? ".forgeloop/continuity.json"}`,
    `Classification: ${result.classification}`,
    `Task matches: ${result.taskMatches ?? "not-verified"}`,
    `Work state matches: ${result.workStateMatches ?? "not-verified"}`,
    `Contract matches: ${result.contractMatches ?? "not-verified"}`,
    `Phase matches: ${result.phaseMatches ?? "not-verified"}`,
    `Repository: ${result.repositoryComparison}`,
    `Changed paths: ${result.changedPathComparison}`,
    "Authority: OPERATIONAL_CONTEXT_ONLY",
    "Evidence: NONE",
  ];
  if (result.reasonCodes?.length) lines.push(`Reason codes: ${result.reasonCodes.join(", ")}`);
  if (result.reasons?.length) lines.push(`Reasons: ${result.reasons.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
