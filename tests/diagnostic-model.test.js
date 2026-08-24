import test from "node:test";
import assert from "node:assert/strict";

import {
  assertDiagnosticCaseDetails,
  assertHypothesis,
  assertInterventionDetails,
  assertObservation,
  diagnosticSemanticFingerprint,
  normalizeDiagnosticText,
} from "../src/core/diagnostic-model.js";
import { legacyDiagnosisToDiagnosticCase } from "../src/core/diagnostic-record.js";

function minimalCase(overrides = {}) {
  return {
    schemaVersion: 1,
    verificationCycle: 2,
    diagnosticRevision: 1,
    failureClass: "VERIFICATION_FAILURE",
    observations: [
      { id: "obs-1", kind: "CHECK_RESULT", evidenceRef: "lint", statement: "Lint failed." },
    ],
    contributors: [
      { id: "c-1", type: "CODE", statement: "Unused import.", basis: ["obs-1"], status: "OBSERVED" },
    ],
    hypotheses: [
      {
        id: "h-1",
        statement: "Unused import triggers lint rule.",
        contributorRefs: ["c-1"],
        evidenceRefs: ["lint"],
        settledBy: { type: "CHECK_STATUS", checkId: "lint", expectedStatus: "passed" },
        status: "OPEN",
      },
    ],
    nextSafeAction: { statement: "Remove the unused import." },
    ...overrides,
  };
}

test("normalizeDiagnosticText canonicalizes whitespace and case", () => {
  assert.equal(normalizeDiagnosticText("  Boundary   Check <= \n vs <  "), "boundary check <= vs <");
});

test("semantic fingerprint ignores whitespace, key order, and array order", () => {
  const base = minimalCase();
  const fingerprintA = diagnosticSemanticFingerprint({ verificationCycle: base.verificationCycle, failureClass: base.failureClass, case_: base });

  const reordered = minimalCase({
    contributors: [{ id: "c-renamed", type: "CODE", statement: "unused IMPORT.", basis: ["obs-1"], status: "OBSERVED" }],
  });
  const fingerprintB = diagnosticSemanticFingerprint({ verificationCycle: base.verificationCycle, failureClass: base.failureClass, case_: reordered });

  assert.equal(fingerprintA, fingerprintB);
});

test("assertDiagnosticCaseDetails accepts a valid minimal case", () => {
  const details = minimalCase();
  details.diagnosticFingerprint = diagnosticSemanticFingerprint({
    verificationCycle: details.verificationCycle,
    failureClass: details.failureClass,
    case_: details,
  });
  assert.doesNotThrow(() => assertDiagnosticCaseDetails(details));
});

test("assertDiagnosticCaseDetails rejects duplicate IDs, unknown refs, and missing settlement", () => {
  const duplicateIds = minimalCase({
    contributors: [
      { id: "obs-1", type: "CODE", statement: "Duplicate ID with observation." },
    ],
  });
  duplicateIds.diagnosticFingerprint = diagnosticSemanticFingerprint({ verificationCycle: duplicateIds.verificationCycle, failureClass: duplicateIds.failureClass, case_: duplicateIds });
  assert.throws(() => assertDiagnosticCaseDetails(duplicateIds), { code: "E_DIAGNOSTIC_CASE_INVALID" });

  const unknownRef = minimalCase({
    contributors: [{ id: "c-x", type: "CODE", statement: "Unknown basis.", basis: ["obs-missing"] }],
  });
  unknownRef.diagnosticFingerprint = diagnosticSemanticFingerprint({ verificationCycle: unknownRef.verificationCycle, failureClass: unknownRef.failureClass, case_: unknownRef });
  assert.throws(() => assertDiagnosticCaseDetails(unknownRef), { code: "E_CONTRIBUTOR_REFERENCE_INVALID" });

  assert.throws(() => assertHypothesis({
    id: "h-no-settlement",
    statement: "Open hypothesis without settlement.",
    settledBy: null,
  }), { code: "E_HYPOTHESIS_SETTLEMENT_MISSING" });
});

test("fingerprint mismatch and cycle validation fail closed", () => {
  const mismatched = minimalCase({ diagnosticFingerprint: "0".repeat(64) });
  assert.throws(() => assertDiagnosticCaseDetails(mismatched), { code: "E_DIAGNOSTIC_CASE_INVALID" });

  const badCycle = minimalCase({ verificationCycle: 0 });
  assert.throws(() => assertDiagnosticCaseDetails(badCycle), { code: "E_DIAGNOSTIC_CASE_CYCLE_MISMATCH" });
});

test("intervention requires hypothesis binding and valid kind", () => {
  assert.throws(() => assertInterventionDetails({
    schemaVersion: 1,
    verificationCycle: 1,
    intervention: { id: "i-1", kind: "CODE_CHANGE", statement: "Change.", hypothesisRefs: [] },
  }), { code: "E_INTERVENTION_HYPOTHESIS_MISSING" });

  assert.throws(() => assertInterventionDetails({
    schemaVersion: 1,
    verificationCycle: 1,
    intervention: { id: "i-1", kind: "NOT_A_KIND", statement: "Change.", hypothesisRefs: ["h-1"] },
  }), { code: "E_INTERVENTION_INVALID" });
});

test("observation provenance enum is enforced", () => {
  assert.throws(() => assertObservation({ id: "obs-bad", kind: "CHECK_RESULT", statement: "x", provenance: "MADE_UP" }), { code: "E_OBSERVATION_INVALID" });
});

test("legacy diagnosis adapter maps without inventing facts", () => {
  const legacy = {
    verificationCycle: 3,
    failureClass: "VERIFICATION_FAILURE",
    hypothesis: "Comparison operator <= instead of <",
    evidenceRefs: ["check-auth-boundary"],
    settledBy: "Exact boundary check returns 401",
    nextSafeAction: "Replace <= with < in middleware",
    diagnosisFingerprint: "b".repeat(64),
    previousDiagnosisFingerprint: null,
  };
  const projected = legacyDiagnosisToDiagnosticCase(legacy);
  assert.equal(projected.sourceModel, "LEGACY_DIAGNOSIS_V1");
  assert.equal(projected.hypotheses.length, 1);
  assert.equal(projected.hypotheses[0].statement, legacy.hypothesis);
  assert.equal(projected.hypotheses[0].settledBy.statement, legacy.settledBy);
  assert.equal(projected.nextSafeAction.statement, legacy.nextSafeAction);
  assert.equal(projected.contributors.length, 0);
});
