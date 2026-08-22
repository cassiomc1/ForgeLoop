import { resolveTaskContext } from "../core/task-context.js";
import { readTaskDescriptor, writeTaskDescriptor } from "../core/task-descriptor.js";
import { discoverTasks } from "../core/task-discovery.js";
import { appendProtocolEvent } from "../core/events.js";
import { readWorkState } from "../core/work-state.js";
import { normalizeWriteClaims, assertScopeClean } from "../core/task-scope.js";
import { assertNoScopeConflictsWithInspection } from "./task-create.js";
import {
  classifyLockStaleness,
  readLockInfo,
  releaseStaleTaskLockIfUnchanged,
  withProjectClaimsLock,
} from "../core/task-lock.js";
import { withTaskTransaction } from "../core/transaction.js";
import {
  clearTaskRecovery,
} from "../core/task-recovery.js";
import { resolveTaskClaimState } from "../core/task-claim-state.js";
import {
  E_TASK_LOCKED,
  E_TASK_NOT_RECOVERED,
  E_TASK_RECOVERY_INCONSISTENT,
} from "../core/error-codes.js";

function resumeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sameClaims(left, right) {
  return left.length === right.length && left.every((claim, index) => claim === right[index]);
}

async function requireActiveRecovery(target, taskId, packageRoot) {
  const projection = await resolveTaskClaimState(target, { taskId, packageRoot });
  if (!projection.valid) {
    throw resumeError(
      E_TASK_RECOVERY_INCONSISTENT,
      `Task ${taskId} claim ownership is inconsistent; repair it before task-resume`,
      { reasonCodes: projection.reasonCodes, recoveryErrors: projection.ownershipErrors },
    );
  }
  if (projection.claimState !== "RELEASED_BY_RECOVERY" || !projection.recovery) {
    throw resumeError(E_TASK_NOT_RECOVERED, `Task ${taskId} is not RECOVERED`);
  }
  return projection;
}

export async function runTaskResume({ target, packageRoot, taskId, claims } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const effectiveTaskId = context.taskId;
  const initialProjection = await requireActiveRecovery(target, effectiveTaskId, packageRoot);
  const initialRecovery = initialProjection.recovery;

  return withProjectClaimsLock(target, "task-resume", async () => {
    const lockedProjection = await requireActiveRecovery(target, effectiveTaskId, packageRoot);
    if (lockedProjection.recovery.recoveryId !== initialRecovery.recoveryId) {
      throw resumeError(
        E_TASK_RECOVERY_INCONSISTENT,
        `Task ${effectiveTaskId} recovery state changed before resume`,
      );
    }

    const observedLock = await readLockInfo(target, effectiveTaskId);
    const lockClassification = classifyLockStaleness(observedLock);
    if (lockClassification.status === "LIVE") {
      throw resumeError(E_TASK_LOCKED, `Task ${effectiveTaskId} has a live mutation lock`, {
        lockInfo: observedLock,
        lockClassification,
      });
    }
    if (lockClassification.status === "UNKNOWN" || lockClassification.status === "CORRUPT") {
      throw resumeError(
        E_TASK_RECOVERY_INCONSISTENT,
        `Task ${effectiveTaskId} lock ownership is ${lockClassification.status}; resume is blocked`,
        { lockInfo: observedLock, lockClassification },
      );
    }
    if (lockClassification.status === "STALE") {
      const released = await releaseStaleTaskLockIfUnchanged(target, effectiveTaskId, observedLock);
      if (!released.released && released.reason !== "LOCK_MISSING") {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} lock changed during resume (${released.reason})`,
          { lockRelease: released },
        );
      }
    }

    return withTaskTransaction({
      target,
      taskId: effectiveTaskId,
      operation: "task-resume",
      packageRoot,
      recordCommitEvent: true,
    }, async () => {
      const descriptorArtifact = await readTaskDescriptor(target, effectiveTaskId, packageRoot);

      const state = await readWorkState(target, { packageRoot, taskId: effectiveTaskId });
      const claimProjection = await resolveTaskClaimState(target, {
        taskId: effectiveTaskId,
        packageRoot,
        descriptor: descriptorArtifact.value,
        state,
      });
      const recovery = claimProjection.recovery;
      if (!claimProjection.valid
        || claimProjection.claimState !== "RELEASED_BY_RECOVERY"
        || recovery?.recoveryId !== initialRecovery.recoveryId) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} recovery state does not establish validated released ownership`,
          { recoveryErrors: claimProjection.ownershipErrors },
        );
      }
      if (!state
        || state.phase !== recovery.previousPhase
        || (state.revision ?? 0) !== recovery.previousRevision) {
        throw resumeError(
          E_TASK_RECOVERY_INCONSISTENT,
          `Task ${effectiveTaskId} lifecycle state no longer matches recovery revision`,
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
