import { buildAttestationStatement, writeAttestationStatement } from "../core/attestation.js";
import { withTaskTransaction } from "../core/transaction.js";
import { assertTaskMutationAllowed } from "../core/task-claim-state.js";
import { readWorkState } from "../core/work-state.js";
import { assertWorkspaceBinding } from "../core/workspace-binding.js";

export async function runAttestationCreate({ target, packageRoot, taskId } = {}) {
  return withTaskTransaction({ target, taskId, packageRoot, operation: "attestation-create", recordCommitEvent: true }, async () => {
    const state = await readWorkState(target, { packageRoot, taskId });
    if (!state || state.phase !== "COMPLETE") {
      const error = new Error("attestation-create requires a COMPLETE task");
      error.code = "E_ATTESTATION_STATEMENT_INVALID";
      throw error;
    }
    // COMPLETE releases ordinary write claims, but a statement is a
    // protocol-owned derivative of that terminal state. Keep this command
    // terminal-safe while refusing all ordinary task mutations.
    await assertTaskMutationAllowed(target, { taskId, packageRoot }).catch((error) => {
      if (error.code !== "E_TASK_COMPLETE") throw error;
    });
    await assertWorkspaceBinding(target, { taskId, packageRoot, operation: "attestation-create" });
    const built = await buildAttestationStatement({ target, packageRoot, taskId });
    const written = await writeAttestationStatement({ target, packageRoot, taskId, statement: built.statement });
    return { ...written, statementFingerprint: built.fingerprint, manifestFingerprint: built.manifest.fingerprint };
  });
}

export function formatAttestationCreateResult(result) {
  return `FORGELOOP ATTESTATION CREATED\ntask: ${result.statement.predicate.task.taskId}\nfingerprint: ${result.statementFingerprint}\npath: ${result.path}\nsubject: sha256:${result.statement.subject[0].digest.sha256}\n\n`;
}
