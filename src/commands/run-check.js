import {
  assertRecordCheckPrerequisites,
  recordCheck as recordCheckArtifact,
} from "../core/completion-artifacts.js";
import { runCommandExecution } from "../core/execution.js";
import { withTaskMutation } from "../core/task-command.js";
import { readVerificationScope, validateVerificationScopeFreshness } from "../core/verification-scope.js";
import { bindVerificationScopeCommand } from "../core/verification-scope-capability.js";

export async function runCheck({
  target,
  packageRoot,
  id,
  requirement,
  argv,
  details,
  timeoutMs,
  scopeRef,
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
    let executionDetails = details;
    let commandArgv = [...argv];
    if (scopeRef) {
      const scope = await readVerificationScope(target, {
        packageRoot,
        taskId: effectiveTaskId,
        scopePath: scopeRef,
      });
      const freshness = await validateVerificationScopeFreshness(target, {
        packageRoot,
        taskId: effectiveTaskId,
        scope: scope.value,
      });
      const binding = await bindVerificationScopeCommand({
        target,
        packageRoot,
        checkId: id,
        argv: commandArgv,
        scope: scope.value,
        capabilities: freshness.current.checkerCapabilities,
      });
      commandArgv = binding.argv;
      executionDetails = {
        ...(details ?? {}),
        verificationScope: {
          ref: scope.path,
          fingerprint: scope.fingerprint,
          mode: scope.value.resolvedMode,
          selectedPaths: scope.value.selectedPaths,
          argv: [...commandArgv],
          ...(binding.checker ? {
            checkerId: binding.checker.checkId,
            checkerCapabilityFingerprint: binding.capabilityFingerprint,
          } : {}),
        },
      };
    }
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
      argv: commandArgv,
      details: executionDetails,
      timeoutMs,
      authorityContext,
      runtimeContext,
      executionKind: "VERIFICATION",
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
      details: executionDetails,
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
