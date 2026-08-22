import { classifyLoadedWorkState, readWorkState } from "./work-state.js";
import { taskArtifactPath } from "./task-paths.js";
import { readLockInfo, classifyLockStaleness } from "./task-lock.js";
import { validateEventLedger } from "./events.js";
import { currentRepositoryFingerprint } from "./repository.js";

export const TASK_CONFLICT_CLASSIFICATIONS = Object.freeze([
  "ACTIVE",
  "RECOVERABLE",
  "STALE",
  "ABANDONED",
  "INCONSISTENT",
]);

const POST_EXECUTION_PHASES = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

export const TASK_CONFLICT_IDLE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

const RECONCILABLE_DRIFT = new Set(["REPOSITORY_CHANGED"]);

function idleMs(lastUpdated, now) {
  const parsed = Date.parse(lastUpdated);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, now - parsed);
}

function passedCheckCount(state) {
  return (state?.checks ?? []).filter((check) => check.status === "passed").length;
}

/**
 * Deterministic classification of a potentially conflicting task from
 * machine-readable state only. REVIEWING plus an old timestamp alone is never
 * sufficient for STALE or ABANDONED: post-execution tasks whose only drift is
 * REPOSITORY_CHANGED remain RECOVERABLE because an official recovery path
 * exists.
 */
export function classifyConflictEvidence(evidence, {
  now = Date.now(),
  idleThresholdMs = TASK_CONFLICT_IDLE_THRESHOLD_MS,
} = {}) {
  if (!evidence || evidence.healthy === false) {
    return {
      classification: "INCONSISTENT",
      reasonCodes: ["E_TASK_DESCRIPTOR_INVALID"],
      recoverable: false,
    };
  }

  const {
    lockStatus,
    freshnessStatus,
    freshnessReasons,
    phase,
    lastUpdated,
    ledgerValid,
    recordedChecks,
  } = evidence;

  if (!ledgerValid) {
    return {
      classification: "INCONSISTENT",
      reasonCodes: ["E_LEDGER_INVALID"],
      recoverable: false,
    };
  }
  const KNOWN_PHASES = new Set([
    "RECEIVED", "DISCOVERING", "CONTRACT_READY", "ROUTED", "DESIGNING", "PLANNED",
    ...POST_EXECUTION_PHASES,
  ]);
  if (!phase || !KNOWN_PHASES.has(phase)) {
    return {
      classification: "INCONSISTENT",
      reasonCodes: ["E_PHASE_UNKNOWN"],
      recoverable: false,
    };
  }

  const hasLiveLease = lockStatus === "LIVE";
  const drift = freshnessReasons ?? [];
  const staleOnlyRepositoryDrift = freshnessStatus === "REVALIDATION_REQUIRED"
    && drift.length > 0
    && drift.every((reason) => RECONCILABLE_DRIFT.has(reason));
  const idle = idleMs(lastUpdated, now);
  const idleBeyondThreshold = idle !== null && idle > idleThresholdMs;

  if (hasLiveLease || freshnessStatus === "FRESH") {
    return {
      classification: "ACTIVE",
      reasonCodes: hasLiveLease ? ["E_TASK_LOCKED"] : ["STATE_FRESH"],
      recoverable: false,
    };
  }

  if (phase === "COMPLETE") {
    return {
      classification: "COMPLETE",
      reasonCodes: ["TASK_COMPLETE"],
      recoverable: false,
      terminal: true,
    };
  }

  if (POST_EXECUTION_PHASES.has(phase)) {
    if (staleOnlyRepositoryDrift) {
      return {
        classification: "RECOVERABLE",
        reasonCodes: ["E_REPOSITORY_CHANGED", "OFFICIAL_RECOVERY_AVAILABLE"],
        recoverable: true,
        recoveredBy: recordedChecks > 0
          ? ["forgeloop reconcile-closure", "canonical VERIFYING -> REVIEWING -> complete pipeline"]
          : ["forgeloop reconcile-closure", "canonical verification recording pipeline"],
      };
    }
    if (idleBeyondThreshold && recordedChecks === 0) {
      return {
        classification: "ABANDONED",
        reasonCodes: ["NO_RECORDED_EVIDENCE", "IDLE_BEYOND_THRESHOLD", ...drift],
        recoverable: false,
        recoveredBy: ["forgeloop task-recover --task <id> --operator-authorized"],
      };
    }
    return {
      classification: "ACTIVE",
      reasonCodes: ["RECENT_PROGRESS", ...(drift.length > 0 ? drift : [])],
      recoverable: false,
    };
  }

  if (idleBeyondThreshold) {
    return {
      classification: "STALE",
      reasonCodes: ["IDLE_BEYOND_THRESHOLD", ...(drift.length > 0 ? drift : ["STATE_FRESH"])],
      recoverable: false,
      recoveredBy: ["forgeloop task-recover --task <id> --operator-authorized"],
    };
  }

  return {
    classification: "ACTIVE",
    reasonCodes: ["RECENT_PROGRESS"],
    recoverable: false,
  };
}

export async function inspectTaskConflictState(target, { taskId, packageRoot, now = Date.now() } = {}) {
  const [lockInfo, state] = await Promise.all([
    readLockInfo(target, taskId),
    readWorkState(target, { packageRoot, taskId }),
  ]);

  const lockClassification = classifyLockStaleness(lockInfo, now);

  let freshness = null;
  if (state) {
    try {
      freshness = await classifyLoadedWorkState({
        target,
        state,
        contractFile: taskArtifactPath(taskId, "contract"),
      });
    } catch {
      freshness = { status: "UNKNOWN", reasons: ["E_STATE_UNREADABLE"] };
    }
  }

  let ledgerValid = true;
  try {
    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    ledgerValid = ledger.valid;
  } catch {
    ledgerValid = false;
  }

  const repository = await currentRepositoryFingerprint(target);

  const evidence = {
    healthy: true,
    phase: state?.phase ?? null,
    lastUpdated: state?.lastUpdated ?? null,
    workStateRevision: state?.revision ?? 0,
    lockStatus: lockClassification.status,
    lockExpiresAt: lockClassification.expiresAt ?? null,
    freshnessStatus: freshness?.status ?? "UNKNOWN",
    freshnessReasons: freshness?.reasons ?? [],
    ledgerValid,
    recordedChecks: passedCheckCount(state),
    totalChecks: state?.checks?.length ?? 0,
    repositoryBranch: repository.branch,
    repositoryHead: repository.head,
  };

  const verdict = classifyConflictEvidence(evidence, { now });

  return {
    taskId,
    classification: verdict.classification,
    reasonCodes: verdict.reasonCodes,
    recoverable: verdict.recoverable ?? false,
    ...(verdict.recoveredBy ? { recoveredBy: verdict.recoveredBy } : {}),
    evidence,
  };
}
