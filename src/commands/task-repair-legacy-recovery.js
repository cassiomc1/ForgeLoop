import { resolveTaskContext } from "../core/task-context.js";
import { readTaskDescriptor } from "../core/task-descriptor.js";
import { normalizeWriteClaims } from "../core/task-scope.js";
import {
  appendProtocolEvent,
  validateEventLedger,
  validateStateLedgerCoherence,
} from "../core/events.js";
import {
  readLockInfo,
  releaseStaleTaskLockIfUnchanged,
  withProjectClaimsLock,
} from "../core/task-lock.js";
import { readWorkState } from "../core/work-state.js";
import { inspectTaskConflictState, MEANINGFUL_ACTIVITY_EVENTS } from "../core/task-conflict-inspection.js";
import { resolveTaskClaimState } from "../core/task-claim-state.js";
import { currentRepositoryFingerprint } from "../core/repository.js";
import { withTaskTransaction } from "../core/transaction.js";
import {
  createTaskRecovery,
  readTaskRecovery,
  writeTaskRecovery,
} from "../core/task-recovery.js";
import {
  E_LEGACY_RECOVERY_MIGRATION_INVALID,
  E_TASK_LOCKED,
  E_TASK_RECOVERY_AUTHORIZATION_REQUIRED,
  E_TASK_RECOVERY_INCONSISTENT,
} from "../core/error-codes.js";
import {
  LEGACY_RECOVERY_DEFECT,
  LEGACY_RECOVERY_MIGRATION_EVENT,
  MIGRATED_RECOVERY_CLASSIFICATION,
  assertLegacyMigrationDetails,
  isLegacyRecoveryEventShape,
  legacyRecoveryMigrationId,
} from "../core/task-recovery-migration.js";

const MODERN_RECOVERY_EVENT_TYPES = new Set(["TASK_RECOVERY_RECORDED", "OPERATOR_RECOVERY_RECORDED"]);

function repairError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

/**
 * Narrow migration inspection: the ledger must be structurally trustworthy
 * with the single narrowly scoped exception of unmigrated legacy recovery
 * events. Any other error fails closed. Returns the recognized candidates.
 */
async function inspectLegacyRecoveryMigration(target, { taskId, packageRoot }) {
  const tolerated = await validateEventLedger(target, packageRoot, {
    taskId,
    allowUnmigratedLegacyRecoveryEvents: true,
  });
  if (!tolerated.valid) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      "Ledger is not structurally trustworthy for legacy recovery migration",
      { errors: tolerated.errors },
    );
  }

  const events = tolerated.events;
  for (const event of events) {
    if (MODERN_RECOVERY_EVENT_TYPES.has(event.event)
      && !isLegacyRecoveryEventShape(event)
      && !event.details?.recoveryId) {
      throw repairError(
        E_LEGACY_RECOVERY_MIGRATION_INVALID,
        `Modern recovery event ${event.seq} has no recoveryId; ambiguous evidence cannot be migrated`,
      );
    }
    if (event.event === LEGACY_RECOVERY_MIGRATION_EVENT) {
      try {
        assertLegacyMigrationDetails(event.details);
      } catch (error) {
        throw repairError(
          E_LEGACY_RECOVERY_MIGRATION_INVALID,
          `Migration event ${event.seq} is invalid: ${error.message}`,
        );
      }
    }
  }
  // A strictly valid ledger means every legacy event is already migrated.
  const strict = await validateEventLedger(target, packageRoot, { taskId });
  if (strict.valid) {
    return { alreadyMigrated: true, events, candidates: [] };
  }

  const candidates = events.filter(isLegacyRecoveryEventShape);
  return { alreadyMigrated: false, events, candidates };
}

function requireSingleTailCandidate({ taskId, events, candidates }) {
  if (candidates.length === 0) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      `No recognizable legacy recovery event to migrate in task ${taskId}`,
    );
  }
  if (candidates.length > 1) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      `${candidates.length} unresolved legacy recovery events found; this release migrates exactly one per task`,
      { legacyEventSeqs: candidates.map((candidate) => candidate.seq) },
    );
  }
  const candidate = candidates[0];
  if (events.at(-1)?.seq !== candidate.seq) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      `Legacy recovery event ${candidate.seq} is not at the effective ledger boundary; post-boundary activity makes migration unsafe`,
    );
  }
  return candidate;
}

function refuseUnsafeBoundary(candidate, events) {
  const after = events.filter((event) => event.seq > candidate.seq);
  const meaningful = after.filter((event) => MEANINGFUL_ACTIVITY_EVENTS.has(event.event));
  if (meaningful.length > 0 || after.some((event) => event.event.startsWith("TASK_RECOVERY"))) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      `Activity exists after legacy recovery event ${candidate.seq}; the recorded boundary is no longer safe to migrate`,
      { activityAfter: meaningful.map((event) => ({ seq: event.seq, event: event.event })) },
    );
  }
}

async function readRepairContext(target, taskId, packageRoot) {
  const descriptorArtifact = await readTaskDescriptor(target, taskId, packageRoot);
  const state = await readWorkState(target, { packageRoot, taskId });
  if (!state) {
    throw repairError(E_TASK_RECOVERY_INCONSISTENT, "Work state is unreadable; boundary proof impossible");
  }
  const claims = normalizeWriteClaims(descriptorArtifact.value.writeClaims ?? []);
  return { descriptor: descriptorArtifact.value, state, historicalClaims: claims };
}

export async function runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery } = {}) {
  if (!acknowledgeRecovery) {
    throw repairError(
      E_TASK_RECOVERY_AUTHORIZATION_REQUIRED,
      "task-repair-legacy-recovery requires fresh explicit --acknowledge-recovery",
    );
  }

  const context = await resolveTaskContext(target, { taskId, packageRoot, explicitRequired: true });
  const effectiveTaskId = context.taskId;

  const initial = await inspectLegacyRecoveryMigration(target, { taskId: effectiveTaskId, packageRoot });
  if (initial.alreadyMigrated) {
    return alreadyRepairedResult(target, { taskId: effectiveTaskId, packageRoot, events: initial.events });
  }
  const initialCandidate = requireSingleTailCandidate({
    taskId: effectiveTaskId,
    events: initial.events,
    candidates: initial.candidates,
  });

    return withProjectClaimsLock(target, "task-repair-legacy-recovery", async () => {
    const lockedInspection = await inspectTaskConflictState(target, {
      taskId: effectiveTaskId,
      packageRoot,
    });
    if (lockedInspection.evidence.lockStatus === "LIVE") {
      throw repairError(E_TASK_LOCKED, `Task ${effectiveTaskId} has a live mutation lock`, {
        lockStatus: lockedInspection.evidence.lockStatus,
      });
    }
    if (lockedInspection.evidence.lockStatus !== "NONE"
      && lockedInspection.evidence.lockStatus !== "STALE") {
      throw repairError(
        E_LEGACY_RECOVERY_MIGRATION_INVALID,
        `Task ${effectiveTaskId} lock ownership is ${lockedInspection.evidence.lockStatus}; refusing unsafe migration`,
        { lockStatus: lockedInspection.evidence.lockStatus },
      );
    }
    // A stale lease may only be settled through the CAS-safe path; a lock that
    // changed under us (replacement owner) aborts the repair.
    if (lockedInspection.evidence.lockStatus === "STALE") {
      const observedLock = await readLockInfo(target, effectiveTaskId);
      const released = await releaseStaleTaskLockIfUnchanged(target, effectiveTaskId, observedLock);
      if (!released.released && released.reason !== "LOCK_MISSING") {
        throw repairError(
          E_LEGACY_RECOVERY_MIGRATION_INVALID,
          `Task ${effectiveTaskId} stale lock changed during settlement (${released.reason}); replacement owner preserved`,
          { lockRelease: released },
        );
      }
    }

    const existingRecovery = await readTaskRecovery(target, { taskId: effectiveTaskId, packageRoot });
    const locked = await inspectLegacyRecoveryMigration(target, { taskId: effectiveTaskId, packageRoot });
    if (locked.alreadyMigrated) {
      return verifyAlreadyRepaired(target, {
        taskId: effectiveTaskId,
        packageRoot,
        events: locked.events,
        existingRecovery,
      });
    }
    const candidate = requireSingleTailCandidate({
      taskId: effectiveTaskId,
      events: locked.events,
      candidates: locked.candidates,
    });
    if (candidate.hash !== initialCandidate.hash || candidate.seq !== initialCandidate.seq) {
      throw repairError(
        E_LEGACY_RECOVERY_MIGRATION_INVALID,
        "Ledger changed between inspection and project lock; aborting",
      );
    }
    refuseUnsafeBoundary(candidate, locked.events);

    if (existingRecovery) {
      throw repairError(
        E_TASK_RECOVERY_INCONSISTENT,
        `An unrelated or orphaned recovery artifact exists for task ${effectiveTaskId}; resolve it before migrating the legacy recovery`,
      );
    }

    const repairContext = await readRepairContext(target, effectiveTaskId, packageRoot);
    const coherenceErrors = validateStateLedgerCoherence(repairContext.state, locked.events);
    if (coherenceErrors.length > 0) {
      throw repairError(
        E_LEGACY_RECOVERY_MIGRATION_INVALID,
        "Work state and ledger are not coherent; the task may have progressed beyond the legacy boundary",
        { errors: coherenceErrors },
      );
    }

    const repository = await currentRepositoryFingerprint(target);
    const expectedRecoveryId = legacyRecoveryMigrationId({
      taskId: candidate.taskId,
      seq: candidate.seq,
      hash: candidate.hash,
    });

    const result = await withTaskTransaction({
      target,
      taskId: effectiveTaskId,
      operation: "task-repair-legacy-recovery",
      packageRoot,
      recordCommitEvent: true,
    }, async () => {
      const revalidated = await validateEventLedger(target, packageRoot, {
        taskId: effectiveTaskId,
        allowUnmigratedLegacyRecoveryEvents: true,
      });
      if (!revalidated.valid) {
        throw repairError(
          E_LEGACY_RECOVERY_MIGRATION_INVALID,
          "Pre-commit ledger revalidation failed inside the transaction",
          { errors: revalidated.errors },
        );
      }
      const tailCandidate = requireSingleTailCandidate({
        taskId: effectiveTaskId,
        events: revalidated.events,
        candidates: revalidated.events.filter(isLegacyRecoveryEventShape),
      });
      refuseUnsafeBoundary(tailCandidate, revalidated.events);

      const migratedAt = new Date().toISOString();
      const migrationEvent = await appendProtocolEvent(target, {
        taskId: effectiveTaskId,
        event: LEGACY_RECOVERY_MIGRATION_EVENT,
        at: migratedAt,
        details: {
          recoveryId: expectedRecoveryId,
          defect: LEGACY_RECOVERY_DEFECT,
          legacyEventType: tailCandidate.event,
          legacyEventSeq: tailCandidate.seq,
          legacyEventHash: tailCandidate.hash,
          legacyEventAt: tailCandidate.at,
          legacyTaskId: tailCandidate.taskId,
          legacyClassification: tailCandidate.details.classification,
          legacyAuthority: tailCandidate.details.authorization,
          classification: MIGRATED_RECOVERY_CLASSIFICATION,
          reasonCodes: [...tailCandidate.details.reasonCodes],
          releasedClaims: repairContext.historicalClaims,
          previousPhase: repairContext.state.phase,
          previousRevision: repairContext.state.revision ?? 0,
          currentBranch: repository.branch,
          currentHead: repository.head,
          recoveredAt: migratedAt,
          repairObservedClassification: lockedInspection.classification,
          repairObservedReasonCodes: lockedInspection.reasonCodes,
          authorityKind: "CALLER_ACKNOWLEDGED",
        },
      }, packageRoot, { taskId: effectiveTaskId });

      const recovery = createTaskRecovery({
        taskId: effectiveTaskId,
        recoveredAt: migrationEvent.at,
        recoveryId: expectedRecoveryId,
        recoveryEventSeq: migrationEvent.seq,
        classificationAtRecovery: MIGRATED_RECOVERY_CLASSIFICATION,
        reasonCodes: [...tailCandidate.details.reasonCodes],
        releasedClaims: repairContext.historicalClaims,
        previousPhase: repairContext.state.phase,
        previousRevision: repairContext.state.revision ?? 0,
        repositoryFingerprint: { branch: repository.branch, head: repository.head },
        authority: { kind: "CALLER_ACKNOWLEDGED" },
      });
      await writeTaskRecovery(target, recovery, packageRoot);

      return {
        repaired: 1,
        alreadyRepaired: false,
        taskId: effectiveTaskId,
        taskKey: context.taskKey,
        recoveryId: expectedRecoveryId,
        migrationEventSeq: migrationEvent.seq,
        legacyEventSeq: tailCandidate.seq,
        legacyEventAt: tailCandidate.at,
        classificationAtRecovery: MIGRATED_RECOVERY_CLASSIFICATION,
        releasedClaims: repairContext.historicalClaims,
        previousPhase: repairContext.state.phase,
        repairObservedClassification: lockedInspection.classification,
      };
    });

    const finalLedger = await validateEventLedger(target, packageRoot, { taskId: effectiveTaskId });
    if (!finalLedger.valid) {
      throw repairError(
        E_LEGACY_RECOVERY_MIGRATION_INVALID,
        "Post-migration ledger validation failed; ownership stays fail-closed",
        { errors: finalLedger.errors },
      );
    }
    return result;
  });
}

async function verifyAlreadyRepaired(target, {
  taskId,
  packageRoot,
  events,
  existingRecovery,
}) {
  const migrations = events.filter((event) => event.event === LEGACY_RECOVERY_MIGRATION_EVENT);
  if (migrations.length !== 1) {
    throw repairError(
      E_LEGACY_RECOVERY_MIGRATION_INVALID,
      `Expected exactly one migration event, found ${migrations.length}`,
    );
  }
  const migration = migrations[0];
  if (!existingRecovery) {
    throw repairError(
      E_TASK_RECOVERY_INCONSISTENT,
      "Migration event exists without its durable recovery artifact; repair state is incomplete",
    );
  }
  if (existingRecovery.value.recoveryEventSeq !== migration.seq
    || existingRecovery.value.recoveryId !== migration.details.recoveryId) {
    throw repairError(
      E_TASK_RECOVERY_INCONSISTENT,
      "Existing recovery artifact does not match the migrated recovery relationship",
    );
  }

  // alreadyRepaired means the WHOLE canonical recovery relationship is valid:
  // ownership must resolve to validated RELEASED_BY_RECOVERY and every
  // artifact field must agree with the canonical migration event.
  const projection = await resolveTaskClaimState(target, { taskId, packageRoot });
  const relationshipValid = projection.valid === true
    && projection.ownershipValid === true
    && projection.claimState === "RELEASED_BY_RECOVERY"
    && projection.recovery?.recoveryId === migration.details.recoveryId
    && projection.recovery?.recoveryEventSeq === migration.seq;
  if (!relationshipValid) {
    throw repairError(
      E_TASK_RECOVERY_INCONSISTENT,
      "Migrated recovery relationship is not fully validated; refusing idempotent no-op",
      {
        claimState: projection.claimState,
        reasonCodes: projection.reasonCodes,
        ownershipErrors: projection.ownershipErrors,
      },
    );
  }

  return {
    repaired: 0,
    alreadyRepaired: true,
    taskId,
    recoveryId: migration.details.recoveryId,
    migrationEventSeq: migration.seq,
  };
}

async function alreadyRepairedResult(target, { taskId, packageRoot, events }) {
  const existingRecovery = await readTaskRecovery(target, { taskId, packageRoot });
  return verifyAlreadyRepaired(target, { taskId, packageRoot, events, existingRecovery });
}

export function formatTaskRepairLegacyRecoveryResult(result) {
  if (result.alreadyRepaired) {
    return `task: ${result.taskId}\nstatus: already repaired (recovery ${result.recoveryId})\n`;
  }
  return [
    `repaired task: ${result.taskId}`,
    `migration event seq: ${result.migrationEventSeq}`,
    `legacy event seq: ${result.legacyEventSeq} (${result.legacyEventAt})`,
    `recovery id: ${result.recoveryId}`,
    `classification: ${result.classificationAtRecovery}`,
    `released claims: ${result.releasedClaims.join(", ") || "none"}`,
    "",
  ].join("\n");
}
