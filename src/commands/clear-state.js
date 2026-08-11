import { clearWorkState } from "../core/work-state.js";

export { clearWorkState };

export async function runClearState({ target }) {
  return clearWorkState(target);
}

export function formatClearStateResult(result) {
  return `${result.removed ? "removed" : "absent"}: ${result.path}\n`;
}
