import { advanceWorkState } from "../core/phase.js";

export { advanceWorkState };

export async function runAdvance({ target, packageRoot, to }) {
  if (!to) throw new Error("--to is required for advance");
  return advanceWorkState(target, to, { packageRoot });
}

export function formatAdvanceResult(result) {
  return `phase: ${result.phase}\nprevious: ${result.previousPhase ?? "none"}\n`;
}
