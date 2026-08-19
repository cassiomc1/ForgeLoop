import { runReconcileClosure } from "../core/reconcile-closure.js";
import { withTaskMutation } from "../core/task-command.js";

export async function reconcileClosure({
  target,
  packageRoot,
  taskId,
  task,
  checkId,
  checkRequirement,
  checkDetails,
  commandArgv,
  authorityContext,
  runtimeContext,
}) {
  return withTaskMutation(
    target,
    { taskId: taskId ?? task, packageRoot },
    "reconcile-closure",
    async (ctx) => {
      return runReconcileClosure({
        target,
        packageRoot,
        taskId: ctx?.taskId ?? null,
        checkId,
        requirement: checkRequirement,
        argv: commandArgv,
        details: checkDetails,
        authorityContext,
        runtimeContext,
      });
    },
    { explicitRequired: true },
  );
}

export function formatReconcileClosureResult(result) {
  const previous = result.previousRepositoryFingerprint;
  return [
    "FORGELOOP CHECKPOINT RECONCILED",
    `task: ${result.taskId}`,
    `check: ${result.checkId} (passed)`,
    `execution: ${result.executionId}`,
    `previous: ${previous?.branch ?? "unknown"} @ ${previous?.head ?? "unknown"}`,
    `current: ${result.repositoryFingerprint?.branch ?? "unknown"} @ ${result.repositoryFingerprint?.head ?? "unknown"}`,
    `event: ${result.event}`,
    "",
  ].join("\n");
}