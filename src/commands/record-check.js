import { recordCheck as recordCheckArtifact } from "../core/completion-artifacts.js";

export { recordCheckArtifact as recordCheck };

export async function runRecordCheck(input) {
  return recordCheckArtifact(input);
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
