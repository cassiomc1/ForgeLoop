import { PROTOCOL_VERSION } from "./protocol.js";

export const COVERAGE_SCHEMA_VERSION = 1;
export const COVERAGE_STATUSES = Object.freeze(["COVERED", "PARTIAL", "NOT_VERIFIED", "BLOCKED"]);

function coverageError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label} must be an array of non-empty strings`);
  }
  return [...new Set(value)];
}

export function evaluateCoverage(requiredEvidence, observedEvidence, { blocked = false } = {}) {
  const required = stringArray(requiredEvidence, "requiredEvidence");
  const observed = stringArray(observedEvidence, "observedEvidence");
  if (blocked) return "BLOCKED";
  if (required.length === 0 || required.every((item) => observed.includes(item))) return "COVERED";
  if (required.some((item) => observed.includes(item))) return "PARTIAL";
  return "NOT_VERIFIED";
}

export function createCoverage(input = {}) {
  const requiredEvidence = stringArray(input.requiredEvidence ?? [], "requiredEvidence");
  const observedEvidence = stringArray(input.observedEvidence ?? [], "observedEvidence");
  const status = input.status ?? evaluateCoverage(requiredEvidence, observedEvidence, { blocked: input.blocked === true });
  const value = {
    schemaVersion: COVERAGE_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    requirement: input.requirement,
    requiredEvidence,
    observedEvidence,
    status,
    ...(input.details !== undefined ? { details: structuredClone(input.details) } : {}),
  };
  return assertCoverage(value);
}

export function assertCoverage(value, label = "evidence coverage") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label} must be an object`);
  }
  if (value.schemaVersion !== COVERAGE_SCHEMA_VERSION || value.protocolVersion !== PROTOCOL_VERSION) {
    throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label} has an unsupported protocol version`);
  }
  if (typeof value.requirement !== "string" || value.requirement.trim() === "") {
    throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label}.requirement is required`);
  }
  const requiredEvidence = stringArray(value.requiredEvidence, `${label}.requiredEvidence`);
  const observedEvidence = stringArray(value.observedEvidence, `${label}.observedEvidence`);
  if (!COVERAGE_STATUSES.includes(value.status)) {
    throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label}.status is invalid`);
  }
  const expected = evaluateCoverage(requiredEvidence, observedEvidence, {
    blocked: value.status === "BLOCKED",
  });
  if (value.status !== expected && !(value.status === "BLOCKED" && expected === "BLOCKED")) {
    throw coverageError("E_EVIDENCE_COVERAGE_PARTIAL", `${label}.status does not match its observed evidence`);
  }
  return value;
}

export function assertCoverageList(value, label = "evidenceCoverage") {
  if (!Array.isArray(value)) throw coverageError("E_EVIDENCE_COVERAGE_INVALID", `${label} must be an array`);
  value.forEach((item, index) => assertCoverage(item, `${label}[${index}]`));
  return value;
}

export function coverageForRequirements(requirements, checks, { blockedIds = [] } = {}) {
  const normalizedRequirements = stringArray(requirements ?? [], "requirements");
  const normalizedChecks = Array.isArray(checks) ? checks : [];
  const observed = new Set(
    normalizedChecks
      .filter((check) => check?.status === "passed" && check.evidenceKind === "OBSERVED")
      .flatMap((check) => [check.id, check.kind, check.requirement]),
  );
  const blocked = new Set(blockedIds);
  return normalizedRequirements.map((requirement) => createCoverage({
    requirement,
    requiredEvidence: [requirement],
    observedEvidence: observed.has(requirement) ? [requirement] : [],
    blocked: blocked.has(requirement),
  }));
}
