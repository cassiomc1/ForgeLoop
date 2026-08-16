import { clearContinuity } from "../core/continuity.js";

export async function runClearContinuity({ target } = {}) {
  return clearContinuity(target);
}

export function formatClearContinuityResult(result) {
  return `${result.removed ? "cleared" : "absent"}: ${result.path}\n`;
}
