import { exportTaskBundle } from "../core/bundles.js";

export async function runBundle({ target, packageRoot, taskId }) {
  if (!taskId) throw new Error("--task is required for bundle");
  return exportTaskBundle(target, taskId, packageRoot);
}

export function formatBundleResult(result) {
  return `bundle: ${result.taskId}\npath: ${result.path}\nartifacts: ${result.artifacts.join(", ")}\n`;
}
