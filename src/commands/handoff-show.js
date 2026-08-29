import { readCanonicalHandoff } from "../core/handoff.js";

export async function runHandoffShow({ target, packageRoot, taskId, handoffId } = {}) {
  const artifact = await readCanonicalHandoff(target, { packageRoot, taskId, handoffId });
  return { taskId, path: artifact.path, fingerprint: artifact.fingerprint, handoff: artifact.value };
}

export function formatHandoffShowResult(result) {
  return `FORGELOOP HANDOFF: VALID\nid: ${result.handoff.handoffId}\ntask: ${result.handoff.taskId}\ndigest: ${result.handoff.artifactDigest}\npath: ${result.path}\n\n`;
}
