import { prepareCompletion as prepareCompletionArtifacts } from "../core/completion-artifacts.js";

export { prepareCompletionArtifacts as prepareCompletion };

export async function runPrepareCompletion({ target, packageRoot, authorityContext, runtimeContext, taskId, task, ...rest } = {}) {
  const effectiveTaskId = taskId ?? task ?? null;
  return prepareCompletionArtifacts({ target, packageRoot, authorityContext, runtimeContext, taskId: effectiveTaskId, ...rest });
}

export function formatPrepareCompletionResult(result) {
  return [
    "FORGELOOP COMPLETION PREPARED",
    `receipt: ${result.path}`,
    `task: ${result.receipt.taskId}`,
    `required evidence: ${result.requiredEvidence.length}`,
    `changed paths: ${result.changedPaths.length}`,
    "",
  ].join("\n");
}
