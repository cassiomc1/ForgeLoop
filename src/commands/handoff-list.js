import { listCanonicalHandoffs } from "../core/handoff.js";
import { validateEventLedger } from "../core/events.js";
import { resolveHandoffAcceptance } from "../core/handoff-acceptance.js";

export async function runHandoffList({ target, packageRoot, taskId } = {}) {
  const handoffs = await listCanonicalHandoffs(target, { packageRoot, taskId });
  const ledger = await validateEventLedger(target, packageRoot, { taskId }).catch(() => ({ events: [] }));
  const handoffsWithAcceptance = handoffs.map((handoff) => {
    const resolved = resolveHandoffAcceptance(ledger.events, handoff);
    return {
      ...handoff,
      acceptance: {
        status: resolved.status,
        consumerId: resolved.consumerId ?? null,
        harness: resolved.harness ?? null,
        acceptedAt: resolved.acceptedAt ?? null,
      },
    };
  });
  return { taskId, count: handoffs.length, handoffs: handoffsWithAcceptance };
}

export function formatHandoffListResult(result) {
  const lines = [`FORGELOOP HANDOFFS: ${result.count}`];
  for (const handoff of result.handoffs) {
    const status = handoff.acceptance?.status ? ` [${handoff.acceptance.status}]` : "";
    lines.push(`${handoff.handoffId} ${handoff.createdAt} ${handoff.artifactDigest}${status}`);
  }
  return `${lines.join("\n")}\n`;
}
