import { getNextAction } from "../core/next-action.js";

export async function runNext({ target, packageRoot }) {
  return getNextAction({ target, packageRoot });
}

export function formatNextActionResult(result) {
  const lines = [
    `FORGELOOP NEXT: ${result.nextAction}`,
    `PHASE: ${result.currentPhase}`,
  ];
  if (result.reasons.length > 0) {
    lines.push("REASONS:");
    lines.push(...result.reasons.map((reason) => `- ${reason.code}: ${reason.message}`));
  }
  if (result.commands.length > 0) {
    lines.push("COMMANDS:");
    lines.push(...result.commands.map((command) => `- ${command}`));
  }
  if (result.missingArtifacts.length > 0) {
    lines.push("MISSING ARTIFACTS:");
    lines.push(...result.missingArtifacts.map((artifact) => `- ${artifact}`));
  }
  if (result.terminal) lines.push("STATE: TERMINAL");
  return `${lines.join("\n")}\n`;
}
