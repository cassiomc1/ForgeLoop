import { listCanonicalHandoffs } from "../core/handoff.js";

export async function runHandoffList({ target, packageRoot, taskId } = {}) {
  const handoffs = await listCanonicalHandoffs(target, { packageRoot, taskId });
  return { taskId, count: handoffs.length, handoffs };
}

export function formatHandoffListResult(result) {
  const lines = [`FORGELOOP HANDOFFS: ${result.count}`];
  for (const handoff of result.handoffs) lines.push(`${handoff.handoffId} ${handoff.createdAt} ${handoff.artifactDigest}`);
  return `${lines.join("\n")}\n`;
}
