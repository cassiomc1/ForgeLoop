import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareStructuralQuality,
  normalizeStructuralQualityConfig,
  structuralQualityPolicyFingerprint,
} from "../src/core/structural-quality/policy.js";
import { normalizeStructuralQualitySnapshot } from "../src/core/structural-quality/provider.js";
import { canonicalFingerprint } from "../src/core/artifacts.js";

const rootCauses = {
  modularity: { score: 9000, raw: 0.9 },
  acyclicity: { score: 9000, raw: 0.8 },
  depth: { score: 9000, raw: 0.9 },
  equality: { score: 9000, raw: 0.9 },
  redundancy: { score: 9000, raw: 0.9 },
};

function snapshot(overrides = {}) {
  return normalizeStructuralQualitySnapshot({
    qualitySignal: 9000,
    rootCauses,
    statistics: { files: 3, lines: 120, importEdges: 4, crossModuleEdges: 2 },
    diagnostics: null,
    ...overrides,
  });
}

function evidence(policyInput = { mode: "gate", provider: "fake" }, snapshotOverrides = {}) {
  const policy = normalizeStructuralQualityConfig(policyInput);
  const scope = { kind: "PROJECT", projectRoot: ".", rulesFingerprint: null };
  return {
    provider: { id: policy.provider, version: "1.0.0" },
    scope,
    bindings: {
      policyFingerprint: structuralQualityPolicyFingerprint(policy),
      scopeFingerprint: canonicalFingerprint({ providerId: policy.provider, ...scope }),
    },
    snapshot: snapshot(snapshotOverrides),
  };
}

test("omitted quality configuration is off and gate defaults fail closed", () => {
  assert.equal(normalizeStructuralQualityConfig(undefined), undefined);
  const policy = normalizeStructuralQualityConfig({ mode: "gate", provider: "fake" });
  assert.deepEqual(policy.dimensionBudgets, {
    modularity: 0,
    acyclicity: 0,
    depth: 0,
    equality: 0,
    redundancy: 0,
  });
  assert.deepEqual(policy.minimums, {});
  assert.equal(policy.forbidNewCycles, true);
  assert.deepEqual(policy.optimization, {
    mode: "off",
    maxExtraEvaluations: 2,
    minGainPoints: 25,
  });
});

test("policy normalization rejects unknown and unsafe configuration", () => {
  assert.throws(() => normalizeStructuralQualityConfig({ mode: "unknown", provider: "fake" }), { code: "E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID" });
  assert.throws(() => normalizeStructuralQualityConfig({ mode: "gate", provider: "Fake" }), { code: "E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID" });
  assert.throws(() => normalizeStructuralQualityConfig({ mode: "gate", provider: "fake", dimensionBudgets: { modularity: 1, unknown: 0 } }), { code: "E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID" });
  assert.throws(() => normalizeStructuralQualityConfig({ mode: "gate", provider: "fake", optimization: { mode: "bounded", maxExtraEvaluations: 3 } }), { code: "E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID" });
});

test("equal snapshots and regressions inside the configured budget compare deterministically", () => {
  const policy = { mode: "gate", provider: "fake", maxRegressionPoints: 1 };
  const baseline = evidence(policy);
  const equal = evidence(policy);
  assert.deepEqual(compareStructuralQuality({ baseline, current: equal, policy }), {
    comparable: true,
    qualityDelta: 0,
    rootCauseDeltas: { modularity: 0, acyclicity: 0, depth: 0, equality: 0, redundancy: 0 },
    failedConditions: [],
    status: "PASS",
    reasonCodes: [],
  });
  const withinBudget = evidence(policy, { qualitySignal: 8999 });
  assert.equal(compareStructuralQuality({ baseline, current: withinBudget, policy }).status, "PASS");
});

test("a one-point aggregate regression fails with the zero default budget", () => {
  const policy = { mode: "gate", provider: "fake" };
  const result = compareStructuralQuality({
    baseline: evidence(policy),
    current: evidence(policy, { qualitySignal: 8999 }),
    policy,
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.comparable, true);
  assert.deepEqual(result.failedConditions, ["qualitySignal"]);
  assert.deepEqual(result.reasonCodes, ["E_STRUCTURAL_QUALITY_REGRESSION"]);
});

test("dimension budgets and new-cycle policy are evaluated independently of aggregate signal", () => {
  const policy = { mode: "gate", provider: "fake", dimensionBudgets: { modularity: 0 } };
  const modularityRegression = compareStructuralQuality({
    baseline: evidence(policy),
    current: evidence(policy, {
      qualitySignal: 9001,
      rootCauses: {
        ...rootCauses,
        modularity: { score: 8999, raw: 0.89 },
      },
    }),
    policy,
  });
  assert.equal(modularityRegression.status, "FAIL");
  assert.deepEqual(modularityRegression.failedConditions, ["modularity"]);

  const newCycle = compareStructuralQuality({
    baseline: evidence(policy),
    current: evidence(policy, {
      rootCauses: {
        ...rootCauses,
        acyclicity: { score: 9000, raw: 0.9 },
      },
    }),
    policy,
  });
  assert.equal(newCycle.status, "FAIL");
  assert.deepEqual(newCycle.failedConditions, ["acyclicity:new-cycles"]);
});

test("provider, policy, and scope drift make the comparison incomparable", () => {
  const policy = { mode: "gate", provider: "fake" };
  const baseline = evidence(policy);
  const providerDrift = structuredClone(evidence(policy));
  providerDrift.provider.version = "2.0.0";
  assert.equal(compareStructuralQuality({ baseline, current: providerDrift, policy }).status, "NOT_OBSERVED");
  assert.deepEqual(compareStructuralQuality({ baseline, current: providerDrift, policy }).reasonCodes, ["E_STRUCTURAL_QUALITY_EVALUATION_INCOMPARABLE", "PROVIDER_VERSION_CHANGED"]);

  const policyDrift = structuredClone(evidence(policy));
  policyDrift.bindings.policyFingerprint = "b".repeat(64);
  assert.equal(compareStructuralQuality({ baseline, current: policyDrift, policy }).comparable, false);

  const scopeDrift = structuredClone(evidence(policy));
  scopeDrift.bindings.scopeFingerprint = "c".repeat(64);
  assert.equal(compareStructuralQuality({ baseline, current: scopeDrift, policy }).comparable, false);
});
