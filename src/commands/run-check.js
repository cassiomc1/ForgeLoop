import {
  assertRecordCheckPrerequisites,
  recordCheck as recordCheckArtifact,
} from "../core/completion-artifacts.js";
import { runCommandExecution } from "../core/execution.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runCheck({
  target,
  packageRoot,
  id,
  requirement,
  argv,
  details,
  timeoutMs,
  authorityContext,
  runtimeContext,
  taskId,
  task,
}) {
  if (typeof id !== "string" || id.trim() === "" || typeof requirement !== "string" || requirement.trim() === "") {
    const error = new Error("run-check requires non-empty id and requirement");
    error.code = "E_CHECK_INVALID";
    throw error;
  }
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "run-check", async (ctx) => {
    const effectiveTaskId = ctx?.taskId ?? null;
    const ready = await assertRecordCheckPrerequisites({
      target,
      packageRoot,
      requirement,
      status: "passed",
      evidenceKind: "OBSERVED",
      authorityContext,
      runtimeContext,
      taskId: effectiveTaskId,
    });
    const verificationCycle = ready.state.verificationCycle ?? 1;
    const execution = await runCommandExecution({
      target,
      packageRoot,
      taskId: ready.contract.value.taskId,
      checkId: id,
      requirement,
      verificationCycle,
      argv,
      details,
      timeoutMs,
      authorityContext,
      runtimeContext,
    });
    const status = execution.execution.status === "passed" ? "passed" : "failed";
    const recorded = await recordCheckArtifact({
      target,
      packageRoot,
      id,
      kind: "command",
      requirement,
      status,
      evidenceKind: "OBSERVED",
      command: execution.execution.argv.join(" "),
      result: execution.result,
      ...(execution.execution.exitCode === null ? {} : { exitCode: execution.execution.exitCode }),
      details,
      executionRef: execution.execution.executionId,
      provenance: "FORGELOOP_EXECUTED",
      authorityContext,
      runtimeContext,
      taskId: effectiveTaskId,
    });
    return {
      ...recorded,
      execution: execution.execution,
      executionPath: execution.path,
    };
  });
}

export function formatRunCheckResult(result) {
  return [
    "FORGELOOP CHECK EXECUTED",
    `id: ${result.check.id}`,
    `requirement: ${result.check.requirement}`,
    `status: ${result.check.status}`,
    `execution: ${result.execution.executionId}`,
    `argv: ${result.execution.argv.join(" ")}`,
    `exit code: ${result.execution.exitCode ?? "not-started"}`,
    `artifact: ${result.executionPath}`,
    `coverage: ${result.coverage.find((item) => item.requirement === result.check.requirement)?.status ?? "NOT_VERIFIED"}`,
    `receipt: ${result.path}`,
    "",
  ].join("\n");
}
