import { resolveTaskContext, TASK_SELECTION_MODES } from "./task-context.js";
import { withTaskTransaction } from "./transaction.js";
import { assertTaskMutationAllowed } from "./task-claim-state.js";
import { assertWorkspaceBinding } from "./workspace-binding.js";

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
    selectionMode: TASK_SELECTION_MODES.READ,
  });

  return callback(taskContext);
}

export async function withTaskMutation(
  target,
  options = {},
  operation = "mutation",
  callback,
  { explicitRequired = false, skipWorkspaceBinding = false } = {},
) {
  const taskOption = options.taskId ?? options.task ?? null;
  const taskContext = await resolveTaskContext(target, {
    taskId: taskOption,
    explicitRequired,
    packageRoot: options.packageRoot,
    selectionMode: TASK_SELECTION_MODES.MUTATION,
  });

  if (taskContext) {
    return withTaskTransaction({ target, taskId: taskContext.taskId, operation, packageRoot: options.packageRoot, recordCommitEvent: true }, async (transaction) => {
      await assertTaskMutationAllowed(target, { taskId: taskContext.taskId, packageRoot: options.packageRoot });
      if (!skipWorkspaceBinding) {
        await assertWorkspaceBinding(target, {
          taskId: taskContext.taskId,
          packageRoot: options.packageRoot,
          operation,
        });
      }
      return callback({ ...taskContext, transaction });
    });
  }

  return callback(null);
}
