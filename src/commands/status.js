import { readAndClassifyWorkState } from "../core/work-state.js";
import { inspectSchemaHealth } from "../core/schema-validation.js";
import { reconcileContinuity } from "../core/continuity-reconciliation.js";

export async function runStatus({ target, packageRoot, contractFile = null, taskId, task } = {}) {
  const effectiveTaskId = taskId ?? task ?? null;
  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile, taskId: effectiveTaskId });
  const [protocol, continuity] = await Promise.all([
    inspectSchemaHealth(target),
    reconcileContinuity({ target, packageRoot, taskId: effectiveTaskId }),
  ]);
  return {
    ...state,
    protocol,
    continuity,
    evidence: [...(state.evidence ?? []), ...(protocol.evidence ?? [])],
  };
}

export function formatStatusResult(result) {
  const lines = [
    `State: ${result.path}`,
    `Status: ${result.status}`,
    `Phase: ${result.phase ?? "none"}`,
    `Completed: ${result.completed.join(", ") || "none"}`,
    `Pending: ${result.pending.join(", ") || "none"}`,
  ];
  if (result.reasons.length > 0) lines.push(`Reasons: ${result.reasons.join(", ")}`);
  if (result.warnings?.length > 0) lines.push(`Warnings: ${result.warnings.join(", ")}`);
  if (result.contractComparison) lines.push(`Contract: ${result.contractComparison}`);
  if (result.artifactComparison) lines.push(`Artifacts: ${result.artifactComparison}`);
  if (result.protocol) lines.push(`Schemas: ${result.protocol.status}`);
  if (result.continuity) {
    const continuity = result.continuity.continuity;
    lines.push(`Continuity: ${result.continuity.classification}`);
    lines.push(`Continuity focus: ${continuity?.currentFocus?.id ?? "none"}`);
    lines.push(`Continuity remaining: ${continuity?.remainingWork?.length ?? 0}`);
    lines.push(`Continuity known issues: ${continuity?.knownIssues?.length ?? 0}`);
    lines.push(`Continuity authority: ${result.continuity.authority ?? "OPERATIONAL_CONTEXT_ONLY"}`);
  }
  if (result.error) lines.push(`Error: ${result.error}`);
  return `${lines.join("\n")}\n`;
}
