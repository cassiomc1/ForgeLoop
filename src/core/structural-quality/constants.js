import { E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID } from "../error-codes.js";

export const STRUCTURAL_QUALITY_ROOT_CAUSES = Object.freeze([
  "modularity",
  "acyclicity",
  "depth",
  "equality",
  "redundancy",
]);

export const STRUCTURAL_QUALITY_MODES = Object.freeze(["off", "observe", "gate"]);
export const STRUCTURAL_QUALITY_STATUSES = Object.freeze(["PASS", "FAIL", "BLOCKED", "NOT_OBSERVED"]);
export const STRUCTURAL_QUALITY_CHECK_ID = "structural-quality";
export const STRUCTURAL_QUALITY_REQUIREMENT = "Structural quality must not regress beyond the configured budget";
export const STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
export const STRUCTURAL_QUALITY_SENTRUX_MIN_VERSION = "0.5.5";
// Kept as an alias for early callers that used the misspelled constant before
// the public provider name was finalized.
export const STRUCTURAL_QUALITY_SENTRYX_MIN_VERSION = STRUCTURAL_QUALITY_SENTRUX_MIN_VERSION;
export const STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS = 120_000;
export const STRUCTURAL_QUALITY_MAX_TIMEOUT_MS = 300_000;
export const STRUCTURAL_QUALITY_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const STRUCTURAL_QUALITY_MAX_DIAGNOSTICS = 50;
export const STRUCTURAL_QUALITY_MAX_DIAGNOSTIC_STRING = 4096;
export const STRUCTURAL_QUALITY_MAX_EXTRA_EVALUATIONS = 2;

export const STRUCTURAL_QUALITY_DEFAULT_DIMENSION_BUDGETS = Object.freeze(
  Object.fromEntries(STRUCTURAL_QUALITY_ROOT_CAUSES.map((cause) => [cause, 0])),
);

export const STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION = Object.freeze({
  mode: "off",
  maxExtraEvaluations: STRUCTURAL_QUALITY_MAX_EXTRA_EVALUATIONS,
  minGainPoints: 25,
});

export const STRUCTURAL_QUALITY_DEFAULT_GATE_POLICY = Object.freeze({
  mode: "gate",
  provider: "sentrux",
  maxRegressionPoints: 0,
  dimensionBudgets: STRUCTURAL_QUALITY_DEFAULT_DIMENSION_BUDGETS,
  forbidNewCycles: true,
  minQualitySignal: null,
  minimums: Object.freeze({}),
  optimization: STRUCTURAL_QUALITY_DEFAULT_OPTIMIZATION,
});

export function structuralQualityError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export function assertStructuralQualityMode(mode) {
  if (!STRUCTURAL_QUALITY_MODES.includes(mode)) {
    throw structuralQualityError(
      E_STRUCTURAL_QUALITY_CONFIGURATION_INVALID,
      `structuralQuality.mode must be one of ${STRUCTURAL_QUALITY_MODES.join(", ")}`,
    );
  }
  return mode;
}
