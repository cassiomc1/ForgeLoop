import test from "node:test";
import assert from "node:assert/strict";
import { projectFailureSurfaces, compareFailureSurface } from "../src/core/failure-surface.js";
import { evaluateInterventionEffectiveness } from "../src/core/strategy-analysis.js";

const started = (cycle) => ({ event: "VERIFICATION_STARTED", details: { verificationCycle: cycle } });
const rec = (requirement, status, cycle) => ({
  event: "VERIFICATION_RECORDED",
  details: { id: `check-${requirement}`, requirement, status, verificationCycle: cycle },
});

test("zero-failure cycles appear explicitly with surface []", () => {
  const surfaces = projectFailureSurfaces({
    state: null,
    events: [started(1), rec("tests", "failed", 1), started(2), rec("tests", "passed", 2)],
  });
  assert.deepEqual(surfaces, [
    { verificationCycle: 1, surface: ["tests"], size: 1 },
    { verificationCycle: 2, surface: [], size: 0 },
  ]);
});

test("mixed pass/fail cycles keep only failing requirements per cycle", () => {
  const surfaces = projectFailureSurfaces({
    state: null,
    events: [
      started(1), rec("tests", "failed", 1), rec("lint", "failed", 1),
      started(2), rec("tests", "passed", 2), rec("lint", "failed", 2),
    ],
  });
  assert.deepEqual(surfaces.map((entry) => entry.surface), [["lint", "tests"], ["lint"]]);
});

test("legacy fallback: state checks with cycle identity still produce surfaces; no invented empty cycle without evidence", () => {
  const surfaces = projectFailureSurfaces({
    state: {
      verificationCycle: 2,
      checks: [{ id: "c-tests", requirement: "tests", status: "failed", details: { verificationCycle: 1 } }],
    },
    events: [],
  });
  assert.deepEqual(surfaces, [{ verificationCycle: 1, surface: ["tests"], size: 1 }]);
});

test("full recovery classifies IMPROVED via complete surfaces", () => {
  const events = [
    started(1), rec("tests", "failed", 1),
    started(2), rec("tests", "passed", 2),
  ];
  const surfacesByCycle = {};
  for (const entry of projectFailureSurfaces({ state: null, events })) {
    surfacesByCycle[entry.verificationCycle] = { surface: entry.surface, signatures: [`sig-${entry.verificationCycle}`] };
  }
  void compareFailureSurface;
  const trace = { diagnostics: { interventions: [
    { sequence: 5, verificationCycle: 1, interventionSemanticFingerprint: "fp-1", intervention: { id: "i1", kind: "CODE_CHANGE" } },
  ] } };
  const evaluated = evaluateInterventionEffectiveness(trace, surfacesByCycle);
  assert.equal(evaluated[0].effectiveness, "IMPROVED");
});
