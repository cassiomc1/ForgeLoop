import { resolveTaskContext } from "./task-context.js";
import { withTaskLock } from "./task-lock.js";
import { E_TASK_REQUIRED } from "./error-codes.js";

export async function withResolvedTask(
  target,
  options = {},
  callback,
  { explicitRequired = false } = {},
) {
  const taskContext = await resolveTaskContext(target, {
    taskId: options.task ?? null,
    explicitRequired,
    packageRoot: options.packageRoot,
  });

  if (!taskContext && explicitRequired) {
    const error = new Error("This command requires an active or specified task. Provide --task <id>.");
    error.code = E_TASK_REQUIRED;
    throw error;
  }

  return callback(taskContext);
}

export async function withTaskMutation(
  target,
  options = {},
  operation = "mutation",
  callback,
  { explicitRequired = true } = {},
) {
  const taskContext = await resolveTaskContext(target, {
    taskId: options.task ?? null,
    explicitRequired,
    packageRoot: options.packageRoot,
  });

  if (!taskContext) {
    const error = new Error(`Mutation operation "${operation}" requires a target task.`);
    error.code = E_TASK_REQUIRED;
    throw error;
  }

  return withTaskLock(target, taskContext.taskId, operation, async () => {
    return callback(taskContext);
  });
}
