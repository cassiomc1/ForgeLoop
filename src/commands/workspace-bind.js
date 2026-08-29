import { bindTaskWorkspace } from "../core/workspace-binding.js";

export async function runWorkspaceBind({ target, packageRoot, taskId, now } = {}) {
  return bindTaskWorkspace(target, { taskId, packageRoot, now });
}

export function formatWorkspaceBindResult(result) {
  return [
    `FORGELOOP WORKSPACE BIND: ${result.status}`,
    `task: ${result.taskId}`,
    `binding: ${result.path}`,
    `workspace: ${result.binding.workspaceIdentity}`,
    `repository: ${result.binding.repositoryIdentity}`,
    `already bound: ${result.alreadyBound ? "yes" : "no"}`,
    "",
  ].join("\n");
}
