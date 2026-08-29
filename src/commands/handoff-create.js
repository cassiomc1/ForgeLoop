import { createCanonicalHandoff } from "../core/handoff.js";

export async function runHandoffCreate({ target, packageRoot, taskId, recipientHint, handoffNote } = {}) {
  return createCanonicalHandoff(target, { packageRoot, taskId, recipientHint, note: handoffNote });
}

export function formatHandoffCreateResult(result) {
  return `FORGELOOP HANDOFF CREATED\ntask: ${result.handoff.taskId}\nid: ${result.handoff.handoffId}\ndigest: ${result.handoff.artifactDigest}\npath: ${result.path}\n\n`;
}
