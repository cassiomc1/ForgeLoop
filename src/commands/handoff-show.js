import { readCanonicalHandoff } from "../core/handoff.js";
import { validateEventLedger } from "../core/events.js";
import { resolveHandoffAcceptance } from "../core/handoff-acceptance.js";

export async function runHandoffShow({ target, packageRoot, taskId, handoffId } = {}) {
  const artifact = await readCanonicalHandoff(target, { packageRoot, taskId, handoffId });
  const ledger = await validateEventLedger(target, packageRoot, { taskId }).catch(() => ({ events: [] }));
  const resolved = resolveHandoffAcceptance(ledger.events, artifact.value);
  const acceptance = {
    status: resolved.status,
    consumerId: resolved.consumerId ?? null,
    harness: resolved.harness ?? null,
    acceptedAt: resolved.acceptedAt ?? null,
  };
  return {
    taskId,
    path: artifact.path,
    fingerprint: artifact.fingerprint,
    handoff: artifact.value,
    acceptance,
  };
}

export function formatHandoffShowResult(result) {
  const acceptanceLine = result.acceptance ? `\nacceptance: ${result.acceptance.status}` : "";
  return `FORGELOOP HANDOFF: VALID\nid: ${result.handoff.handoffId}\ntask: ${result.handoff.taskId}\ndigest: ${result.handoff.artifactDigest}\npath: ${result.path}${acceptanceLine}\n\n`;
}
