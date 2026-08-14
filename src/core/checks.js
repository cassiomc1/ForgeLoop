import { PROTOCOL_VERSION } from "./protocol.js";
import { validateVerificationAuthority } from "./verification-capability.js";

export const CHECK_SCHEMA_VERSION = 1;
export const CHECK_STATUSES = Object.freeze(["passed", "failed", "blocked", "not-run"]);
export const CHECK_EVIDENCE_KINDS = Object.freeze(["OBSERVED", "INFERRED", "NOT_VERIFIED", "BLOCKED"]);

function checkError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

function string(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw checkError("E_CHECK_INVALID", `${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value, label) {
  if (value !== undefined) string(value, label);
}

function contradiction(message) {
  return checkError("E_CHECK_STATUS_CONTRADICTION", message);
}

function assertCompoundStatus(value, label) {
  const components = value.details?.components;
  if (!Array.isArray(components)) return;
  for (const [index, component] of components.entries()) {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      throw checkError("E_CHECK_INVALID", `${label}.details.components[${index}] must be an object`);
    }
    string(component.requirementId ?? component.requirement, `${label}.details.components[${index}].requirementId`);
    if (!CHECK_STATUSES.includes(component.status) || !CHECK_EVIDENCE_KINDS.includes(component.evidenceKind)) {
      throw checkError("E_CHECK_INVALID", `${label}.details.components[${index}] has invalid status or evidenceKind`);
    }
  }
  if (value.status === "passed" && components.some((component) => (
    component.status !== "passed" || component.evidenceKind !== "OBSERVED"
  ))) {
    throw contradiction(`${label} passed cannot contain an unverified, partial, blocked, or failed component`);
  }
}

export function createCheck(input = {}) {
  const check = {
    schemaVersion: CHECK_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    id: input.id,
    kind: input.kind,
    requirement: input.requirement,
    status: input.status ?? "not-run",
    evidenceKind: input.evidenceKind ?? "NOT_VERIFIED",
    source: input.source,
    ...(input.exitCode !== undefined ? { exitCode: input.exitCode } : {}),
    ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
    ...(input.repositoryFingerprint !== undefined ? { repositoryFingerprint: input.repositoryFingerprint } : {}),
    ...(input.viewport !== undefined ? { viewport: structuredClone(input.viewport) } : {}),
    ...(input.details !== undefined ? { details: structuredClone(input.details) } : {}),
  };
  return assertCheck(check);
}

export function assertCheck(value, label = "check") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw checkError("E_CHECK_INVALID", `${label} must be an object`);
  }
  if (value.schemaVersion !== CHECK_SCHEMA_VERSION || value.protocolVersion !== PROTOCOL_VERSION) {
    throw checkError("E_CHECK_INVALID", `${label} has an unsupported protocol version`);
  }
  string(value.id, `${label}.id`);
  string(value.kind, `${label}.kind`);
  string(value.requirement, `${label}.requirement`);
  string(value.source, `${label}.source`);
  if (!CHECK_STATUSES.includes(value.status)) {
    throw checkError("E_CHECK_INVALID", `${label}.status must be one of ${CHECK_STATUSES.join(", ")}`);
  }
  if (!CHECK_EVIDENCE_KINDS.includes(value.evidenceKind)) {
    throw checkError("E_EVIDENCE_KIND_INVALID", `${label}.evidenceKind must be one of ${CHECK_EVIDENCE_KINDS.join(", ")}`);
  }
  if (value.exitCode !== undefined && (!Number.isInteger(value.exitCode) || value.exitCode < 0)) {
    throw checkError("E_CHECK_INVALID", `${label}.exitCode must be a non-negative integer`);
  }
  optionalString(value.timestamp, `${label}.timestamp`);
  if (value.status === "passed" && ["NOT_VERIFIED", "BLOCKED"].includes(value.evidenceKind)) {
    throw contradiction(`${label} passed cannot use ${value.evidenceKind} evidence`);
  }
  if (value.status === "passed" && value.exitCode !== undefined && value.exitCode !== 0) {
    throw contradiction(`${label} passed requires exitCode 0 when exitCode is recorded`);
  }
  if (value.status === "blocked" && value.evidenceKind !== "BLOCKED") {
    throw contradiction(`${label} blocked must use BLOCKED evidence`);
  }
  if (value.status === "not-run" && value.evidenceKind !== "NOT_VERIFIED") {
    throw contradiction(`${label} not-run must use NOT_VERIFIED evidence`);
  }
  if (value.status === "passed") {
    const auth = validateVerificationAuthority(value);
    if (!auth.valid) {
      throw checkError(auth.error.code, auth.error.message);
    }
  }
  assertCompoundStatus(value, label);
  return value;
}

export function assertCheckList(value, label = "checks") {
  if (!Array.isArray(value)) throw checkError("E_CHECK_INVALID", `${label} must be an array`);
  const ids = new Set();
  value.forEach((item, index) => {
    assertCheck(item, `${label}[${index}]`);
    if (ids.has(item.id)) throw checkError("E_CHECK_INVALID", `${label} contains duplicate id ${item.id}`);
    ids.add(item.id);
  });
  return value;
}

function requiredChecksSatisfiedBy(checks, requiredValues, selector, { allowInferred = false } = {}) {
  assertCheckList(checks);
  if (!Array.isArray(requiredValues)) throw checkError("E_CHECK_INVALID", "required values must be an array");
  const errors = [];
  for (const value of requiredValues) {
    const candidates = checks.filter((check) => selector(check) === value);
    const check = candidates.find((candidate) => candidate.status === "passed"
      && (allowInferred || candidate.evidenceKind === "OBSERVED"))
      ?? candidates.find((candidate) => candidate.status === "passed")
      ?? candidates[0];
    if (!check) {
      errors.push(checkError("E_EVIDENCE_REQUIRED", `Required check is missing: ${value}`, [value]));
      continue;
    }
    if (check.status !== "passed") {
      errors.push(checkError("E_EVIDENCE_REQUIRED", `Required check is not passed: ${value}`, [value]));
      continue;
    }
    if (!allowInferred && check.evidenceKind !== "OBSERVED") {
      errors.push(checkError("E_EVIDENCE_KIND_INVALID", `Required check must be observed: ${value}`, [value]));
    }
  }
  return errors;
}

export function requiredChecksSatisfied(checks, requiredIds, options = {}) {
  return requiredChecksSatisfiedBy(checks, requiredIds, (check) => check.id, options);
}

export function requiredChecksSatisfiedForRequirements(checks, requiredRequirements, options = {}) {
  return requiredChecksSatisfiedBy(checks, requiredRequirements, (check) => check.requirement, options);
}
