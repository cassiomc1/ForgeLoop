import { createHash } from "node:crypto";

/**
 * Canonical, limited, auditable repair path for one known historical defect:
 * an `OPERATOR_RECOVERY_RECORDED` event written by an early adapter whose
 * `details` carried only `{ classification, reasonCodes, authorization, note }`
 * and none of the modern recovery identity fields (most notably `recoveryId`).
 *
 * Invariants:
 * - The strict validator stays the default. An unmigrated legacy event keeps
 *   the ledger invalid (fail closed, INCONSISTENT ownership).
 * - Existing ledger events are never rewritten, removed, or edited. Repair
 *   appends exactly one `LEGACY_RECOVERY_MIGRATION_RECORDED` event per legacy
 *   event at the current ledger tail, binding it by taskId, seq, hash, and a
 *   deterministic recoveryId.
 * - Only the exact known legacy signature is eligible. Any other incomplete
 *   recovery event (including a modern `TASK_RECOVERY_RECORDED` without
 *   `recoveryId`) remains invalid. Ambiguity stays INCONSISTENT.
 * - The migration event is the canonical recovery record for the repaired
 *   state; it carries the complete modern recovery projection plus an
 *   immutable binding to the historical source. The original legacy event
 *   remains unchanged and independently recognizable as legacy evidence.
 * - Migration authority is always CALLER_ACKNOWLEDGED from a fresh explicit
 *   caller acknowledgement. Legacy authorization values are preserved only as
 *   historical metadata and never grant current authority.
 */

export const LEGACY_RECOVERY_MIGRATION_EVENT = "LEGACY_RECOVERY_MIGRATION_RECORDED";
export const LEGACY_RECOVERY_DEFECT = "OPERATOR_RECOVERY_RECORDED_WITHOUT_RECOVERY_ID";
export const LEGACY_RECOVERY_MIGRATION_ID_DOMAIN = "forgeloop:legacy-recovery-migration:v1";
export const MIGRATED_RECOVERY_CLASSIFICATION = "LEGACY_BOUNDARY_MIGRATED";

const LEGACY_DETAIL_KEYS = Object.freeze([
  "classification",
  "reasonCodes",
  "authorization",
  "note",
]);

const MIGRATION_AUTHORITY_KINDS = new Set(["CALLER_ACKNOWLEDGED", "HOST_ATTESTED"]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SAFE_OBSERVED_CLASSIFICATIONS = new Set([
  "ACTIVE", "RECOVERABLE", "STALE", "ABANDONED", "COMPLETE", "RECOVERED", "INCONSISTENT",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Recognizes ONLY the exact known legacy detail signature. Anything else —
 * including a near miss with extra or missing keys — is not eligible for
 * migration. Event-level validation additionally requires taskId, seq, and
 * hash via {@link isLegacyRecoveryEventShape}.
 */
export function isLegacyRecoveryDetailsShape(details) {
  if (!isPlainObject(details)) return false;
  const keys = Object.keys(details);
  if (!keys.every((key) => LEGACY_DETAIL_KEYS.includes(key))) return false;
  if (details.classification !== "RECOVERABLE") return false;
  if (details.authorization !== "OPERATOR_AUTHORIZED") return false;
  if (!Array.isArray(details.reasonCodes)
    || !details.reasonCodes.every((code) => isNonEmptyString(code))) return false;
  return isNonEmptyString(details.note);
}

export function isLegacyRecoveryEventShape(event) {
  if (event?.event !== "OPERATOR_RECOVERY_RECORDED") return false;
  if (!isLegacyRecoveryDetailsShape(event.details)) return false;
  if (!isNonEmptyString(event.taskId)) return false;
  if (!Number.isInteger(event.seq) || event.seq < 1) return false;
  return typeof event.hash === "string" && HASH_PATTERN.test(event.hash);
}

/**
 * Deterministic canonical binding between a legacy recovery event and its
 * official migration event. The value is formatted to satisfy the durable
 * task-recovery artifact's recoveryId pattern (`recovery-…`).
 */
export function legacyRecoveryMigrationId({ taskId, seq, hash }) {
  if (!isNonEmptyString(taskId) || !Number.isInteger(seq) || !isNonEmptyString(hash)) {
    throw new Error("legacyRecoveryMigrationId requires taskId, seq, and hash");
  }
  const digest = createHash("sha256")
    .update(`${LEGACY_RECOVERY_MIGRATION_ID_DOMAIN}:${taskId}:${seq}:${hash}`)
    .digest("hex");
  return `recovery-legacy-${digest}`;
}

const MIGRATED_RECOVERY_ID_PATTERN = /^recovery-legacy-[a-f0-9]{64}$/;

function assertNonEmptyIsoTimestamp(value, field) {
  if (!isNonEmptyString(value) || !ISO_TIMESTAMP_PATTERN.test(value)) {
    throw protocolError(`legacy migration event details.${field} must be an ISO-8601 UTC timestamp`);
  }
}

/**
 * Strict details validation for appended migration events. Mirrors the
 * assert* helpers in events.js; throws E_EVENT_INVALID on any deviation.
 *
 * Required shape:
 * - immutable legacy binding: defect, legacyEventSeq, legacyEventHash,
 *   legacyEventAt, legacyTaskId, legacyClassification, legacyAuthority,
 *   legacyNote
 * - complete modern recovery projection: recoveryId, classification
 *   (always LEGACY_BOUNDARY_MIGRATED), reasonCodes, releasedClaims,
 *   previousPhase, previousRevision, currentBranch, currentHead,
 *   recoveredAt, repairObservedClassification,
 *   repairObservedReasonCodes, authorityKind. Historical values
 *   (legacyClassification, legacyAuthority, legacyEventAt) are metadata only.
 */
export function assertLegacyMigrationDetails(details) {
  if (!isPlainObject(details)) {
    throw protocolError("legacy migration event requires structured details");
  }
  for (const key of [
    "recoveryId",
    "defect",
    "legacyEventType",
    "legacyEventHash",
    "legacyEventAt",
    "legacyTaskId",
    "legacyClassification",
    "legacyAuthority",
    "classification",
    "previousPhase",
    "repairObservedClassification",
    "authorityKind",
  ]) {
    if (!isNonEmptyString(details[key])) {
      throw protocolError(`legacy migration event details.${key} must be a non-empty string`);
    }
  }
  assertNonEmptyIsoTimestamp(details.legacyEventAt, "legacyEventAt");
  assertNonEmptyIsoTimestamp(details.recoveredAt, "recoveredAt");
  if (!MIGRATED_RECOVERY_ID_PATTERN.test(details.recoveryId)) {
    throw protocolError("legacy migration event details.recoveryId must be a deterministic recovery-legacy-<sha256> identifier");
  }
  if (!HASH_PATTERN.test(details.legacyEventHash)) {
    throw protocolError("legacy migration event details.legacyEventHash must be a lowercase sha256 hex string");
  }
  if (details.defect !== LEGACY_RECOVERY_DEFECT) {
    throw protocolError(`legacy migration event details.defect must be ${LEGACY_RECOVERY_DEFECT}`);
  }
  if (details.classification !== MIGRATED_RECOVERY_CLASSIFICATION) {
    throw protocolError(`legacy migration event details.classification must be ${MIGRATED_RECOVERY_CLASSIFICATION}`);
  }
  if (!Number.isInteger(details.legacyEventSeq) || details.legacyEventSeq < 1) {
    throw protocolError("legacy migration event details.legacyEventSeq must be a positive integer");
  }
  for (const key of ["currentBranch", "currentHead"]) {
    if (details[key] !== null && !isNonEmptyString(details[key])) {
      throw protocolError(`legacy migration event details.${key} must be a non-empty string or null`);
    }
  }
  if (!MIGRATION_AUTHORITY_KINDS.has(details.authorityKind)) {
    throw protocolError("legacy migration event details.authorityKind is invalid");
  }
  if (!SAFE_OBSERVED_CLASSIFICATIONS.has(details.repairObservedClassification)) {
    throw protocolError("legacy migration event details.repairObservedClassification is invalid");
  }
  if (!Array.isArray(details.reasonCodes)
    || !details.reasonCodes.every((code) => isNonEmptyString(code))) {
    throw protocolError("legacy migration event details.reasonCodes must be an array of non-empty strings");
  }
  if (!Array.isArray(details.releasedClaims)
    || !details.releasedClaims.every((claim) => isNonEmptyString(claim))) {
    throw protocolError("legacy migration event details.releasedClaims must be an array of non-empty strings");
  }
  if (!Array.isArray(details.repairObservedReasonCodes)
    || !details.repairObservedReasonCodes.every((code) => isNonEmptyString(code))) {
    throw protocolError("legacy migration event details.repairObservedReasonCodes must be an array of non-empty strings");
  }
  if (!Number.isInteger(details.previousRevision) || details.previousRevision < 0) {
    throw protocolError("legacy migration event details.previousRevision must be a non-negative integer");
  }
}

function protocolError(message) {
  const error = new Error(message);
  error.code = "E_EVENT_INVALID";
  return error;
}
