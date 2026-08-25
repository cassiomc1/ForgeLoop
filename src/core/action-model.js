import { createHash } from "node:crypto";

import { canonicalFingerprint } from "./artifacts.js";
import {
  APPROVAL_AUTHORITY_KINDS,
  APPROVAL_STATUSES,
  ACTION_CAPABILITIES,
  ACTION_EFFECT_CLASSES,
  ACTION_PROVENANCE,
  ACTION_STATES,
  CAPABILITY_DECISIONS,
  SIDE_EFFECTING_EFFECT_CLASSES,
} from "./action-constants.js";
import {
  E_ACTION_EVIDENCE_INVALID,
  E_ACTION_INVALID,
  E_ACTION_IDEMPOTENCY_CONFLICT,
  E_ACTION_IDEMPOTENCY_REQUIRED,
  E_ACTION_STATE_MISMATCH,
  E_APPROVAL_INVALID,
  E_POLICY_INVALID,
  E_TRAJECTORY_SCENARIO_INVALID,
} from "./error-codes.js";

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;
const ACTION_ID_REGEX = /^action-[A-Za-z0-9_-]+$/;
const APPROVAL_ID_REGEX = /^approval-[A-Za-z0-9_-]+$/;
const EVAL_ID_REGEX = /^eval-[A-Za-z0-9_-]+$/;

export const ACTION_TRANSITIONS = Object.freeze(
  new Map([
    ["PROPOSED", Object.freeze(["AUTHORIZED", "CANCELLED"])],
    ["AUTHORIZED", Object.freeze(["STARTED", "CANCELLED"])],
    ["STARTED", Object.freeze(["COMMITTED", "FAILED", "COMMIT_UNKNOWN"])],
    ["COMMITTED", Object.freeze(["VERIFIED", "COMMIT_UNKNOWN"])],
    ["VERIFIED", Object.freeze([])],
    ["FAILED", Object.freeze([])],
    ["COMMIT_UNKNOWN", Object.freeze(["COMMITTED", "AUTHORIZED", "COMMIT_UNKNOWN"])],
    ["CANCELLED", Object.freeze([])],
  ]),
);

export function actionRequiresIdempotency(effectClass) {
  return SIDE_EFFECTING_EFFECT_CLASSES.includes(effectClass);
}

export function actionIsTerminal(state) {
  return state === "VERIFIED" || state === "FAILED" || state === "CANCELLED";
}

export function canonicalActionIdentity(actionInput) {
  return {
    taskId: actionInput.taskId,
    actionId: actionInput.actionId,
    effectClass: actionInput.effectClass,
    capability: actionInput.capability,
    target: actionInput.target ?? null,
    operation: actionInput.operation ?? null,
    idempotencyKey: actionInput.idempotencyKey ?? null,
    requiredForCompletion: Boolean(actionInput.requiredForCompletion),
    requirement: actionInput.requirement ?? null,
  };
}

export function canonicalActionFingerprint(actionInput) {
  return canonicalFingerprint(canonicalActionIdentity(actionInput));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function actionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertActionTransition(from, to) {
  const targets = ACTION_TRANSITIONS.get(from);
  if (!targets || !targets.includes(to)) {
    throw actionError(
      E_ACTION_STATE_MISMATCH,
      `Invalid durable action transition ${String(from)} -> ${String(to)}`,
    );
  }
  return to;
}

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw actionError(E_ACTION_INVALID, `${label} must be one of ${allowed.join(", ")}`);
  }
}

function assertBoundedText(value, label, maxLength, { required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw actionError(E_ACTION_INVALID, `${label} is required`);
    return;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw actionError(E_ACTION_INVALID, `${label} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw actionError(E_ACTION_INVALID, `${label} must not exceed ${maxLength} characters`);
  }
}

function assertTimestamp(value, label, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw actionError(E_ACTION_INVALID, `${label} is required`);
    return;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw actionError(E_ACTION_INVALID, `${label} must be an ISO timestamp string`);
  }
}

export function validateActionArtifact(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw actionError(E_ACTION_INVALID, "durable action artifact must be a JSON object");
  }

  for (const key of [
    "schemaVersion",
    "taskId",
    "actionId",
    "actionFingerprint",
    "effectClass",
    "capability",
    "operation",
    "target",
    "idempotencyKey",
    "requiredForCompletion",
    "requirement",
    "provenance",
    "state",
    "revision",
    "createdAt",
    "updatedAt",
  ]) {
    if (!Object.prototype.hasOwnProperty.call(action, key)) {
      throw actionError(E_ACTION_INVALID, `durable action artifact.${key} is required`);
    }
  }

  if (action.schemaVersion !== 1) {
    throw actionError(E_ACTION_INVALID, "durable action schemaVersion must be 1");
  }
  assertBoundedText(action.taskId, "taskId", 256);
  assertBoundedText(action.actionId, "actionId", 256);
  if (!ACTION_ID_REGEX.test(action.actionId)) {
    throw actionError(E_ACTION_INVALID, "actionId must match action-[A-Za-z0-9_-]+");
  }
  if (typeof action.actionFingerprint !== "string" || !SHA256_HEX_REGEX.test(action.actionFingerprint)) {
    throw actionError(E_ACTION_INVALID, "actionFingerprint must be a lowercase sha256 hex digest");
  }
  assertEnum(action.effectClass, ACTION_EFFECT_CLASSES, "effectClass");
  assertEnum(action.capability, ACTION_CAPABILITIES, "capability");
  assertBoundedText(action.operation, "operation", 512);
  assertBoundedText(action.target, "target", 512);

  if (actionRequiresIdempotency(action.effectClass)) {
    assertBoundedText(action.idempotencyKey, "idempotencyKey", 512);
  } else if (action.idempotencyKey !== null && action.idempotencyKey !== undefined) {
    assertBoundedText(action.idempotencyKey, "idempotencyKey", 512);
  }

  if (typeof action.requiredForCompletion !== "boolean") {
    throw actionError(E_ACTION_INVALID, "requiredForCompletion must be a boolean");
  }
  assertBoundedText(action.requirement, "requirement", 256, { required: false });
  assertEnum(action.provenance, ACTION_PROVENANCE, "provenance");
  assertEnum(action.state, ACTION_STATES, "state");

  if (action.state !== "PROPOSED" && !Number.isInteger(action.revision)) {
    throw actionError(E_ACTION_INVALID, "revision must be an integer");
  }

  assertTimestamp(action.createdAt, "createdAt", { required: true });
  assertTimestamp(action.updatedAt, "updatedAt", { required: true });

  const allowedKeys = new Set([
    "schemaVersion",
    "taskId",
    "actionId",
    "actionFingerprint",
    "effectClass",
    "capability",
    "operation",
    "target",
    "idempotencyKey",
    "requiredForCompletion",
    "requirement",
    "provenance",
    "state",
    "revision",
    "createdAt",
    "updatedAt",
    "lastEvidenceRef",
    "lastReconciliationAt",
    "commitResultCode",
  ]);
  for (const key of Object.keys(action)) {
    if (!allowedKeys.has(key)) {
      throw actionError(E_ACTION_INVALID, `durable action artifact.${key} is not an allowed property`);
    }
  }

  const recomputed = canonicalActionFingerprint(action);
  if (recomputed !== action.actionFingerprint) {
    throw actionError(
      E_ACTION_INVALID,
      "actionFingerprint does not match the immutable identity fields",
    );
  }

  return action;
}

export function validateApprovalArtifact(approval) {
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    throw actionError(E_APPROVAL_INVALID, "approval artifact must be a JSON object");
  }

  for (const key of [
    "schemaVersion",
    "taskId",
    "approvalId",
    "actionId",
    "actionFingerprint",
    "contractFingerprint",
    "taskRevision",
    "capability",
    "status",
    "requestedAt",
  ]) {
    if (!Object.prototype.hasOwnProperty.call(approval, key)) {
      throw actionError(E_APPROVAL_INVALID, `approval artifact.${key} is required`);
    }
  }

  if (approval.schemaVersion !== 1) {
    throw actionError(E_APPROVAL_INVALID, "approval schemaVersion must be 1");
  }
  assertBoundedText(approval.taskId, "taskId", 256);
  assertBoundedText(approval.approvalId, "approvalId", 256);
  if (!APPROVAL_ID_REGEX.test(approval.approvalId)) {
    throw actionError(E_APPROVAL_INVALID, "approvalId must match approval-[A-Za-z0-9_-]+");
  }
  assertBoundedText(approval.actionId, "actionId", 256);
  if (typeof approval.actionFingerprint !== "string" || !SHA256_HEX_REGEX.test(approval.actionFingerprint)) {
    throw actionError(E_APPROVAL_INVALID, "actionFingerprint must be a lowercase sha256 hex digest");
  }
  if (
    typeof approval.contractFingerprint !== "string" ||
    !SHA256_HEX_REGEX.test(approval.contractFingerprint)
  ) {
    throw actionError(E_APPROVAL_INVALID, "contractFingerprint must be a lowercase sha256 hex digest");
  }
  if (!Number.isInteger(approval.taskRevision) || approval.taskRevision < 0) {
    throw actionError(E_APPROVAL_INVALID, "taskRevision must be a non-negative integer");
  }
  assertEnum(approval.capability, ACTION_CAPABILITIES, "capability");
  assertEnum(approval.status, APPROVAL_STATUSES, "status");
  assertTimestamp(approval.requestedAt, "requestedAt", { required: true });

  if (approval.status !== "PENDING") {
    assertEnum(approval.decision, [approval.status], "decision");
    assertTimestamp(approval.resolvedAt, "resolvedAt", { required: true });
    assertEnum(approval.authorityKind, APPROVAL_AUTHORITY_KINDS, "authorityKind");
    if (approval.authorityKind === "HOST_ATTESTED" && !approval.hostGrantRef) {
      throw actionError(
        E_APPROVAL_INVALID,
        "HOST_ATTESTED approvals require a hostGrantRef supplied by the host boundary",
      );
    }
  }

  const allowedKeys = new Set([
    "schemaVersion",
    "taskId",
    "approvalId",
    "actionId",
    "actionFingerprint",
    "contractFingerprint",
    "taskRevision",
    "capability",
    "status",
    "requestedAt",
    "reason",
    "decision",
    "resolvedAt",
    "authorityKind",
    "hostGrantRef",
  ]);
  for (const key of Object.keys(approval)) {
    if (!allowedKeys.has(key)) {
      throw actionError(E_APPROVAL_INVALID, `approval artifact.${key} is not an allowed property`);
    }
  }
  assertBoundedText(approval.reason, "reason", 512, { required: false });

  return approval;
}

export function validateCapabilityPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw actionError(E_POLICY_INVALID, "capability policy must be a JSON object");
  }
  if (policy.schemaVersion !== 1) {
    throw actionError(E_POLICY_INVALID, "capability policy schemaVersion must be 1");
  }
  if (!["ALLOW", "DENY"].includes(policy.defaultDecision)) {
    throw actionError(
      E_POLICY_INVALID,
      "defaultDecision must be ALLOW or DENY; REQUIRE_* defaults are not valid",
    );
  }
  if (!Array.isArray(policy.rules)) {
    throw actionError(E_POLICY_INVALID, "rules must be an array");
  }
  const seen = new Set();
  for (const rule of policy.rules) {
    if (!rule || typeof rule !== "object") {
      throw actionError(E_POLICY_INVALID, "each rule must be a JSON object");
    }
    assertEnum(rule.capability, ACTION_CAPABILITIES, "rule.capability");
    assertEnum(rule.decision, CAPABILITY_DECISIONS, "rule.decision");
    if (seen.has(rule.capability)) {
      throw actionError(
        E_POLICY_INVALID,
        `duplicate rule for capability ${rule.capability}`,
      );
    }
    seen.add(rule.capability);
  }
  const allowedKeys = new Set(["schemaVersion", "defaultDecision", "rules"]);
  for (const key of Object.keys(policy)) {
    if (!allowedKeys.has(key)) {
      throw actionError(E_POLICY_INVALID, `capability policy.${key} is not an allowed property`);
    }
  }
  return policy;
}

export function assertActionIdFormat(actionId) {
  if (typeof actionId !== "string" || !ACTION_ID_REGEX.test(actionId)) {
    throw actionError(E_ACTION_INVALID, "actionId must match action-[A-Za-z0-9_-]+");
  }
  return actionId;
}

export function assertApprovalIdFormat(approvalId) {
  if (typeof approvalId !== "string" || !APPROVAL_ID_REGEX.test(approvalId)) {
    throw actionError(E_APPROVAL_INVALID, "approvalId must match approval-[A-Za-z0-9_-]+");
  }
  return approvalId;
}

export function assertEvaluationIdFormat(evaluationId) {
  if (typeof evaluationId !== "string" || !EVAL_ID_REGEX.test(evaluationId)) {
    throw actionError(E_TRAJECTORY_SCENARIO_INVALID, "evaluationId must match eval-[A-Za-z0-9_-]+");
  }
  return evaluationId;
}

const ACTION_EVENT_NAMES = new Set([
  "ACTION_PROPOSED",
  "ACTION_AUTHORIZED",
  "ACTION_STARTED",
  "ACTION_COMMIT_RECORDED",
  "ACTION_VERIFIED",
  "ACTION_FAILED",
  "ACTION_COMMIT_UNKNOWN",
  "ACTION_RECONCILED",
  "ACTION_CANCELLED",
]);

const APPROVAL_EVENT_NAMES = new Set(["APPROVAL_REQUESTED", "APPROVAL_RESOLVED"]);

function assertBoundedEventText(details, key, maxLength, { required = true } = {}) {
  const value = details[key];
  if (value === undefined || value === null) {
    if (required) throw actionError(E_ACTION_EVIDENCE_INVALID, `event details.${key} is required`);
    return;
  }
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw actionError(
      E_ACTION_EVIDENCE_INVALID,
      `event details.${key} must be a non-empty string of at most ${maxLength} characters`,
    );
  }
}

export function assertActionEventDetails(event) {
  const details = event.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    throw actionError(E_ACTION_EVIDENCE_INVALID, `${event.event} requires structured details`);
  }
  assertBoundedEventText(details, "actionId", 256);
  if (
    typeof details.actionFingerprint !== "string" ||
    !SHA256_HEX_REGEX.test(details.actionFingerprint)
  ) {
    throw actionError(
      E_ACTION_EVIDENCE_INVALID,
      `${event.event} details.actionFingerprint must be a lowercase sha256 hex digest`,
    );
  }
  if (event.fingerprint && event.fingerprint !== details.actionFingerprint) {
    throw actionError(
      E_ACTION_EVIDENCE_INVALID,
      `${event.event} fingerprint does not match details.actionFingerprint`,
    );
  }
  if (event.event === "ACTION_RECONCILED") {
    if (!["COMMITTED", "NOT_COMMITTED", "UNKNOWN"].includes(details.outcome)) {
      throw actionError(
        E_ACTION_EVIDENCE_INVALID,
        "ACTION_RECONCILED details.outcome must be COMMITTED, NOT_COMMITTED, or UNKNOWN",
      );
    }
  }
  return true;
}

export function assertApprovalEventDetails(event) {
  const details = event.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    throw actionError(E_APPROVAL_INVALID, `${event.event} requires structured details`);
  }
  assertBoundedEventText(details, "approvalId", 256);
  assertBoundedEventText(details, "actionId", 256);
  if (
    typeof details.actionFingerprint !== "string" ||
    !SHA256_HEX_REGEX.test(details.actionFingerprint)
  ) {
    throw actionError(
      E_APPROVAL_INVALID,
      `${event.event} details.actionFingerprint must be a lowercase sha256 hex digest`,
    );
  }
  if (event.event === "APPROVAL_RESOLVED") {
    if (!["APPROVED", "REJECTED"].includes(details.decision)) {
      throw actionError(E_APPROVAL_INVALID, "APPROVAL_RESOLVED details.decision must be APPROVED or REJECTED");
    }
    if (!APPROVAL_AUTHORITY_KINDS.includes(details.authorityKind)) {
      throw actionError(E_APPROVAL_INVALID, "APPROVAL_RESOLVED details.authorityKind is invalid");
    }
    if (details.authorityKind === "HOST_ATTESTED" && !details.hostGrantRef) {
      throw actionError(
        E_APPROVAL_INVALID,
        "HOST_ATTESTED approval resolution requires details.hostGrantRef",
      );
    }
  }
  return true;
}

export function isActionEventName(eventName) {
  return ACTION_EVENT_NAMES.has(eventName);
}

export function isApprovalEventName(eventName) {
  return APPROVAL_EVENT_NAMES.has(eventName);
}

export { E_ACTION_IDEMPOTENCY_CONFLICT, E_ACTION_IDEMPOTENCY_REQUIRED };

