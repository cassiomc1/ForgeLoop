import test from "node:test";
import assert from "node:assert/strict";
import { buildInformationGainProjection, computeCycleInformationGain } from "../src/core/information-gain-projection.js";
import { computeFailureSignature } from "../src/core/failure-signature.js";

const TASK = "t-gain";

function ev(seq, event, details = {}, taskId = TASK) {
  return { seq, taskId, event, details };
}

function structuredCase(seq, cycle, { statement = "H1", evidence = ["check-tests"], observations = ["lint reported no-unused-vars"] } = {}) {
  return ev(seq, "DIAGNOSTIC_CASE_RECORDED", {
    verificationCycle: cycle,
    diagnosticRevision: 1,
    failureClass: "VERIFICATION_FAILURE",
    hypotheses: [{ id: `h-${cycle}`, statement, evidenceRefs: evidence }],
    observations: observations.map((o, i) => ({ id: `obs-${cycle}-${i}`, kind: "CHECK_RESULT", evidenceRef: evidence[i % evidence.length], statement: o })),
    contributors: [],
    nextSafeAction: { statement: "fix" },
  });
}

const failEvent = (seq, cycle, requirement, extra = {}) => ev(seq, "VERIFICATION_RECORDED", {
  id: `check-${requirement}`, requirement, status: "failed", exitCode: 1, verificationCycle: cycle, ...extra,
});
const passEvent = (seq, cycle, requirement) => ev(seq, "VERIFICATION_RECORDED", {
  id: `check-${requirement}`, requirement, status: "passed", exitCode: 0, verificationCycle: cycle,
});

test("gain consistency: surface reduction and full recovery produce final effectiveGain=true", () => {
  const events = [
    ev(1, "VERIFICATION_STARTED", { verificationCycle: 1 }),
    failEvent(2, 1, "tests"),
    failEvent(3, 1, "lint"),
    structuredCase(4, 1),
    ev(5, "VERIFICATION_STARTED", { verificationCycle: 2 }),
    passEvent(6, 2, "tests"),
    failEvent(7, 2, "lint"),
    structuredCase(8, 2),
    ev(9, "VERIFICATION_STARTED", { verificationCycle: 3 }),
    passEvent(10, 3, "lint"),
    structuredCase(11, 3),
  ];
  const projection = buildInformationGainProjection(events, TASK);
  const byCycle = new Map(projection.map((entry) => [entry.verificationCycle, entry]));

  assert.equal(byCycle.get(2).dimensions.failureSurfaceChanged, true);
  assert.equal(byCycle.get(2).effectiveGain, true);
  assert.equal(byCycle.get(3).dimensions.failureSurfaceChanged, true);
  assert.equal(byCycle.get(3).effectiveGain, true);

  // no contradictory stale output
  for (const entry of projection) {
    const semanticDelta = entry.dimensions.failureSurfaceChanged
      || entry.dimensions.failureSignatureChanged
      || entry.dimensions.interventionChanged
      || entry.dimensions.strategyChanged
      || entry.dimensions.hypothesisDispositionChanged;
    if (semanticDelta && entry.classification === "NONE") {
      assert.equal(entry.effectiveGain, true, `cycle ${entry.verificationCycle} contradicts its dimensions`);
    }
  }
});

test("gain consistency: interventions and dispositions correlate to their interval only", () => {
  const events = [
    structuredCase(10, 1),
    ev(11, "INTERVENTION_RECORDED", { verificationCycle: 1, interventionSemanticFingerprint: "fp-i1", intervention: { id: "i1" } }),
    ev(12, "VERIFICATION_STARTED", { verificationCycle: 2 }),
    ev(13, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 2 }),
    ev(14, "HYPOTHESIS_DISPOSITION_RECORDED", { verificationCycle: 2, hypothesisRef: "h-1", status: "WEAKENED", evidenceRefs: ["check-tests"] }),
    structuredCase(15, 2),
    ev(16, "INTERVENTION_RECORDED", { verificationCycle: 2, interventionSemanticFingerprint: "fp-i2", intervention: { id: "i2" } }),
    ev(17, "VERIFICATION_STARTED", { verificationCycle: 3 }),
    ev(18, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 3 }),
    structuredCase(19, 3, { observations: ["refresh token expired before failure"] }),
  ];
  const projection = buildInformationGainProjection(events, TASK);
  const byCycle = new Map(projection.map((entry) => [entry.verificationCycle, entry]));

  assert.equal(byCycle.get(1).dimensions.interventionChanged, false, "cycle 1 must not receive later deltas retroactively");
  assert.equal(byCycle.get(1).dimensions.hypothesisDispositionChanged, false);
  assert.equal(byCycle.get(2).dimensions.hypothesisDispositionChanged, true);
  // A genuinely new intervention alongside a moved diagnosis is information...
  assert.equal(byCycle.get(3).dimensions.interventionChanged, true);
  // ...but repeating an already-known corrective action with an otherwise
  // identical re-proposal of the prior diagnosis is NOT (fail-fast anti-blind-retry).
  const repeatEvents = [
    ev(9, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 1 }),
    structuredCase(10, 1),
    ev(11, "INTERVENTION_RECORDED", { verificationCycle: 1, interventionSemanticFingerprint: "fp-i1", intervention: { id: "i1" } }),
    ev(12, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 2 }),
    structuredCase(13, 2),
  ];
  const repeatProjection = buildInformationGainProjection(repeatEvents, TASK);
  assert.equal(repeatProjection.at(-1).dimensions.interventionChanged, false);
  assert.equal(repeatProjection.at(-1).effectiveGain, false);
});

test("gain consistency: semantic noise yields NONE / effectiveGain=false", () => {
  const base = {
    schemaVersion: 1,
    failureClass: "VERIFICATION_FAILURE",
    observations: [{ id: "obs-a", kind: "CHECK_RESULT", evidenceRef: "check-tests", statement: "tests failed with exit 1" }],
    contributors: [{ id: "c-a", type: "CODE", statement: "module X is broken", basis: ["obs-a"], status: "SUSPECTED" }],
    hypotheses: [{ id: "h-a", statement: "Module X breaks the flow.", evidenceRefs: ["check-tests"] }],
    nextSafeAction: { statement: "Fix module X." },
  };
  const reordered = JSON.parse(JSON.stringify(base));
  reordered.hypotheses[0].id = "h-b"; // ID-only novelty
  const noise = [
    ev(1, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 1 }),
    ev(2, "DIAGNOSTIC_CASE_RECORDED", {
      ...JSON.parse(JSON.stringify(base)),
      verificationCycle: 1,
      diagnosticRevision: 1,
    }),
    ev(3, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", verificationCycle: 2 }),
    ev(4, "DIAGNOSTIC_CASE_RECORDED", {
      ...reordered,
      verificationCycle: 2,
      diagnosticRevision: 1,
      observations: [{ ...reordered.observations[0], id: "obs-zzz" }],
      contributors: [{ ...reordered.contributors[0], id: "c-zzz" }],
      hypotheses: [{ ...reordered.hypotheses[0], statement: "Module X breaks THE flow." .replace("THE ", "the ") }],
    }),
  ];
  const projection = buildInformationGainProjection(noise, TASK);
  const second = projection.at(-1);
  assert.equal(second.classification, "NONE");
  assert.equal(second.effectiveGain, false);
});

test("gain consistency: true stall after consecutive identical cycles; false-stall guards hold", () => {
  const identicalCycle = (cycle, seqStart) => [
    ev(seqStart, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "failed", exitCode: 1, verificationCycle: cycle }),
    structuredCase(seqStart + 1, cycle),
  ];
  const events = [
    ...identicalCycle(1, 10),
    ...identicalCycle(2, 20),
    ...identicalCycle(3, 30),
  ];
  const projection = buildInformationGainProjection(events, TASK);
  assert.equal(projection.at(-1).effectiveGain, false);
  assert.equal(projection.at(-2).effectiveGain, false);

  // false-stall guard: same repeated failure but surface reduces at the end
  const guarded = [
    ...identicalCycle(1, 10),
    ...identicalCycle(2, 20),
    ev(30, "VERIFICATION_RECORDED", { id: "check-tests", requirement: "tests", status: "passed", exitCode: 0, verificationCycle: 3 }),
    structuredCase(31, 3),
  ];
  const projection2 = buildInformationGainProjection(guarded, TASK);
  assert.equal(projection2.at(-1).effectiveGain, true);

  void computeFailureSignature;
});
