import { prepareCompletion as prepareCompletionArtifacts } from "../core/completion-artifacts.js";

export { prepareCompletionArtifacts as prepareCompletion };

export async function runPrepareCompletion({ target, packageRoot }) {
  return prepareCompletionArtifacts({ target, packageRoot });
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
