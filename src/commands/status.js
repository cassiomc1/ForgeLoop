import {
  classifyWorkState,
  currentRepositoryFingerprint,
  readWorkState,
  WORK_STATE_PATH,
} from "../core/work-state.js";

export async function runStatus({ target, packageRoot }) {
  let state = null;
  let error = null;
  try {
    state = await readWorkState(target, packageRoot);
  } catch (caught) {
    error = caught.message;
  }
  if (error) {
    return {
      path: WORK_STATE_PATH,
      status: "INVALID",
      reasons: ["STATE_INVALID"],
      error,
      state: null,
      completed: [],
      pending: [],
      repository: await currentRepositoryFingerprint(target),
    };
  }

  const repository = await currentRepositoryFingerprint(target);
  const classification = classifyWorkState(state, repository);
  return {
    path: WORK_STATE_PATH,
    status: classification.status,
    reasons: classification.reasons,
    state,
    phase: state?.phase ?? null,
    completed: state?.completedSteps ?? [],
    pending: state?.pendingSteps ?? [],
    repository,
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
  if (result.error) lines.push(`Error: ${result.error}`);
  return `${lines.join("\n")}\n`;
}
