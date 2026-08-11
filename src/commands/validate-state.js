import { readWorkState, WORK_STATE_PATH } from "../core/work-state.js";

export async function runValidateState({ target, packageRoot }) {
  try {
    const state = await readWorkState(target, packageRoot);
    if (!state) {
      return {
        ok: true,
        path: WORK_STATE_PATH,
        state: null,
        errors: [],
        warnings: ["No work-state checkpoint is present."],
      };
    }
    return { ok: true, path: WORK_STATE_PATH, state, errors: [], warnings: [] };
  } catch (error) {
    return {
      ok: false,
      path: WORK_STATE_PATH,
      state: null,
      errors: [error.message],
      warnings: [],
    };
  }
}

export function formatValidateStateResult(result) {
  if (result.ok) return `valid: ${result.path}\n`;
  return `invalid: ${result.path}\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`;
}
