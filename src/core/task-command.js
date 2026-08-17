import { resolveTaskContext } from "./task-context.js";
import { withTaskLock } from "./task-lock.js";

export async function withResolvedTask(
  target,
  options = {},
  callback,
  { explicitRequired = false } = {},
) {
  const taskOption = options.taskId ?? options.task ?? null;
  const taskContext = await resolveTaskContext(target, {
    taskId: taskOption,
    explicitRequired,
    packageRoot: options.packageRoot,
  });

  return callback(taskContext);
}

export async function withTaskMutation(
  target,
  options = {},
  operation = "mutation",
  callback,
  { explicitRequired = false } = {},
) {
  const taskOption = options.taskId ?? options.task ?? null;
  const taskContext = await resolveTaskContext(target, {
    taskId: taskOption,
    explicitRequired,
    packageRoot: options.packageRoot,
  });

  if (taskContext) {
    return withTaskLock(target, taskContext.taskId, operation, async () => {
      return callback(taskContext);
    });
  }

  return callback(null);
}
