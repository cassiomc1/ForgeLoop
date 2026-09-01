import { canonicalFingerprint } from "../artifacts.js";
import {
  E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID,
} from "../error-codes.js";
import {
  STRUCTURAL_QUALITY_DEFAULT_DIMENSION_BUDGETS,
  STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION,
  STRUCTURAL_QUALITY_MODES,
  STRUCTURAL_QUALITY_ROOT_CAUSES,
  STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN,
  structuralQualityError,
} from "./constants.js";

const POLICY_KEYS = new Set([
  "mode",
  "provider",
  "maxRegressionPoints",
  "dimensionBudgets",
  "forbidNewCycles",
  "minQualitySignal",
  "minimums",
  "optimization",
]);

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `${label} must be an object`);
  }
  return value;
}

function integer(value, label, { min = 0, max = 10_000 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw structuralQualityError(
      E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID,
      `${label} must be an integer between ${min} and ${max}`,
    );
  }
  return value;
}

function normalizeBudgets(value, label) {
  const source = value === undefined ? {} : plainObject(value, label);
  const unknown = Object.keys(source).find((key) => !STRUCTURAL_QUALITY_ROOT_CAUSES.includes(key));
  if (unknown) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `${label} contains unknown root cause: ${unknown}`);
  }
  return Object.fromEntries(STRUCTURAL_QUALITY_ROOT_CAUSES.map((cause) => {
    const raw = source[cause];
    if (raw === null || raw === undefined) {
      return [cause, STRUCTURAL_QUALITY_DEFAULT_DIMENSION_BUDGETS[cause] ?? null];
    }
    return [cause, integer(raw, `${label}.${cause}`)];
  }));
}

function normalizeMinimums(value) {
  const source = value === undefined ? {} : plainObject(value, "structuralQuality.minimums");
  const unknown = Object.keys(source).find((key) => !STRUCTURAL_QUALITY_ROOT_CAUSES.includes(key));
  if (unknown) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `structuralQuality.minimums contains unknown root cause: ${unknown}`);
  }
  return Object.fromEntries(Object.entries(source).map(([cause, minimum]) => [
    cause,
    integer(minimum, `structuralQuality.minimums.${cause}`),
  ]));
}

function normalizeOptimization(value) {
  const source = value === undefined ? {} : plainObject(value, "structuralQuality.optimization");
  const unknown = Object.keys(source).find((key) => !["mode", "maxExtraEvaluations", "minGainPoints"].includes(key));
  if (unknown) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `structuralQuality.optimization contains unknown property: ${unknown}`);
  }
  const mode = source.mode ?? STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION.mode;
  if (!["off", "bounded"].includes(mode)) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, "structuralQuality.optimization.mode must be off or bounded");
  }
  const maxExtraEvaluations = source.maxExtraEvaluations ?? STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION.maxExtraEvaluations;
  integer(maxExtraEvaluations, "structuralQuality.optimization.maxExtraEvaluations", { min: 0, max: 2 });
  const minGainPoints = source.minGainPoints ?? STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION.minGainPoints;
  integer(minGainPoints, "structuralQuality.optimization.minGainPoints", { min: 1, max: 10_000 });
  return { mode, maxExtraEvaluations, minGainPoints };
}

export function normalizeStructuralQualityConfig(input) {
  if (input === undefined || input === null) return undefined;
  const source = plainObject(input, "structuralQuality");
  const unknown = Object.keys(source).find((key) => !POLICY_KEYS.has(key));
  if (unknown) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `structuralQuality contains unknown property: ${unknown}`);
  }
  const mode = source.mode ?? "observe";
  if (!STRUCTURAL_QUALITY_MODES.includes(mode)) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, `Unknown structural quality mode: ${mode}`);
  }
  const provider = source.provider ?? "sentrux";
  if (typeof provider !== "string" || !STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN.test(provider)) {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, "structuralQuality.provider must be a lower-case provider ID");
  }
  const maxRegressionPoints = source.maxRegressionPoints ?? 0;
  integer(maxRegressionPoints, "structuralQuality.maxRegressionPoints");
  const minQualitySignal = source.minQualitySignal === null || source.minQualitySignal === undefined
    ? null
    : integer(source.minQualitySignal, "structuralQuality.minQualitySignal");
  if (source.forbidNewCycles !== undefined && typeof source.forbidNewCycles !== "boolean") {
    throw structuralQualityError(E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID, "structuralQuality.forbidNewCycles must be boolean");
  }
  const policy = {
    mode,
    provider,
    maxRegressionPoints,
    dimensionBudgets: normalizeBudgets(source.dimensionBudgets, "structuralQuality.dimensionBudgets"),
    forbidNewCycles: source.forbidNewCycles ?? true,
    minQualitySignal,
    minimums: normalizeMinimums(source.minimums),
    optimization: normalizeOptimization(source.optimization),
  };
  return Object.freeze({
    ...policy,
    dimensionBudgets: Object.freeze(policy.dimensionBudgets),
    minimums: Object.freeze(policy.minimums),
    optimization: Object.freeze(policy.optimization),
  });
}

function snapshotOf(value) {
  return value?.snapshot && typeof value.snapshot === "object" ? value.snapshot : value;
}

function assertComparableInputs(baseline, current) {
  const reasons = [];
  const baselineProvider = baseline?.provider;
  const currentProvider = current?.provider;
  const baselineScope = baseline?.scope;
  const currentScope = current?.scope;
  if (baselineProvider?.id !== undefined && currentProvider?.id !== undefined
    && baselineProvider.id !== currentProvider.id) reasons.push("PROVIDER_ID_CHANGED");
  if (baselineProvider?.measurementModel !== undefined && currentProvider?.measurementModel !== undefined
    && baselineProvider.measurementModel !== currentProvider.measurementModel) reasons.push("MEASUREMENT_MODEL_MISMATCH");
  if (baselineProvider?.compatibilityKey !== undefined && currentProvider?.compatibilityKey !== undefined
    && baselineProvider.compatibilityKey !== currentProvider.compatibilityKey) reasons.push("COMPATIBILITY_KEY_CHANGED");
  if (baselineProvider?.version !== undefined && currentProvider?.version !== undefined
    && baselineProvider.version !== currentProvider.version) {
    const sameCompat = baselineProvider?.compatibilityKey && currentProvider?.compatibilityKey
      && baselineProvider.compatibilityKey === currentProvider.compatibilityKey;
    if (!sameCompat) {
      reasons.push("PROVIDER_VERSION_CHANGED");
    }
  }
  if (baselineScope?.providerConfigFingerprint !== undefined && currentScope?.providerConfigFingerprint !== undefined
    && baselineScope.providerConfigFingerprint !== currentScope.providerConfigFingerprint) reasons.push("PROVIDER_CONFIG_CHANGED");
  if (baselineScope?.rulesFingerprint !== undefined && currentScope?.rulesFingerprint !== undefined
    && baselineScope.rulesFingerprint !== currentScope.rulesFingerprint) reasons.push("RULES_CHANGED");
  if (baseline?.bindings?.policyFingerprint && current?.bindings?.policyFingerprint
    && baseline.bindings.policyFingerprint !== current.bindings.policyFingerprint) reasons.push("POLICY_CHANGED");
  if (baseline?.bindings?.scopeFingerprint && current?.bindings?.scopeFingerprint
    && baseline.bindings.scopeFingerprint !== current.bindings.scopeFingerprint) reasons.push("SCOPE_CHANGED");
  return reasons;
}

export function compareStructuralQuality({ baseline, current, policy } = {}) {
  const normalizedPolicy = normalizeStructuralQualityConfig(policy ?? { mode: "gate", provider: "sentrux" });
  const baselineSnapshot = snapshotOf(baseline);
  const currentSnapshot = snapshotOf(current);
  const incompatibilities = assertComparableInputs(baseline, current);
  const rootCauseDeltas = Object.fromEntries(STRUCTURAL_QUALITY_ROOT_CAUSES.map((cause) => [
    cause,
    Number.isInteger(currentSnapshot?.rootCauses?.[cause]?.score) && Number.isInteger(baselineSnapshot?.rootCauses?.[cause]?.score)
      ? currentSnapshot.rootCauses[cause].score - baselineSnapshot.rootCauses[cause].score
      : null,
  ]));
  const qualityDelta = Number.isInteger(currentSnapshot?.qualitySignal) && Number.isInteger(baselineSnapshot?.qualitySignal)
    ? currentSnapshot.qualitySignal - baselineSnapshot.qualitySignal
    : null;
  const failedConditions = [];
  const reasonCodes = [...incompatibilities];
  if (incompatibilities.length === 0) {
    if (qualityDelta === null || qualityDelta < -normalizedPolicy.maxRegressionPoints) {
      failedConditions.push("qualitySignal");
    }
    for (const cause of STRUCTURAL_QUALITY_ROOT_CAUSES) {
      const budget = normalizedPolicy.dimensionBudgets[cause];
      if (budget !== null && budget !== undefined) {
        const delta = rootCauseDeltas[cause];
        if (delta === null || delta < -budget) failedConditions.push(cause);
      }
      const minimum = normalizedPolicy.minimums[cause];
      if (minimum > 0 && (!Number.isInteger(currentSnapshot?.rootCauses?.[cause]?.score)
        || currentSnapshot.rootCauses[cause].score < minimum)) failedConditions.push(`${cause}:minimum`);
    }
    if (normalizedPolicy.minQualitySignal !== null
      && (!Number.isInteger(currentSnapshot?.qualitySignal) || currentSnapshot.qualitySignal < normalizedPolicy.minQualitySignal)) {
      failedConditions.push("qualitySignal:minimum");
    }
    if (normalizedPolicy.forbidNewCycles
      && Number.isFinite(baselineSnapshot?.rootCauses?.acyclicity?.raw)
      && Number.isFinite(currentSnapshot?.rootCauses?.acyclicity?.raw)
      && currentSnapshot.rootCauses.acyclicity.raw > baselineSnapshot.rootCauses.acyclicity.raw) {
      failedConditions.push("acyclicity:new-cycles");
    }
    if (failedConditions.length > 0) reasonCodes.push("E_STRUCTURAL_QUALITY_REGRESSION");
  } else {
    if (incompatibilities.includes("MEASUREMENT_MODEL_MISMATCH")) {
      reasonCodes.push("E_STRUCTURAL_QUALITY_MEASUREMENT_MODEL_MISMATCH");
    }
    reasonCodes.push("E_STRUCTURAL_QUALITY_EVALUATION_INCOMPARABLE");
  }
  const sortedReasons = [...new Set(reasonCodes)].sort();
  return {
    comparable: incompatibilities.length === 0,
    qualityDelta,
    rootCauseDeltas,
    failedConditions: [...new Set(failedConditions)].sort(),
    status: incompatibilities.length > 0 ? "NOT_OBSERVED" : failedConditions.length > 0 ? "FAIL" : "PASS",
    reasonCodes: sortedReasons,
  };
}

export function structuralQualityPolicyFingerprint(policy) {
  return canonicalFingerprint(normalizeStructuralQualityConfig(policy));
}
