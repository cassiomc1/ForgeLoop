import { resolveResponsibilityStatus } from "../core/responsibility.js";

export async function runResponsibilityStatus({ target, packageRoot, taskId } = {}) {
  return resolveResponsibilityStatus(target, { packageRoot, taskId });
}

export function formatResponsibilityStatusResult(result) {
  const lines = [`FORGELOOP RESPONSIBILITY: ${result.status}`, `task: ${result.taskId}`];
  if (result.responsibility) lines.push(`label: ${result.responsibility.label}`);
  for (const error of result.errors ?? []) lines.push(`${error.code}: ${error.message}`);
  return `${lines.join("\n")}\n`;
}
