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

export function isOperationallyActiveTask(task) {
  return task?.healthy !== false
    && task?.phase !== "COMPLETE"
    && task?.mutationAllowed !== false;
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
  const healthyTasks = tasks.filter((t) => t.healthy !== false);

  // Fail closed: modern task namespaces exist but are all corrupt/unhealthy.
  // Never fall back to legacy singleton state over corrupt modern state.
  if (tasks.length > 0 && healthyTasks.length === 0) {
    const firstInvalid = tasks.find((t) => t.healthy === false);
    const error = new Error(
      firstInvalid?.error?.message ?? "Task namespaces exist but none are valid",
    );
    error.code = firstInvalid?.error?.code ?? "E_TASK_DESCRIPTOR_INVALID";
    throw error;
  }

  const operationalTasks = healthyTasks.filter(isOperationallyActiveTask);

  if (operationalTasks.length === 1) {
    const single = operationalTasks[0];
    return createTaskContext({
      target,
      taskId: single.taskId,
      descriptor: single.descriptor,
      packageRoot,
    });
  }

  if (operationalTasks.length > 1) {
    // Otherwise ambiguous
    const candidates = operationalTasks.map((t) => t.taskId);
    const error = new Error(
      `Multiple active tasks exist (${candidates.join(", ")}). Select a task with --task <id> or FORGELOOP_TASK=<id>.`,
    );
    error.code = E_TASK_AMBIGUOUS;
    error.tasks = candidates;
    throw error;
  }

  if (explicitRequired || healthyTasks.length > 0) {
    const error = new Error("A task must be specified using --task <id> or created with 'forgeloop task-create'");
    error.code = E_TASK_REQUIRED;
    error.tasks = healthyTasks.map((task) => task.taskId);
    throw error;
  }

  return null;
}
