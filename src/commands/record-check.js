import { recordCheck as recordCheckArtifact } from "../core/completion-artifacts.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordCheckArtifact as recordCheck };

export async function runRecordCheck(input) {
  const target = input.target;
  const packageRoot = input.packageRoot;
  const taskId = input.taskId ?? input.task ?? null;
  return withTaskMutation(target, { taskId, packageRoot }, "record-check", async (ctx) => {
    return recordCheckArtifact({ ...input, taskId: ctx?.taskId ?? null });
  });
}

export function formatRecordCheckResult(result) {
  return [
    "FORGELOOP CHECK RECORDED",
    `id: ${result.check.id}`,
    `requirement: ${result.check.requirement}`,
    `status: ${result.check.status}`,
    `evidence: ${result.evidence.kind}`,
    `coverage: ${result.coverage.find((item) => item.requirement === result.check.requirement)?.status ?? "NOT_VERIFIED"}`,
    `receipt: ${result.path}`,
    "",
  ].join("\n");
}
