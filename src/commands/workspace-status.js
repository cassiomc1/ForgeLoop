import { resolveWorkspaceBindingStatus } from "../core/workspace-binding.js";

export async function runWorkspaceStatus({ target, packageRoot, taskId } = {}) {
  return resolveWorkspaceBindingStatus(target, { taskId, packageRoot });
}

export function formatWorkspaceStatusResult(result) {
  const lines = [
    `FORGELOOP WORKSPACE: ${result.status}`,
    `task: ${result.taskId}`,
    `binding: ${result.path}`,
  ];
  if (result.binding) {
    lines.push(`workspace: ${result.binding.workspaceIdentity}`);
    lines.push(`repository: ${result.binding.repositoryIdentity}`);
  }
  if (result.error) lines.push(`${result.error.code}: ${result.error.message}`);
  return `${lines.join("\n")}\n`;
}
