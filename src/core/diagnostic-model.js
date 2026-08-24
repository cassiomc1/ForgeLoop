import { canonicalFingerprint } from "./artifacts.js";
import { assertFailureClass } from "./protocol.js";

export const DIAGNOSTIC_SCHEMA_VERSION = 1;

const LIMITS = Object.freeze({
  observationsPerCase: 64,
  contributorsPerCase: 64,
  hypothesesPerCase: 32,
  evidenceRefsPerHypothesis: 32,
  contributorRefsPerHypothesis: 32,
  statementLength: 4096,
  reasonLength: 4096,
  idLength: 128,
});

export const DIAGNOSTIC_LIMITS = LIMITS;

export const OBSERVATION_KINDS = Object.freeze([
  "CHECK_RESULT",
  "EXECUTION_RESULT",
  "REPOSITORY_STATE",
  "ENVIRONMENT_STATE",
  "DEPENDENCY_STATE",
  "MANUAL_OBSERVATION",
  "PROTOCOL_STATE",
]);

export const OBSERVATION_PROVENANCE = Object.freeze([
  "FORGELOOP_EXECUTED",
  "ACTOR_REPORTED",
  "MANUAL_OBSERVATION",
]);

export const CONTRIBUTOR_TYPES = Object.freeze([
  "CODE",
  "CONFIGURATION",
  "ARCHITECTURE",
  "DEPENDENCY",
  "ENVIRONMENT",
  "DATA",
  "TIMING",
  "CONCURRENCY",
  "STATE",
  "AUTHORITY",
  "CAPABILITY",
  "ASSUMPTION",
  "INTERFACE",
  "PROCESS",
  "EXTERNAL_SERVICE",
  "UNKNOWN",
]);

export const CONTRIBUTOR_STATUSES = Object.freeze([
  "OBSERVED",
  "INFERRED",
  "SUSPECTED",
  "ELIMINATED",
  "CONFIRMED_RELEVANT",
]);

export const HYPOTHESIS_STATUSES = Object.freeze([
  "OPEN",
  "SUPPORTED",
  "WEAKENED",
  "FALSIFIED",
  "SUPERSEDED",
  "UNRESOLVED",
]);

export const SETTLEMENT_TYPES = Object.freeze([
  "PREDICATE",
  "CHECK_STATUS",
  "FAILURE_SIGNATURE_CHANGE",
  "REQUIREMENT_STATUS",
  "MANUAL_OBSERVATION",
]);

export const INTERVENTION_KINDS = Object.freeze([
  "CODE_CHANGE",
  "CONFIG_CHANGE",
  "TEST_CHANGE",
  "FIXTURE_CHANGE",
  "ENVIRONMENT_CHANGE",
  "DEPENDENCY_CHANGE",
  "ROLLBACK",
  "ISOLATION",
  "INSTRUMENTATION",
  "NO_MUTATION_EXPERIMENT",
  "OTHER",
]);

export const DISPOSITION_TRANSITIONS = Object.freeze({
  OPEN: ["SUPPORTED", "WEAKENED", "FALSIFIED", "SUPERSEDED", "UNRESOLVED"],
  SUPPORTED: ["WEAKENED", "FALSIFIED", "SUPERSEDED"],
  WEAKENED: ["SUPPORTED", "FALSIFIED", "SUPERSEDED"],
});

function invalid(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function assertDiagnosticId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `${label} must match ^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`);
  }
  return value;
}

function assertBoundedText(value, label, maxLength, code = "E_DIAGNOSTIC_CASE_INVALID") {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    invalid(code, `${label} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value;
}

function assertStringRefArray(value, label, maxItems, missingCode) {
  if (!Array.isArray(value)) invalid(missingCode ?? "E_DIAGNOSTIC_CASE_INVALID", `${label} must be an array`);
  if (value.length > maxItems) invalid("E_DIAGNOSTIC_CASE_INVALID", `${label} exceeds limit of ${maxItems}`);
  for (const ref of value) {
    if (typeof ref !== "string" || !ref.trim()) {
      invalid(missingCode ?? "E_DIAGNOSTIC_CASE_INVALID", `each ${label} entry must be a non-empty string`);
    }
  }
  return [...new Set(value.map((ref) => ref.trim()))];
}

export function normalizeDiagnosticText(value) {
  return String(value).trim().replace(/\s+/gu, " ").toLowerCase();
}

export function canonicalizeDiagnosticValue(value) {
  if (Array.isArray(value)) return [...new Set(value.map(canonicalizeDiagnosticValue))].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id" && key !== "createdAt")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalizeDiagnosticValue(child)]),
    );
  }
  if (typeof value === "string") return normalizeDiagnosticText(value);
  return value;
}

export function diagnosticSemanticFingerprint({ verificationCycle, failureClass, case_ }) {
  return canonicalFingerprint({
    verificationCycle,
    failureClass,
    observations: [...case_.observations]
      .map(({ kind, evidenceRef, statement, provenance }) => canonicalizeDiagnosticValue({ kind, evidenceRef, statement, provenance }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    contributors: [...case_.contributors]
      .map(({ type, statement, basis, status }) => canonicalizeDiagnosticValue({ type, statement, basis, status }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    hypotheses: [...case_.hypotheses]
      .map(({ statement, contributorRefs, evidenceRefs, settledBy }) => canonicalizeDiagnosticValue({ statement, contributorRefs, evidenceRefs, settledBy }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    nextSafeAction: canonicalizeDiagnosticValue(case_.nextSafeAction?.statement ?? null),
  });
}

export function assertObservation(observation, label = "observation") {
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    invalid("E_OBSERVATION_INVALID", `${label} must be an object`);
  }
  assertDiagnosticId(observation.id, `${label}.id`);
  if (!OBSERVATION_KINDS.includes(observation.kind)) {
    invalid("E_OBSERVATION_INVALID", `${label}.kind must be one of ${OBSERVATION_KINDS.join(", ")}`);
  }
  assertBoundedText(observation.statement, `${label}.statement`, LIMITS.statementLength);
  if (observation.evidenceRef !== undefined && observation.evidenceRef !== null) {
    assertDiagnosticId(observation.evidenceRef, `${label}.evidenceRef`);
  }
  if (observation.provenance !== undefined && observation.provenance !== null
    && !OBSERVATION_PROVENANCE.includes(observation.provenance)) {
    invalid("E_OBSERVATION_INVALID", `${label}.provenance must be one of ${OBSERVATION_PROVENANCE.join(", ")}`);
  }
  return observation;
}

export function assertContributor(contributor, label = "contributor") {
  if (!contributor || typeof contributor !== "object" || Array.isArray(contributor)) {
    invalid("E_CONTRIBUTOR_INVALID", `${label} must be an object`);
  }
  assertDiagnosticId(contributor.id, `${label}.id`);
  if (!CONTRIBUTOR_TYPES.includes(contributor.type)) {
    invalid("E_CONTRIBUTOR_INVALID", `${label}.type must be one of ${CONTRIBUTOR_TYPES.join(", ")}`);
  }
  assertBoundedText(contributor.statement, `${label}.statement`, LIMITS.statementLength, "E_CONTRIBUTOR_INVALID");
  assertStringRefArray(contributor.basis ?? [], `${label}.basis`, LIMITS.evidenceRefsPerHypothesis);
  if (contributor.status !== undefined && !CONTRIBUTOR_STATUSES.includes(contributor.status)) {
    invalid("E_CONTRIBUTOR_INVALID", `${label}.status must be one of ${CONTRIBUTOR_STATUSES.join(", ")}`);
  }
  return contributor;
}

export function assertSettlement(settledBy, label = "settledBy") {
  if (!settledBy || typeof settledBy !== "object" || Array.isArray(settledBy)) {
    invalid("E_HYPOTHESIS_SETTLEMENT_MISSING", `${label} must be an object`);
  }
  if (!SETTLEMENT_TYPES.includes(settledBy.type)) {
    invalid("E_HYPOTHESIS_SETTLEMENT_MISSING", `${label}.type must be one of ${SETTLEMENT_TYPES.join(", ")}`);
  }
  if (settledBy.type === "CHECK_STATUS") {
    assertDiagnosticId(settledBy.checkId, `${label}.checkId`);
    if (typeof settledBy.expectedStatus !== "string" || !settledBy.expectedStatus) {
      invalid("E_HYPOTHESIS_SETTLEMENT_MISSING", `${label}.expectedStatus is required for CHECK_STATUS settlement`);
    }
    return settledBy;
  }
  assertBoundedText(settledBy.statement, `${label}.statement`, LIMITS.statementLength, "E_HYPOTHESIS_SETTLEMENT_MISSING");
  return settledBy;
}

export function assertHypothesis(hypothesis, label = "hypothesis") {
  if (!hypothesis || typeof hypothesis !== "object" || Array.isArray(hypothesis)) {
    invalid("E_HYPOTHESIS_INVALID", `${label} must be an object`);
  }
  assertDiagnosticId(hypothesis.id, `${label}.id`);
  assertBoundedText(hypothesis.statement, `${label}.statement`, LIMITS.statementLength, "E_HYPOTHESIS_INVALID");
  assertStringRefArray(
    hypothesis.contributorRefs ?? [],
    `${label}.contributorRefs`,
    LIMITS.contributorRefsPerHypothesis,
    "E_CONTRIBUTOR_REFERENCE_INVALID",
  );
  assertStringRefArray(
    hypothesis.evidenceRefs ?? [],
    `${label}.evidenceRefs`,
    LIMITS.evidenceRefsPerHypothesis,
    "E_DIAGNOSTIC_CASE_EVIDENCE_INVALID",
  );
  assertSettlement(hypothesis.settledBy, `${label}.settledBy`);
  if (hypothesis.status !== undefined && hypothesis.status !== "OPEN") {
    invalid("E_HYPOTHESIS_INVALID", `${label}.status must be OPEN when recorded in a case`);
  }
  return hypothesis;
}

export function assertDiagnosticCaseDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "Diagnostic case details must be an object");
  }
  if (details.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `diagnostic case schemaVersion must be ${DIAGNOSTIC_SCHEMA_VERSION}`);
  }
  if (!Number.isInteger(details.verificationCycle) || details.verificationCycle < 1) {
    invalid("E_DIAGNOSTIC_CASE_CYCLE_MISMATCH", "verificationCycle must be an integer >= 1");
  }
  if (!Number.isInteger(details.diagnosticRevision) || details.diagnosticRevision < 1) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "diagnosticRevision must be an integer >= 1");
  }
  try {
    assertFailureClass(details.failureClass);
  } catch {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `invalid failureClass: ${details.failureClass}`);
  }

  if (!Array.isArray(details.observations) || details.observations.length > LIMITS.observationsPerCase) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `observations must be an array of at most ${LIMITS.observationsPerCase}`);
  }
  details.observations.forEach((observation, index) => assertObservation(observation, `observations[${index}]`));

  if (!Array.isArray(details.contributors) || details.contributors.length > LIMITS.contributorsPerCase) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `contributors must be an array of at most ${LIMITS.contributorsPerCase}`);
  }
  details.contributors.forEach((contributor, index) => assertContributor(contributor, `contributors[${index}]`));

  if (!Array.isArray(details.hypotheses)
    || details.hypotheses.length < 1
    || details.hypotheses.length > LIMITS.hypothesesPerCase) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `hypotheses must contain between 1 and ${LIMITS.hypothesesPerCase} hypotheses`);
  }
  details.hypotheses.forEach((hypothesis, index) => assertHypothesis(hypothesis, `hypotheses[${index}]`));

  const ids = [
    ...details.observations.map((o) => o.id),
    ...details.contributors.map((c) => c.id),
    ...details.hypotheses.map((h) => h.id),
  ];
  if (new Set(ids).size !== ids.length) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "duplicate IDs within the same diagnostic case are not allowed");
  }
  const observationIds = new Set(details.observations.map((o) => o.id));
  const contributorIds = new Set(details.contributors.map((c) => c.id));
  for (const contributor of details.contributors) {
    for (const basis of contributor.basis ?? []) {
      if (!observationIds.has(basis)) invalid("E_CONTRIBUTOR_REFERENCE_INVALID", `contributor ${contributor.id} references unknown observation ${basis}`);
    }
  }
  for (const hypothesis of details.hypotheses) {
    for (const ref of hypothesis.contributorRefs ?? []) {
      if (!contributorIds.has(ref)) invalid("E_CONTRIBUTOR_REFERENCE_INVALID", `hypothesis ${hypothesis.id} references unknown contributor ${ref}`);
    }
  }

  if (!details.nextSafeAction || typeof details.nextSafeAction !== "object"
    || typeof details.nextSafeAction.statement !== "string" || !details.nextSafeAction.statement.trim()) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "nextSafeAction.statement must be a non-empty string");
  }
  if (details.nextSafeAction.statement.length > LIMITS.statementLength) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", `nextSafeAction.statement exceeds ${LIMITS.statementLength} characters`);
  }

  if (typeof details.diagnosticFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(details.diagnosticFingerprint)) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "diagnosticFingerprint must be a SHA-256 fingerprint");
  }
  const computed = diagnosticSemanticFingerprint({
    verificationCycle: details.verificationCycle,
    failureClass: details.failureClass,
    case_: details,
  });
  if (computed !== details.diagnosticFingerprint) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "diagnosticFingerprint does not match computed semantic fingerprint");
  }
  if (details.previousDiagnosticFingerprint !== undefined && details.previousDiagnosticFingerprint !== null
    && (typeof details.previousDiagnosticFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(details.previousDiagnosticFingerprint))) {
    invalid("E_DIAGNOSTIC_CASE_INVALID", "previousDiagnosticFingerprint must be a SHA-256 fingerprint or null");
  }
  return details;
}

export function assertInterventionDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    invalid("E_INTERVENTION_INVALID", "Intervention event details must be an object");
  }
  if (details.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION) {
    invalid("E_INTERVENTION_INVALID", `intervention schemaVersion must be ${DIAGNOSTIC_SCHEMA_VERSION}`);
  }
  if (!Number.isInteger(details.verificationCycle) || details.verificationCycle < 1) {
    invalid("E_INTERVENTION_INVALID", "intervention verificationCycle must be an integer >= 1");
  }
  const intervention = details.intervention;
  if (!intervention || typeof intervention !== "object" || Array.isArray(intervention)) {
    invalid("E_INTERVENTION_INVALID", "intervention.intervention must be an object");
  }
  assertDiagnosticId(intervention.id, "intervention.id");
  if (!INTERVENTION_KINDS.includes(intervention.kind)) {
    invalid("E_INTERVENTION_INVALID", `intervention.kind must be one of ${INTERVENTION_KINDS.join(", ")}`);
  }
  assertBoundedText(intervention.statement, "intervention.statement", LIMITS.statementLength, "E_INTERVENTION_INVALID");
  assertStringRefArray(intervention.targets ?? [], "intervention.targets", 32);
  const hypothesisRefs = assertStringRefArray(
    intervention.hypothesisRefs ?? [],
    "intervention.hypothesisRefs",
    LIMITS.hypothesesPerCase,
    "E_INTERVENTION_REFERENCE_INVALID",
  );
  if (hypothesisRefs.length === 0) {
    invalid("E_INTERVENTION_HYPOTHESIS_MISSING", "intervention must bind to at least one hypothesis");
  }
  if (intervention.reversible !== undefined && typeof intervention.reversible !== "boolean") {
    invalid("E_INTERVENTION_INVALID", "intervention.reversible must be boolean");
  }
  return details;
}

export function interventionSemanticFingerprint(details) {
  const intervention = details.intervention;
  return canonicalFingerprint({
    kind: intervention.kind,
    statement: normalizeDiagnosticText(intervention.statement),
    targets: [...new Set((intervention.targets ?? []).map((target) => target.trim()))].sort(),
    hypothesisRefs: [...new Set((intervention.hypothesisRefs ?? []).map((ref) => ref.trim()))].sort(),
  });
}

export function assertHypothesisDispositionDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    invalid("E_HYPOTHESIS_DISPOSITION_INVALID", "Disposition event details must be an object");
  }
  if (details.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION) {
    invalid("E_HYPOTHESIS_DISPOSITION_INVALID", `disposition schemaVersion must be ${DIAGNOSTIC_SCHEMA_VERSION}`);
  }
  if (!Number.isInteger(details.verificationCycle) || details.verificationCycle < 1) {
    invalid("E_HYPOTHESIS_DISPOSITION_INVALID", "disposition verificationCycle must be an integer >= 1");
  }
  assertDiagnosticId(details.hypothesisRef, "hypothesisRef");
  if (!HYPOTHESIS_STATUSES.includes(details.status)) {
    invalid("E_HYPOTHESIS_DISPOSITION_INVALID", `disposition status must be one of ${HYPOTHESIS_STATUSES.join(", ")}`);
  }
  assertStringRefArray(
    details.evidenceRefs ?? [],
    "evidenceRefs",
    LIMITS.evidenceRefsPerHypothesis,
    "E_HYPOTHESIS_DISPOSITION_EVIDENCE_INVALID",
  );
  if ((details.evidenceRefs ?? []).length === 0) {
    invalid("E_HYPOTHESIS_DISPOSITION_EVIDENCE_INVALID", "disposition requires at least one evidenceRef");
  }
  assertBoundedText(details.reason, "reason", LIMITS.reasonLength, "E_HYPOTHESIS_DISPOSITION_INVALID");
  return details;
}
