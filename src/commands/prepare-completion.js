import { prepareCompletion as prepareCompletionArtifacts } from "../core/completion-artifacts.js";
import { withTaskMutation } from "../core/task-command.js";

export { prepareCompletionArtifacts as prepareCompletion };

export async function runPrepareCompletion({ target, packageRoot, authorityContext, runtimeContext, taskId, task, ...rest } = {}) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "prepare-completion", async (ctx) => {
    return prepareCompletionArtifacts({ target, packageRoot, authorityContext, runtimeContext, taskId: ctx?.taskId ?? null, ...rest });
  });
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
