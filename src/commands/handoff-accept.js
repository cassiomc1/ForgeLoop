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
  const idempotency = result.idempotent ? " (idempotent)" : "";
  const harness = result.harness ? ` (${result.harness})` : "";
  return `FORGELOOP HANDOFF ACCEPTED: ${result.handoffId}\nconsumer: ${result.consumerId}${harness}${idempotency}\nat: ${result.acceptedAt}\n\n`;
}
