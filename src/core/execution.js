import { readdir } from "node:fs/promises";
import path from "node:path";
import { ensureWithin, fileExists } from "./filesystem.js";
import {
  ARTIFACT_PATHS,
  executionArtifactPath,
  readJsonArtifact,
} from "./artifacts.js";
import { taskArtifactPath, taskExecutionPath } from "./task-paths.js";

export { E_COMMAND_RESOLUTION_AMBIGUOUS } from "./verification-capability.js";
import {
  prepareCommandExecution,
  runPreparedCommandExecution,
} from "./prepared-execution.js";
export {
  prepareCommandExecution,
  runPreparedCommandExecution,
  TERMINATION_GRACE_MS_PREPARED as TERMINATION_GRACE_MS,
} from "./prepared-execution.js";

function executionError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

/**
 * Resolves where a new execution artifact should be written. Task-scoped
 * execution artifacts require a real modern task namespace (a task.json
 * descriptor). A descriptor-less task is legacy: writing task-scoped here
 * would create a phantom `.forgeloop/task-state/<key>/executions/` namespace
 * that corrupts task discovery. Reads already fall back across both
 * locations, so a legacy execution stays resolvable.
 */
export async function resolveExecutionArtifactPath(target, taskId, executionId) {
  if (!taskId) return executionArtifactPath(executionId);
  const descriptorRel = taskArtifactPath(taskId, "descriptor");
  if (await fileExists(ensureWithin(target, descriptorRel))) {
    return taskExecutionPath(taskId, executionId);
  }
  return executionArtifactPath(executionId);
}

/**
 * Deterministic pre-launch preparation followed by an exact-argv launch.
 * Kept as the canonical single-command entrypoint for non-durable callers
 * (run-check); durable actions use the two phases separately so that
 * ACTION_STARTED lands exactly on the launch boundary (INV-EXEC-01).
 */
export async function runCommandExecution({
  target,
  packageRoot,
  taskId,
  checkId,
  requirement,
  verificationCycle = 1,
  argv,
  details,
  authorityContext,
  runtimeContext,
  executionPath,
  timeoutMs = null,
} = {}) {
  const prepared = await prepareCommandExecution({
    target,
    argv,
    details,
    authorityContext,
    runtimeContext,
  });
  return runPreparedCommandExecution({
    target,
    packageRoot,
    taskId,
    checkId,
    requirement,
    verificationCycle,
    prepared,
    timeoutMs,
    executionPath,
  });
}

export async function readExecutionArtifact({ target, executionRef, packageRoot, taskId } = {}) {
  let relativePath;
  try {
    relativePath = taskId ? taskExecutionPath(taskId, executionRef) : executionArtifactPath(executionRef);
    const artifact = await readJsonArtifact(target, relativePath, "execution", packageRoot);
    return artifact;
  } catch (error) {
    if (error.code === "E_EXECUTION_REF_INVALID") throw error;
    if (error.code === "ARTIFACT_MISSING") {
      if (taskId) {
        try {
          const fallbackPath = executionArtifactPath(executionRef);
          const artifact = await readJsonArtifact(target, fallbackPath, "execution", packageRoot);
          return artifact;
        } catch {
          // ignore fallback failure
        }
      } else {
        try {
          const taskStateDir = path.join(target, ".forgeloop", "task-state");
          if (await fileExists(taskStateDir)) {
            const entries = await readdir(taskStateDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const execFile = path.join(taskStateDir, entry.name, "executions", `${executionRef}.json`);
                if (await fileExists(execFile)) {
                  const rel = path.relative(target, execFile).replaceAll("\\", "/");
                  return await readJsonArtifact(target, rel, "execution", packageRoot);
                }
              }
            }
          }
        } catch {
          // ignore scan failure
        }
      }
    }
    throw executionError("E_EXECUTION_REF_INVALID", "Execution reference does not resolve to a valid ForgeLoop artifact", [relativePath ?? ARTIFACT_PATHS.executionDirectory]);
  }
}

export function validateExecutionBinding({ execution, taskId, checkId, requirement, verificationCycle = 1 } = {}) {
  if (!execution || execution.kind !== "COMMAND_EXECUTION"
    || execution.taskId !== taskId
    || execution.checkId !== checkId
    || execution.requirement !== requirement
    || execution.verificationCycle !== undefined && execution.verificationCycle !== verificationCycle) {
    throw executionError("E_EXECUTION_REF_INVALID", "Execution artifact does not match the current check binding", [ARTIFACT_PATHS.executionDirectory]);
  }
  return execution;
}
