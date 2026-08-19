import { readContract } from "./contract.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { runCommandExecution } from "./execution.js";
import { currentRepositoryFingerprint } from "./repository.js";
import { taskArtifactPath } from "./task-paths.js";
import { classifyLoadedWorkState, readWorkState, writeWorkState } from "./work-state.js";

export const RECONCILE_EVENT = "CHECKPOINT_RECONCILED";

const RECONCILABLE_DRIFT = new Set(["REPOSITORY_CHANGED"]);

function reconcileError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

/**
 * Canonical recovery for an EXECUTING task whose objective is already
 * satisfied in the current repository but whose work-state checkpoint is
 * stale because the repository fingerprint moved.
 *
 * The command refreshes the checkpoint repository fingerprint only after:
 *   - the task is EXECUTING,
 *   - classification requires revalidation and the only drift is
 *     REPOSITORY_CHANGED,
 *   - the append-only event ledger is valid,
 *   - a contract-bound verification check (exact verification item id and
 *     requirement text, type VERIFICATION) executes successfully in the
 *     current repository as evidence that the objective is present.
 *
 * Closure itself proceeds through the canonical pipeline (advance to
 * VERIFYING, prepare-completion, record-check, complete); claims are
 * released only by canonical COMPLETE.
 */
export async function runReconcileClosure({
  target,
  packageRoot,
  taskId,
  checkId,
  requirement,
  argv,
  details,
  authorityContext,
  runtimeContext,
} = {}) {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw reconcileError("E_TASK_REQUIRED", "reconcile-closure requires --task", []);
  }
  if (typeof checkId !== "string" || !checkId.trim()) {
    throw reconcileError("E_RECONCILE_REQUIREMENT_UNKNOWN", "reconcile-closure requires --id", []);
  }
  if (typeof requirement !== "string" || !requirement.trim()) {
    throw reconcileError("E_RECONCILE_REQUIREMENT_UNKNOWN", "reconcile-closure requires --requirement", []);
  }
  if (!Array.isArray(argv) || argv.length === 0) {
    throw reconcileError("E_RECONCILE_EVIDENCE_FAILED", "reconcile-closure requires -- followed by the evidence command argv", []);
  }

  const stateRel = taskArtifactPath(taskId, "state");
  const contractRel = taskArtifactPath(taskId, "contract");
  const eventsRel = taskArtifactPath(taskId, "events");

  const state = await readWorkState(target, { packageRoot, taskId });
  if (!state) {
    throw reconcileError("E_RECONCILE_PHASE_INVALID", "Cannot reconcile without work state", [stateRel]);
  }
  if (state.phase !== "EXECUTING") {
    throw reconcileError(
      "E_RECONCILE_PHASE_INVALID",
      `reconcile-closure supports EXECUTING tasks whose objective is already satisfied; found ${state.phase}`,
      [stateRel],
    );
  }

  const freshness = await classifyLoadedWorkState({ target, state, contractFile: contractRel });
  if (freshness.status !== "REVALIDATION_REQUIRED" || !freshness.reasons.includes("REPOSITORY_CHANGED")) {
    throw reconcileError(
      "E_RECONCILE_NOT_STALE",
      `work-state checkpoint is ${freshness.status === "FRESH" ? "fresh" : "not revalidation-required"}; no reconciliation required`,
      [stateRel, contractRel],
    );
  }
  const unsupported = freshness.reasons.filter((reason) => !RECONCILABLE_DRIFT.has(reason));
  if (unsupported.length > 0) {
    throw reconcileError(
      "E_RECONCILE_UNSUPPORTED_DRIFT",
      `reconcile-closure only reconciles repository fingerprint drift; unresolved drift: ${unsupported.join(", ")}`,
      [stateRel, contractRel],
    );
  }

  const ledger = await validateEventLedger(target, packageRoot, { taskId });
  if (!ledger.valid) {
    const first = ledger.errors[0];
    throw reconcileError(
      "E_RECONCILE_LEDGER_INVALID",
      `append-only event ledger must be valid before reconciliation: ${first?.message ?? "invalid ledger"}`,
      [eventsRel],
    );
  }

  const contract = await readContract(target, packageRoot, { taskId });
  const verificationItem = (contract.value.verification ?? []).find(
    (item) => item.type === "VERIFICATION" && item.id === checkId && item.text === requirement,
  );
  if (!verificationItem) {
    throw reconcileError(
      "E_RECONCILE_REQUIREMENT_UNKNOWN",
      `no contract verification item matches id "${checkId}" with the exact requirement text`,
      [contractRel],
    );
  }

  const execution = await runCommandExecution({
    target,
    packageRoot,
    taskId,
    checkId,
    requirement,
    verificationCycle: state.verificationCycle ?? 1,
    argv,
    details,
    authorityContext,
    runtimeContext,
  });
  if (execution.execution.status !== "passed") {
    throw reconcileError(
      "E_RECONCILE_EVIDENCE_FAILED",
      `objective-satisfaction evidence failed (exit ${execution.execution.exitCode ?? "not-started"}): ${execution.result}`,
      [execution.path],
    );
  }

  const repository = await currentRepositoryFingerprint(target);
  const previous = state.repositoryFingerprint;

  await appendProtocolEvent(target, {
    taskId,
    event: RECONCILE_EVENT,
    details: {
      previousBranch: previous?.branch ?? null,
      previousHead: previous?.head ?? null,
      currentBranch: repository.branch,
      currentHead: repository.head,
      checkId,
      requirement,
      command: argv.join(" "),
      exitCode: execution.execution.exitCode ?? 0,
      executionId: execution.execution.executionId,
    },
  }, packageRoot, { taskId });

  await writeWorkState(target, {
    ...state,
    repositoryFingerprint: repository,
    lastUpdated: new Date().toISOString(),
  }, { packageRoot, taskId });

  return {
    taskId,
    phase: state.phase,
    reconciled: true,
    previousRepositoryFingerprint: previous,
    repositoryFingerprint: repository,
    checkId,
    requirement,
    executionId: execution.execution.executionId,
    executionPath: execution.path,
    event: RECONCILE_EVENT,
  };
}