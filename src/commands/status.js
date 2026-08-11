import { readAndClassifyWorkState } from "../core/work-state.js";
import { inspectSchemaHealth } from "../core/schema-validation.js";

export async function runStatus({ target, packageRoot, contractFile = null }) {
  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile });
  const protocol = await inspectSchemaHealth(target);
  return {
    ...state,
    protocol,
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
  if (result.error) lines.push(`Error: ${result.error}`);
  return `${lines.join("\n")}\n`;
}
