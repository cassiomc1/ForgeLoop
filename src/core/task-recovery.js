import { PROTOCOL_VERSION } from "./protocol.js";
import { readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import {
  E_TASK_RECOVERED,
  E_TASK_RECOVERY_AUTHORITY_INVALID,
} from "./error-codes.js";
import { taskArtifactPath } from "./task-paths.js";
import { getActiveTaskTransaction } from "./transaction.js";

export const TASK_RECOVERY_SCHEMA_VERSION = 1;
export const TASK_RECOVERY_EVENT_TYPES = Object.freeze(new Set([
  "TASK_RECOVERY_RECORDED",
  "OPERATOR_RECOVERY_RECORDED",
]));

export function createTaskRecovery({
  taskId,
  recoveredAt,
  recoveryId,
  recoveryEventSeq,
  classificationAtRecovery,
  reasonCodes,
  releasedClaims,
  previousPhase,
  previousRevision,
  repositoryFingerprint,
  authority,
}) {
  const recovery = {
    schemaVersion: TASK_RECOVERY_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId,
    status: "RECOVERED",
    recoveredAt,
    recoveryId,
    recoveryEventSeq,
    classificationAtRecovery,
    reasonCodes: [...reasonCodes],
    releasedClaims: [...releasedClaims],
    previousPhase,
    previousRevision,
    repositoryFingerprint: { ...repositoryFingerprint },
    authority: { ...authority },
  };
  assertTaskRecoveryAuthority(recovery);
  return recovery;
}

export function assertTaskRecoveryAuthority(recovery) {
  const authority = recovery?.authority;
  const validCaller = authority?.kind === "CALLER_ACKNOWLEDGED" && authority.grantRef === undefined;
  const validHost = authority?.kind === "HOST_ATTESTED"
    && typeof authority.grantRef === "string"
    && authority.grantRef.trim() !== "";
  if (validCaller || validHost) return recovery;
  const error = new Error(
    "Recovery authority must be caller acknowledgement or host attestation with a trusted grant reference",
  );
  error.code = E_TASK_RECOVERY_AUTHORITY_INVALID;
  throw error;
}

export async function readTaskRecovery(target, { taskId, packageRoot } = {}) {
  try {
    const artifact = await readJsonArtifact(target, taskArtifactPath(taskId, "recovery"), "task-recovery", packageRoot);
    assertTaskRecoveryAuthority(artifact.value);
    return artifact;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    throw error;
  }
}

export function writeTaskRecovery(target, recovery, packageRoot) {
  assertTaskRecoveryAuthority(recovery);
  return writeJsonArtifact(
    target,
    taskArtifactPath(recovery.taskId, "recovery"),
    recovery,
    "task-recovery",
    packageRoot,
    { taskId: recovery.taskId, operation: "write-task-recovery" },
  );
}

export async function clearTaskRecovery(target, { taskId } = {}) {
  const transaction = getActiveTaskTransaction();
  if (!transaction) {
    throw new Error("clearTaskRecovery requires an active task transaction");
  }
  await transaction.stageDelete(taskArtifactPath(taskId, "recovery"));
}

export function isTaskRecovered(recovery) {
  return recovery?.status === "RECOVERED";
}

export async function assertTaskNotRecovered(target, { taskId, packageRoot } = {}) {
  const artifact = await readTaskRecovery(target, { taskId, packageRoot });
  if (!isTaskRecovered(artifact?.value)) return null;
  const error = new Error(
    `Task ${taskId} is RECOVERED and its write claims are released; run task-resume before ordinary mutation`,
  );
  error.code = E_TASK_RECOVERED;
  error.taskId = taskId;
  error.recovery = artifact.value;
  throw error;
}

export function effectiveTaskClaims({ phase, recovery, writeClaims = [] } = {}) {
  return phase === "COMPLETE" || isTaskRecovered(recovery) ? [] : [...writeClaims];
}

export function taskClaimProjection({ phase, recovery, writeClaims = [] } = {}) {
  const historicalWriteClaims = [...writeClaims];
  const effectiveWriteClaims = effectiveTaskClaims({ phase, recovery, writeClaims });
  const claimState = phase === "COMPLETE"
    ? "RELEASED_BY_COMPLETION"
    : isTaskRecovered(recovery)
      ? "RELEASED_BY_RECOVERY"
      : "ACTIVE";
  return {
    writeClaims: effectiveWriteClaims,
    historicalWriteClaims,
    effectiveWriteClaims,
    claimState,
    mutationAllowed: !isTaskRecovered(recovery),
  };
}

function sameList(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function recoveryConsistencyError(message) {
  return { code: "E_TASK_RECOVERY_INCONSISTENT", message };
}

export function validateTaskRecoveryConsistency({
  taskId,
  recovery = null,
  events = [],
  historicalWriteClaims = null,
} = {}) {
  const errors = [];
  const recoveryEvents = events.filter((event) => TASK_RECOVERY_EVENT_TYPES.has(event.event));
  const resumeEvents = events.filter((event) => event.event === "TASK_RECOVERY_RESUMED");

  for (const resumed of resumeEvents) {
    const matching = recoveryEvents.filter((event) => event.details?.recoveryId === resumed.details?.recoveryId);
    if (matching.length !== 1 || matching[0].seq >= resumed.seq) {
      errors.push(recoveryConsistencyError(
        `TASK_RECOVERY_RESUMED at seq ${resumed.seq} does not reference exactly one preceding recovery event`,
      ));
    }
  }

  for (const event of recoveryEvents) {
    const matchingResumes = resumeEvents.filter((candidate) => candidate.details?.recoveryId === event.details?.recoveryId);
    if (matchingResumes.length > 1) {
      errors.push(recoveryConsistencyError(`Recovery ${event.details?.recoveryId ?? "unknown"} was resumed more than once`));
    }
    if (!recovery && matchingResumes.length === 0) {
      errors.push(recoveryConsistencyError(
        `Recovery event ${event.details?.recoveryId ?? "unknown"} has neither an active recovery artifact nor a resume event`,
      ));
    }
  }

  if (!recovery) return errors;
  if (recovery.taskId !== taskId) {
    errors.push(recoveryConsistencyError(`Recovery artifact belongs to ${recovery.taskId}, not ${taskId}`));
  }
  const event = events.find((candidate) => candidate.seq === recovery.recoveryEventSeq);
  if (!event || !TASK_RECOVERY_EVENT_TYPES.has(event.event)) {
    errors.push(recoveryConsistencyError(
      `Recovery artifact references missing recovery event seq ${recovery.recoveryEventSeq}`,
    ));
    return errors;
  }

  const comparisons = [
    [event.taskId === recovery.taskId, "taskId"],
    [event.at === recovery.recoveredAt, "recoveredAt"],
    [event.details?.recoveryId === recovery.recoveryId, "recoveryId"],
    [event.details?.classification === recovery.classificationAtRecovery, "classificationAtRecovery"],
    [sameList(event.details?.reasonCodes, recovery.reasonCodes), "reasonCodes"],
    [sameList(event.details?.releasedClaims, recovery.releasedClaims), "releasedClaims"],
    [event.details?.previousPhase === recovery.previousPhase, "previousPhase"],
    [event.details?.previousRevision === recovery.previousRevision, "previousRevision"],
    [event.details?.currentBranch === recovery.repositoryFingerprint?.branch, "repositoryFingerprint.branch"],
    [event.details?.currentHead === recovery.repositoryFingerprint?.head, "repositoryFingerprint.head"],
    [event.details?.authorityKind === recovery.authority?.kind, "authority.kind"],
  ];
  for (const [matches, field] of comparisons) {
    if (!matches) errors.push(recoveryConsistencyError(`Recovery artifact and ledger disagree on ${field}`));
  }
  if (historicalWriteClaims && !sameList(historicalWriteClaims, recovery.releasedClaims)) {
    errors.push(recoveryConsistencyError("Recovery releasedClaims do not match the task descriptor's historical claims"));
  }
  if (resumeEvents.some((candidate) => candidate.details?.recoveryId === recovery.recoveryId)) {
    errors.push(recoveryConsistencyError(`Recovery ${recovery.recoveryId} is both active and already resumed`));
  }
  return errors;
}
