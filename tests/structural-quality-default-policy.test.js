import assert from "node:assert/strict";
import { test } from "node:test";

import { compareStructuralQuality, normalizeStructuralQualityConfig } from "../src/core/structural-quality/policy.js";

function snapshot(overrides = {}) {
  const scores = {
    modularity: 8500,
    acyclicity: 9000,
    depth: 8800,
    equality: 8700,
    redundancy: 8900,
    ...(overrides.rootCauses ?? {}),
  };
  const rawValues = {
    modularity: 0.85,
    acyclicity: 0,
    depth: 0.88,
    equality: 0.87,
    redundancy: 0.89,
    ...(overrides.raw ?? {}),
  };
  return {
    qualitySignal: overrides.qualitySignal ?? 8780,
    bottleneck: overrides.bottleneck ?? "modularity",
    rootCauses: Object.fromEntries(Object.keys(scores).map((k) => [k, { score: scores[k], raw: rawValues[k] }])),
    statistics: { files: 10, lines: 500, importEdges: 20, crossModuleEdges: 3 },
    diagnostics: null,
  };
}

function evidence(snap) {
  return {
    provider: { id: "sentrux", version: "0.5.7", measurementModel: "structural-root-causes-v1", compatibilityKey: "sentrux-structural-root-causes-v1" },
    scope: { kind: "PROJECT", projectRoot: ".", providerConfigFingerprint: null },
    snapshot: snap,
  };
}

test("default policy allows dimension trade-offs when aggregate signal does not regress and cycles are unchanged", () => {
  const baseline = evidence(snapshot({ qualitySignal: 8000, rootCauses: { modularity: 8000, depth: 8000 } }));
  // Modularity drops by 200, but depth increases by 500 and overall signal increases by +300
  const current = evidence(snapshot({ qualitySignal: 8300, rootCauses: { modularity: 7800, depth: 8500 } }));

  const defaultPolicy = normalizeStructuralQualityConfig({ mode: "gate", provider: "sentrux" });
  const result = compareStructuralQuality({ baseline, current, policy: defaultPolicy });

  assert.equal(result.comparable, true);
  assert.equal(result.status, "PASS", "default policy should PASS trade-off when aggregate does not regress and cycles do not increase");
  assert.equal(result.failedConditions.length, 0);
  assert.equal(result.qualityDelta, 300);
});

test("default policy fails closed when aggregate signal regresses", () => {
  const baseline = evidence(snapshot({ qualitySignal: 8000 }));
  const current = evidence(snapshot({ qualitySignal: 7999 }));

  const defaultPolicy = normalizeStructuralQualityConfig({ mode: "gate", provider: "sentrux" });
  const result = compareStructuralQuality({ baseline, current, policy: defaultPolicy });

  assert.equal(result.comparable, true);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failedConditions.includes("qualitySignal"));
});

test("default policy fails closed when new cycles are introduced", () => {
  const baseline = evidence(snapshot({ raw: { acyclicity: 0 } }));
  const current = evidence(snapshot({ qualitySignal: 9000, raw: { acyclicity: 1 } }));

  const defaultPolicy = normalizeStructuralQualityConfig({ mode: "gate", provider: "sentrux" });
  const result = compareStructuralQuality({ baseline, current, policy: defaultPolicy });

  assert.equal(result.comparable, true);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failedConditions.includes("acyclicity:new-cycles"));
});

test("explicit dimension budgets fail when that dimension exceeds its budget", () => {
  const baseline = evidence(snapshot({ qualitySignal: 8000, rootCauses: { modularity: 8000, depth: 8000 } }));
  const current = evidence(snapshot({ qualitySignal: 8300, rootCauses: { modularity: 7800, depth: 8500 } }));

  const strictModularityPolicy = normalizeStructuralQualityConfig({
    mode: "gate",
    provider: "sentrux",
    dimensionBudgets: { modularity: 100 }, // allows max 100 regression
  });
  const result = compareStructuralQuality({ baseline, current, policy: strictModularityPolicy });

  assert.equal(result.comparable, true);
  assert.equal(result.status, "FAIL", "modularity dropped by 200 which exceeds budget of 100");
  assert.ok(result.failedConditions.includes("modularity"));
});
