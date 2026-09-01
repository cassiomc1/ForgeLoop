import assert from "node:assert/strict";
import { test } from "node:test";

import { compareStructuralQuality } from "../src/core/structural-quality/policy.js";

function makeSnapshot(score = 9000) {
  return {
    qualitySignal: score,
    bottleneck: "modularity",
    rootCauses: {
      modularity: { score, raw: score / 10000 },
      acyclicity: { score, raw: 0 },
      depth: { score, raw: 0 },
      equality: { score, raw: 0 },
      redundancy: { score, raw: 0 },
    },
    statistics: { files: 5, lines: 200, importEdges: 10, crossModuleEdges: 2 },
    diagnostics: null,
  };
}

test("evaluations with differing measurementModel are incomparable", () => {
  const baseline = {
    provider: {
      id: "sentrux",
      version: "0.5.7",
      measurementModel: "structural-root-causes-v1",
      compatibilityKey: "sentrux-structural-root-causes-v1",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9000),
  };
  const current = {
    provider: {
      id: "sentrux",
      version: "0.5.7",
      measurementModel: "other-measurement-model-v2",
      compatibilityKey: "sentrux-structural-root-causes-v1",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9100),
  };
  const comparison = compareStructuralQuality({ baseline, current, policy: { mode: "gate", provider: "sentrux" } });
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.status, "NOT_OBSERVED");
  assert.ok(comparison.reasonCodes.includes("MEASUREMENT_MODEL_MISMATCH"));
  assert.ok(comparison.reasonCodes.includes("E_STRUCTURAL_QUALITY_MEASUREMENT_MODEL_MISMATCH"));
});

test("evaluations with differing compatibilityKey are incomparable", () => {
  const baseline = {
    provider: {
      id: "sentrux",
      version: "0.5.7",
      measurementModel: "structural-root-causes-v1",
      compatibilityKey: "sentrux-structural-root-causes-v1",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9000),
  };
  const current = {
    provider: {
      id: "sentrux",
      version: "0.5.7",
      measurementModel: "structural-root-causes-v1",
      compatibilityKey: "custom-compatibility-key",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9100),
  };
  const comparison = compareStructuralQuality({ baseline, current, policy: { mode: "gate", provider: "sentrux" } });
  assert.equal(comparison.comparable, false);
  assert.equal(comparison.status, "NOT_OBSERVED");
  assert.ok(comparison.reasonCodes.includes("COMPATIBILITY_KEY_CHANGED"));
});

test("evaluations with different versions but matching compatibilityKey are comparable", () => {
  const baseline = {
    provider: {
      id: "sentrux",
      version: "0.5.6",
      measurementModel: "structural-root-causes-v1",
      compatibilityKey: "sentrux-structural-root-causes-v1",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9000),
  };
  const current = {
    provider: {
      id: "sentrux",
      version: "0.5.7",
      measurementModel: "structural-root-causes-v1",
      compatibilityKey: "sentrux-structural-root-causes-v1",
    },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: makeSnapshot(9200),
  };
  const comparison = compareStructuralQuality({ baseline, current, policy: { mode: "gate", provider: "sentrux" } });
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.status, "PASS");
  assert.equal(comparison.qualityDelta, 200);
});
