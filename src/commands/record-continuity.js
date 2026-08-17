import { writeContinuity } from "../core/continuity.js";

function parseWorkItem(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must use <id>:<summary>`);
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`${label} must use <id>:<summary>`);
  }
  return {
    id: value.slice(0, separator).trim(),
    summary: value.slice(separator + 1).trim(),
  };
}

export async function runRecordContinuity({
  target,
  packageRoot,
  focusId,
  focusSummary,
  remaining = [],
  knownIssues = [],
  changedAreas = [],
  inspectFirst = [],
  resumeNote,
  state,
  contract,
  repositoryFingerprint,
  now,
  dryRun = false,
  taskId,
  task,
} = {}) {
  if ((focusId && !focusSummary) || (!focusId && focusSummary)) {
    throw new Error("record-continuity requires --focus-id and --focus-summary together");
  }
  const effectiveTaskId = taskId ?? task ?? null;
  return writeContinuity(target, {
    ...(focusId ? { currentFocus: { id: focusId, summary: focusSummary } } : {}),
    remainingWork: remaining.map((item) => parseWorkItem(item, "--remaining")),
    knownIssues: knownIssues.map((item) => parseWorkItem(item, "--known-issue")),
    changedAreas,
    inspectFirst,
    ...(resumeNote ? { resumeNote } : {}),
  }, {
    packageRoot,
    ...(state ? { state } : {}),
    ...(contract ? { contract } : {}),
    ...(repositoryFingerprint ? { repositoryFingerprint } : {}),
    ...(now ? { now } : {}),
    dryRun,
    taskId: effectiveTaskId,
  });
}

export function formatRecordContinuityResult(result) {
  const value = result.value;
  return [
    `Continuity: ${result.path}`,
    `Task: ${value.taskId}`,
    `Phase: ${value.phase}`,
    `Focus: ${value.currentFocus?.id ?? "none"}`,
    `Remaining: ${value.remainingWork.length}`,
    `Known issues: ${value.knownIssues.length}`,
    "Authority: OPERATIONAL_CONTEXT_ONLY",
    "Evidence: NONE",
  ].join("\n") + "\n";
}
