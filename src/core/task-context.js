import { getPackageRoot } from "./templates.js";
import { assertTaskId, taskStorageKey } from "./task-identity.js";
import { buildTaskArtifactPaths, taskDirectory } from "./task-paths.js";
import { readTaskDescriptor } from "./task-descriptor.js";
import { discoverTasks } from "./task-discovery.js";
import {
  E_TASK_AMBIGUOUS,
  E_TASK_NOT_FOUND,
  E_TASK_REQUIRED,
  E_TASK_SELECTOR_CONFLICT,
} from "./error-codes.js";

export function createTaskContext({ target, taskId, descriptor = null, packageRoot = getPackageRoot() }) {
  assertTaskId(taskId);
  const taskKey = descriptor?.taskKey ?? taskStorageKey(taskId);
  const directory = taskDirectory(taskId);
  const paths = buildTaskArtifactPaths(taskId);

  return Object.freeze({
    target,
    taskId,
    taskKey,
    descriptor,
    directory,
    paths,
    packageRoot,
  });
}

export async function resolveTaskContext(target, {
  taskId = null,
  envTaskId = process.env.FORGELOOP_TASK ?? null,
  explicitRequired = false,
  packageRoot = getPackageRoot(),
} = {}) {
  const flagId = typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
  const envId = typeof envTaskId === "string" && envTaskId.trim() ? envTaskId.trim() : null;

  if (flagId && envId && flagId !== envId) {
    const error = new Error(
      `Task selector conflict: --task "${flagId}" conflicts with FORGELOOP_TASK="${envId}"`,
    );
    error.code = E_TASK_SELECTOR_CONFLICT;
    error.flagTaskId = flagId;
    error.envTaskId = envId;
    throw error;
  }

  const selectedId = flagId ?? envId;

  if (selectedId) {
    try {
      const descriptorArtifact = await readTaskDescriptor(target, selectedId, packageRoot);
      return createTaskContext({
        target,
        taskId: descriptorArtifact.value.taskId,
        descriptor: descriptorArtifact.value,
        packageRoot,
      });
    } catch (error) {
      if (error.code === E_TASK_NOT_FOUND || error.code === "ARTIFACT_MISSING") {
        const notFoundError = new Error(`Task "${selectedId}" not found in project`);
        notFoundError.code = E_TASK_NOT_FOUND;
        notFoundError.taskId = selectedId;
        throw notFoundError;
      }
      throw error;
    }
  }

  const tasks = await discoverTasks(target, packageRoot);

  if (tasks.length === 1) {
    const single = tasks[0];
    return createTaskContext({
      target,
      taskId: single.taskId,
      descriptor: single.descriptor,
      packageRoot,
    });
  }

  if (tasks.length > 1) {
    const taskIds = tasks.map((t) => t.taskId);
    const error = new Error(
      `Multiple active tasks exist (${taskIds.join(", ")}). Select a task with --task <id> or FORGELOOP_TASK=<id>.`,
    );
    error.code = E_TASK_AMBIGUOUS;
    error.tasks = taskIds;
    throw error;
  }

  if (explicitRequired) {
    const error = new Error("A task must be specified using --task <id> or created with 'forgeloop task-create'");
    error.code = E_TASK_REQUIRED;
    throw error;
  }

  return null;
}
