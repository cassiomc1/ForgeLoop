import { assertTaskId } from "../core/task-identity.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../core/task-descriptor.js";
import { normalizeWriteClaims, assertNoScopeConflicts, assertScopeClean } from "../core/task-scope.js";
import { discoverTasks, findTaskById } from "../core/task-discovery.js";
import { withTaskLock } from "../core/task-lock.js";
import { taskDirectory, taskArtifactPath } from "../core/task-paths.js";
import { ensureWithin, fileExists, readBytes, writeFileAtomic } from "../core/filesystem.js";
import { E_TASK_REQUIRED, E_TASK_ALREADY_EXISTS } from "../core/error-codes.js";

function taskError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export async function runTaskCreate({ target, packageRoot, taskId, claims = [], contractFile = null } = {}) {
  if (!taskId) {
    throw taskError(E_TASK_REQUIRED, "--task is required for task-create");
  }
  assertTaskId(taskId);

  const existing = await findTaskById(target, taskId, packageRoot);
  if (existing) {
    throw taskError(E_TASK_ALREADY_EXISTS, `Task already exists: ${taskId}`);
  }

  const normalizedClaims = normalizeWriteClaims(claims ?? []);
  const allTasks = await discoverTasks(target, packageRoot);
  assertNoScopeConflicts(normalizedClaims, allTasks, taskId);
  if (normalizedClaims.length > 0) {
    await assertScopeClean(target, normalizedClaims);
  }

  return withTaskLock(target, taskId, async () => {
    const descriptor = createTaskDescriptor({
      taskId,
      writeClaims: normalizedClaims,
    });
    const written = await writeTaskDescriptor(target, descriptor, packageRoot);

    let contractCopied = false;
    if (contractFile) {
      const sourcePath = ensureWithin(target, contractFile);
      if (await fileExists(sourcePath)) {
        const destRel = taskArtifactPath(taskId, "contract");
        const destPath = ensureWithin(target, destRel);
        await writeFileAtomic(destPath, await readBytes(sourcePath));
        contractCopied = true;
      }
    }

    return {
      taskId: descriptor.taskId,
      taskKey: descriptor.taskKey,
      directory: taskDirectory(taskId),
      descriptorPath: written.path,
      writeClaims: descriptor.writeClaims,
      contractCopied,
      createdAt: descriptor.createdAt,
    };
  });
}

export function formatTaskCreateResult(result) {
  const claims = result.writeClaims.length === 0 ? "none" : result.writeClaims.join(", ");
  return `created task: ${result.taskId}\nkey: ${result.taskKey}\ndirectory: ${result.directory}\nclaims: ${claims}\n`;
}
