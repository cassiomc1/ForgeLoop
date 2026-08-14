export const EVIDENCE_KINDS = Object.freeze([
  "OBSERVED",
  "INFERRED",
  "NOT_VERIFIED",
  "BLOCKED",
]);

export class EvidenceError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvidenceError";
    this.code = "EVIDENCE_INVALID";
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new EvidenceError(`${label} must be a non-empty string`);
  }
}

export function createEvidence(input, source, result, details, cycle) {
  const value = typeof input === "string"
    ? {
        kind: input,
        source,
        result,
        ...(cycle !== undefined ? { verificationCycle: cycle } : {}),
        details: {
          ...(details === undefined ? {} : details),
          ...(cycle !== undefined ? { verificationCycle: cycle } : {}),
        },
      }
    : structuredClone(input);
  if (value.details && typeof value.details === "object" && value.verificationCycle !== undefined) {
    value.details.verificationCycle = value.verificationCycle;
  }
  assertEvidence(value);
  return value;
}

export function assertEvidence(value, label = "evidence") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EvidenceError(`${label} must be an object`);
  }
  if (!EVIDENCE_KINDS.includes(value.kind)) {
    throw new EvidenceError(`${label}.kind must be one of ${EVIDENCE_KINDS.join(", ")}`);
  }
  assertNonEmptyString(value.source, `${label}.source`);
  assertNonEmptyString(value.result, `${label}.result`);
  if (value.verificationCycle !== undefined && (!Number.isInteger(value.verificationCycle) || value.verificationCycle < 1)) {
    throw new EvidenceError(`${label}.verificationCycle must be a positive integer`);
  }
  return value;
}

export function assertEvidenceList(value, label = "evidence") {
  if (!Array.isArray(value)) throw new EvidenceError(`${label} must be an array`);
  value.forEach((item, index) => assertEvidence(item, `${label}[${index}]`));
  return value;
}

export function evidenceMatches(evidence, terms) {
  const normalizedTerms = (Array.isArray(terms) ? terms : [terms])
    .filter((term) => typeof term === "string" && term.length > 0)
    .map((term) => term.toLowerCase());
  return (evidence ?? []).some((item) => {
    const detailsText = item.details
      ? `${item.details.requirementText ?? ""} ${String(item.details.terminalType ?? "").replace(/_/g, " ")}`
      : "";
    const haystack = `${item.source} ${item.result} ${detailsText}`.toLowerCase();
    return normalizedTerms.some((term) => haystack.includes(term));
  });
}
