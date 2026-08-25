export const ACTION_EFFECT_CLASSES = Object.freeze([
  "READ_ONLY",
  "REVERSIBLE_WRITE",
  "IRREVERSIBLE_WRITE",
  "EXTERNAL_PUBLICATION",
  "DESTRUCTIVE",
]);

export const ACTION_STATES = Object.freeze([
  "PROPOSED",
  "AUTHORIZED",
  "STARTED",
  "COMMITTED",
  "VERIFIED",
  "FAILED",
  "COMMIT_UNKNOWN",
  "CANCELLED",
]);

export const ACTION_PROVENANCE = Object.freeze([
  "FORGELOOP_EXECUTED",
  "HOST_ATTESTED",
  "CALLER_REPORTED",
  // Retained for backward compatibility with v1.6.0 artifacts. Public CLI
  // surfaces no longer mint this provenance because caller input is not host
  // authority.
  "HOST_REPORTED",
  "EXTERNAL_OBSERVED",
]);

export const TRUSTED_ACTION_PROVENANCE = Object.freeze([
  "FORGELOOP_EXECUTED",
  "HOST_ATTESTED",
]);

export const ACTION_CAPABILITIES = Object.freeze([
  "filesystem.read",
  "filesystem.write",
  "process.execute",
  "dependency.install",
  "network.read",
  "network.write",
  "repository.commit",
  "repository.push",
  "repository.pull_request",
  "external.publish",
  "external.delete",
  "deployment.execute",
]);

export const CAPABILITY_DECISIONS = Object.freeze([
  "ALLOW",
  "DENY",
  "REQUIRE_AUTHORITY",
  "REQUIRE_APPROVAL",
]);

export const APPROVAL_STATUSES = Object.freeze(["PENDING", "APPROVED", "REJECTED"]);

export const APPROVAL_DECISIONS = Object.freeze(["APPROVED", "REJECTED"]);

export const APPROVAL_AUTHORITY_KINDS = Object.freeze(["CALLER_ACKNOWLEDGED", "HOST_ATTESTED"]);

export const RECONCILIATION_OUTCOMES = Object.freeze([
  "COMMITTED",
  "NOT_COMMITTED",
  "UNKNOWN",
]);

export const SIDE_EFFECTING_EFFECT_CLASSES = Object.freeze(
  ACTION_EFFECT_CLASSES.filter((effectClass) => effectClass !== "READ_ONLY"),
);

// States whose semantics are security-relevant: entering them must be owned
// by a canonical core service, never by a generic caller-controlled surface.
export const ACTION_SECURITY_SENSITIVE_STATES = Object.freeze([
  "AUTHORIZED",
  "VERIFIED",
]);

export const COMMIT_UNKNOWN_RESULT_CODES = Object.freeze([
  "IDEMPOTENCY_PROTECTED",
  "RECONCILED_COMMITTED",
  "RECONCILED_NOT_COMMITTED",
  "AMBIGUOUS",
]);
