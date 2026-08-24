import test from "node:test";
import assert from "node:assert/strict";

import { computeFailureSignature, projectFailureSignatures } from "../src/core/failure-signature.js";
import { projectFailureSurfaces, compareFailureSurface } from "../src/core/failure-surface.js";
import { detectOscillation } from "../src/core/reflection.js";

test("failure signature is deterministic and semantic", () => {
  const base = computeFailureSignature({ requirement: "auth-tests", status: "failed", exitCode: 1, failureToken: "AUTH_401_REFRESH" });
  const same = computeFailureSignature({ requirement: "auth-tests", status: "failed", exitCode: 1, failureToken: "AUTH_401_REFRESH" });
  assert.equal(base, same);
  assert.match(base, /^[a-f0-9]{64}$/);

  const differentToken = computeFailureSignature({ requirement: "auth-tests", status: "failed", exitCode: 1, failureToken: "DIFFERENT" });
  assert.notEqual(base, differentToken);

  assert.throws(() => computeFailureSignature({ status: "failed" }), { code: "E_FAILURE_SIGNATURE_INVALID" });
});

test("failure surfaces track per-cycle failed requirements and reduction", () => {
  const events = [
    { event: "VERIFICATION_RECORDED", details: { id: "tests", requirement: "tests", status: "failed", verificationCycle: 2 } },
    { event: "VERIFICATION_RECORDED", details: { id: "lint", requirement: "lint", status: "failed", verificationCycle: 2 } },
    { event: "VERIFICATION_RECORDED", details: { id: "lint", requirement: "lint", status: "failed", verificationCycle: 3 } },
  ];
  const surfaces = projectFailureSurfaces({ events });
  assert.deepEqual(surfaces.map((entry) => entry.verificationCycle), [2, 3]);
  assert.deepEqual(surfaces[0].surface, ["lint", "tests"]);
  assert.deepEqual(surfaces[1].surface, ["lint"]);

  const comparison = compareFailureSurface(surfaces[0].surface, surfaces[1].surface);
  assert.equal(comparison.direction, "REDUCED");
  assert.equal(compareFailureSurface(surfaces[1].surface, surfaces[0].surface).direction, "EXPANDED");
});

test("oscillation detects A→B→A patterns only across distinct strategies", () => {
  const strategies = [
    { verificationCycle: 2, strategyFingerprint: "A" },
    { verificationCycle: 3, strategyFingerprint: "B" },
    { verificationCycle: 4, strategyFingerprint: "A" },
  ];
  const detected = detectOscillation(strategies);
  assert.equal(detected.detected, true);
  assert.deepEqual(detected.patterns[0].cycles, [2, 3, 4]);

  const monotonic = [
    { verificationCycle: 2, strategyFingerprint: "A" },
    { verificationCycle: 3, strategyFingerprint: "B" },
    { verificationCycle: 4, strategyFingerprint: "C" },
  ];
  assert.equal(detectOscillation(monotonic).detected, false);
});

test("projected signatures group repeated failures across cycles", () => {
  const events = [
    { event: "VERIFICATION_RECORDED", details: { id: "auth", requirement: "auth", status: "failed", exitCode: 1, verificationCycle: 2 } },
    { event: "VERIFICATION_RECORDED", details: { id: "auth", requirement: "auth", status: "failed", exitCode: 1, verificationCycle: 3 } },
  ];
  const signatures = projectFailureSignatures({ events });
  assert.equal(signatures.length, 1);
  assert.deepEqual(signatures[0].cycles, [2, 3]);
});
