import { resolveTaskContext } from "../core/task-context.js";
import { readTaskDescriptor, writeTaskDescriptor } from "../core/task-descriptor.js";
import { discoverTasks } from "../core/task-discovery.js";
import { appendProtocolEvent, validateEventLedger } from "../core/events.js";
import { readWorkState } from "../core/work-state.js";
import { normalizeWriteClaims, assertScopeClean } from "../core/task-scope.js";
import { assertNoScopeConflictsWithInspection } from "./task-create.js";
import { withProjectClaimsLock } from "../core/task-lock.js";
import { withTaskTransaction } from "../core/transaction.js";
import {
  clearTaskRecovery,
  isTaskRecovered,
  readTaskRecovery,
  validateTaskRecoveryConsistency,
} from "../core/task-recovery.js";
import { E_TASK_NOT_RECOVERED, E_TASK_RECOVERY_INCONSISTENT } from "../core/error-codes.js";

function resumeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sameClaims(left, right) {
  return left.length === right.length && left.every((claim, index) => claim === right[index]);
}

export async function runTaskResume({ target, packageRoot, taskId, claims } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const effectiveTaskId = context.taskId;
  const initialRecovery = await readTaskRecovery(target, { taskId: effectiveTaskId, packageRoot });
  if (!isTaskRecovered(initialRecovery?.value)) {
    throw resumeError(E_TASK_NOT_RECOVERED, `Task ${effectiveTaskId} is not RECOVERED`);
  }

  return withProjectClaimsLock(target, "task-resume", async () => {
    return withTaskTransaction({
      target,
      taskId: effectiveTaskId,
      operation: "task-resume",
      packageRoot,
      recordCommitEvent: true,
    }, async () => {
      const recoveryArtifact = await readTaskRecovery(target, { taskId: effectiveTaskId, packageRoot });
      const recovery = recoveryArtifact?.value;
      if (!isTaskRecovered(recovery)) {
        throw resumeError(E_TASK_NOT_RECOVERED, `Task ${effectiveTaskId} is no longer RECOVERED`);
      }
      if (recovery.recoveryId !== initialRecovery.value.recoveryId) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} recovery state changed before resume`,
        );
      }

      const descriptorArtifact = await readTaskDescriptor(target, effectiveTaskId, packageRoot);

      const state = await readWorkState(target, { packageRoot, taskId: effectiveTaskId });
      if (!state
        || state.phase !== recovery.previousPhase
        || (state.revision ?? 0) !== recovery.previousRevision) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} lifecycle state no longer matches recovery revision`,
        );
      }

      const ledger = await validateEventLedger(target, packageRoot, { taskId: effectiveTaskId });
      if (!ledger.valid) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} event ledger is invalid`,
          { ledgerErrors: ledger.errors },
        );
      }

      const recoveryConsistencyErrors = validateTaskRecoveryConsistency({
        taskId: effectiveTaskId,
        recovery,
        events: ledger.events,
        historicalWriteClaims: descriptorArtifact.value.writeClaims ?? [],
      });
      if (recoveryConsistencyErrors.length > 0) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} recovery state does not match its event ledger`,
          { recoveryErrors: recoveryConsistencyErrors },
        );
      }

      const desiredClaims = normalizeWriteClaims(
        Array.isArray(claims) && claims.length > 0 ? claims : recovery.releasedClaims,
      );
      const allTasks = await discoverTasks(target, packageRoot);
      await assertNoScopeConflictsWithInspection(desiredClaims, allTasks, effectiveTaskId, { target, packageRoot });
      if (desiredClaims.length > 0) {
        await assertScopeClean(target, desiredClaims);
      }

      const descriptorClaims = normalizeWriteClaims(descriptorArtifact.value.writeClaims ?? []);
      if (!sameClaims(descriptorClaims, desiredClaims)) {
        await writeTaskDescriptor(target, {
          ...descriptorArtifact.value,
          writeClaims: desiredClaims,
          updatedAt: new Date().toISOString(),
        }, packageRoot);
      }

      await clearTaskRecovery(target, { taskId: effectiveTaskId });
      await appendProtocolEvent(target, {
        taskId: effectiveTaskId,
        event: "TASK_RECOVERY_RESUMED",
        details: {
          recoveryId: recovery.recoveryId,
          reacquiredClaims: desiredClaims,
          previousClassification: recovery.classificationAtRecovery,
        },
      }, packageRoot, { taskId: effectiveTaskId });

      return {
        taskId: effectiveTaskId,
        taskKey: context.taskKey,
        resumed: true,
        recoveryId: recovery.recoveryId,
        phase: state.phase,
        reacquiredClaims: desiredClaims,
        mutationAllowed: true,
      };
    });
  });
}

export function formatTaskResumeResult(result) {
  const claims = result.reacquiredClaims.length === 0 ? "none" : result.reacquiredClaims.join(", ");
  return `resumed task: ${result.taskId}\nphase: ${result.phase} (unchanged)\nreacquired claims: ${claims}\n`;
}
