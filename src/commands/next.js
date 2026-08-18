import { getNextAction } from "../core/next-action.js";
import { withResolvedTask } from "../core/task-command.js";

export async function runNext({ target, packageRoot, taskId, task }) {
  return withResolvedTask(target, { taskId: taskId ?? task, packageRoot }, async (ctx) => {
    return getNextAction({ target, packageRoot, taskId: ctx?.taskId ?? null });
  });
}

export function formatNextActionResult(result) {
  const lines = [
    `FORGELOOP NEXT: ${result.nextAction}`,
    `PHASE: ${result.currentPhase}`,
  ];
  if (result.reasons.length > 0) {
    lines.push("REASONS:");
    for (const reason of result.reasons) {
      lines.push(`- ${reason.code}: ${reason.message}`);
      if (reason.resolution?.kind === "SETTLEMENT_CRITERION" && reason.resolution.settledBy) {
        lines.push(`  SETTLED BY: ${reason.resolution.settledBy}`);
      }
    }
  }
  if (result.progress) {
    lines.push(`PROGRESS: ${result.progress.status}`);
  }
  if (result.commands.length > 0) {
    lines.push("COMMANDS (SAFE SYNOPSIS ONLY):");
    lines.push(...result.commands.map((command) => `- ${command}`));
  }
  if (result.commandSpecs.length > 0) {
    lines.push("STRUCTURED COMMAND SPECS: Available in --json output; direct-process argv data, not shell syntax.");
  }
  if (result.missingArtifacts.length > 0) {
    lines.push("MISSING ARTIFACTS:");
    lines.push(...result.missingArtifacts.map((artifact) => `- ${artifact}`));
  }
  if (result.terminal) lines.push("STATE: TERMINAL");
  return `${lines.join("\n")}\n`;
}
