import { resolveTaskContext } from "../core/task-context.js";
import { inspectTaskConflictState } from "../core/task-conflict-inspection.js";
import { appendProtocolEvent } from "../core/events.js";
import { mutateWorkState } from "../core/work-state.js";
import { withTaskTransaction, getActiveTaskTransaction } from "../core/transaction.js";
import { currentRepositoryFingerprint } from "../core/repository.js";
import {
  E_TASK_RECOVERY_AUTHORIZATION_REQUIRED,
  E_TASK_RECOVERY_INCONSISTENT,
  E_TASK_RECOVERY_UNSAFE,
} from "../core/error-codes.js";
import { readTaskDescriptor } from "../core/task-descriptor.js";

function recoveryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function runTaskRecover({ target, packageRoot, taskId, operatorAuthorized = false } = {}) {
  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const effectiveTaskId = context.taskId;

  if (!operatorAuthorized) {
    throw recoveryError(
      E_TASK_RECOVERY_AUTHORIZATION_REQUIRED,
      "task-recover requires explicit operator authorization: re-run with --operator-authorized",
    );
  }

  const inspection = await inspectTaskConflictState(target, { taskId: effectiveTaskId, packageRoot });

  if (inspection.classification === "COMPLETE") {
    throw recoveryError(E_TASK_RECOVERY_UNSAFE, `Task ${effectiveTaskId} is already COMPLETE`);
  }
  if (inspection.classification === "ACTIVE") {
    throw recoveryError(
      E_TASK_RECOVERY_UNSAFE,
      `Task ${effectiveTaskId} is ACTIVE (${inspection.reasonCodes.join(", ")}); recovery is refused while an owner or fresh checkpoint exists`,
    );
  }
  if (inspection.classification === "INCONSISTENT") {
    throw recoveryError(
      E_TASK_RECOVERY_INCONSISTENT,
      `Task ${effectiveTaskId} state is INCONSISTENT (${inspection.reasonCodes.join(", ")}); repair the underlying artifact first`,
    );
  }

  const descriptorArtifact = await readTaskDescriptor(target, context.taskKey, packageRoot);
  const releasedClaims = descriptorArtifact?.value?.writeClaims ?? [];
  const repository = await currentRepositoryFingerprint(target);

  await withRecoveryMutation({ target, packageRoot, taskId: effectiveTaskId }, async () => {
    await appendProtocolEvent(target, {
      taskId: effectiveTaskId,
      event: "OPERATOR_RECOVERY_RECORDED",
      details: {
        classification: inspection.classification,
        reasonCodes: inspection.reasonCodes,
        previousPhase: inspection.evidence.phase,
        previousHead: inspection.evidence.repositoryHead,
        previousBranch: inspection.evidence.repositoryBranch,
        currentHead: repository.head,
        currentBranch: repository.branch,
        releasedClaims,
        authorization: "OPERATOR_AUTHORIZED",
      },
    }, packageRoot, { taskId: effectiveTaskId });

    // Refresh the checkpoint repository fingerprint so the recovered task no
    // longer reports stale drift. Lifecycle phase and recorded evidence are
    // preserved verbatim; completion claims are never fabricated.
    await mutateWorkState(target, {
      expectedRevision: inspection.evidence.workStateRevision ?? 0,
      packageRoot,
      taskId: effectiveTaskId,
    }, (current) => ({
      ...current,
      repositoryFingerprint: repository,
    }));
  });

  return {
    taskId: effectiveTaskId,
    taskKey: context.taskKey,
    recovered: true,
    classification: inspection.classification,
    reasonCodes: inspection.reasonCodes,
    phase: inspection.evidence.phase,
    claimsReleased: true,
    releasedClaims,
    message: `Task ${effectiveTaskId} recovered by operator authorization; write claims released without completion claim`,
  };
}

async function withRecoveryMutation({ target, packageRoot, taskId }, callback) {
  if (getActiveTaskTransaction()) return callback();
  return withTaskTransaction({
    target,
    taskId,
    operation: "task-recover",
    packageRoot,
    recordCommitEvent: true,
  }, callback);
}

export function formatTaskRecoverResult(result) {
  return `${result.message}\nclassification: ${result.classification}\nphase: ${result.phase} (unchanged)\n`;
}
