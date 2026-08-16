import { reconcileContinuity } from "../core/continuity-reconciliation.js";

export async function runContinuity({ target, packageRoot } = {}) {
  return reconcileContinuity({ target, packageRoot });
}

export function formatContinuityResult(result) {
  const value = result.continuity;
  const lines = [
    "FORGELOOP EXECUTION CONTINUITY",
    "",
    `classification: ${result.classification}`,
    `task: ${value?.taskId ?? "none"}`,
    `phase: ${value?.phase ?? "none"}`,
    `current focus: ${value?.currentFocus?.id ?? "none"}`,
    `remaining work: ${value?.remainingWork?.length ?? 0}`,
    `known issues: ${value?.knownIssues?.length ?? 0}`,
    `inspect first: ${value?.inspectFirst?.join(", ") || "none"}`,
    "",
    "Authority: OPERATIONAL_CONTEXT_ONLY",
    "Evidence: NONE",
  ];
  if (result.reasons?.length) lines.push(`Reasons: ${result.reasons.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
