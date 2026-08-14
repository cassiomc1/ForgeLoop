import { recordTerminalResult as recordTerminalResultArtifact } from "../core/completion-artifacts.js";

export { recordTerminalResultArtifact as recordTerminalResult };

export async function runRecordTerminalResult(input) {
  return recordTerminalResultArtifact(input);
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
