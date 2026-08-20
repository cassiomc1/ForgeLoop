import { resolveTaskContext } from "./task-context.js";
import { withTaskTransaction } from "./transaction.js";

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
    return withTaskTransaction({ target, taskId: taskContext.taskId, operation }, async (transaction) => {
      return callback({ ...taskContext, transaction });
    });
  }

  return callback(null);
}
