import { recordTerminalResult as recordTerminalResultArtifact } from "../core/completion-artifacts.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordTerminalResultArtifact as recordTerminalResult };

export async function runRecordTerminalResult(input) {
  const target = input.target;
  const packageRoot = input.packageRoot;
  const taskId = input.taskId ?? input.task ?? null;
  return withTaskMutation(target, { taskId, packageRoot }, "record-terminal-result", async (ctx) => {
    return recordTerminalResultArtifact({ ...input, taskId: ctx?.taskId ?? null });
  });
}

export function formatRecordTerminalResult(result) {
  return [
    "FORGELOOP TERMINAL RESULT RECORDED",
    `requirement: ${result.requirementId}`,
    `type: ${result.type}`,
    `status: ${result.status}`,
    `receipt: ${result.path}`,
    "",
  ].join("\n");
}
