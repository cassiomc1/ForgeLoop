import { acceptCanonicalHandoff } from "../core/handoff-acceptance.js";

export async function runHandoffAccept({
  target,
  packageRoot,
  taskId,
  handoffId,
  consumerId,
  harness,
} = {}) {
  const result = await acceptCanonicalHandoff(target, {
    taskId,
    handoffId,
    consumerId,
    harness,
    packageRoot,
  });
  return {
    taskId,
    ...result,
  };
}

export function formatHandoffAcceptResult(result) {
  return [
    `FORGELOOP HANDOFF ACCEPTED: ${result.handoffId}`,
    `consumer: ${result.consumerId}`,
    `harness: ${result.harness ?? "none"}`,
    `at: ${result.acceptedAt}`,
    `idempotent: ${result.idempotent ? "yes" : "no"}`,
    "authority: OPERATIONAL_RECEIPT_ONLY",
    "evidence: NONE",
    "claims transferred: NO",
    "",
  ].join("\n");
}
