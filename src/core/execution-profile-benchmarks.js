import { canonicalFingerprint } from "./artifacts.js";
import { evaluateRoute } from "./router.js";
import { normalizeUsage } from "./usage.js";

export const BENCHMARK_VERSION = "2";
export const SUPPORTED_BENCHMARK_VERSIONS = Object.freeze(["1", "2"]);
export const BENCHMARK_MODES = Object.freeze([
  "direct",
  "forgeloopBalanced",
  "forgeloopAdaptive",
]);
// Observational runaway-execution diagnostics only; they never gate lifecycle
// truth or completion validity.
export const BENCHMARK_RUNAWAY_SIGNALS = Object.freeze([
  "EXCESSIVE_MODEL_TURNS",
  "EXCESSIVE_TOOL_CALLS",
  "EXCESSIVE_VERIFICATION_CYCLES",
  "REPEATED_CONTEXT_REFRESH",
  "REPEATED_FILE_READ",
  "REPEATED_GUIDE_LOAD",
  "UNEXPECTED_RETRY",
  "CORRECTION_LOOP",
  "HOST_RETRY",
  "MODEL_STALL",
  "UNKNOWN_TOKEN_SPIKE",
]);
export const BENCHMARK_DIAGNOSTIC_COUNT_FIELDS = Object.freeze([
  "verificationCycles",
  "modelTurns",
  "toolCalls",
  "retries",
  "correctionCycles",
  "filesRead",
  "filesWritten",
  "contextRefreshes",
]);
export const BENCHMARK_TIERS = Object.freeze({
  smoke: Object.freeze({ minimumRuns: 1, maximumRuns: 3, defaultRuns: 1 }),
  evidence: Object.freeze({ minimumRuns: 5, maximumRuns: 10, defaultRuns: 5 }),
  tail: Object.freeze({ minimumRuns: 20, maximumRuns: 30, defaultRuns: 20 }),
});
export const OUTLIER_POLICY = "TOKEN_IQR_1_5";
export const OUTLIER_MINIMUM_SAMPLES = 4;
export const TAIL_SAMPLE_MINIMUM = 20;
export const LOW_BASELINE_RATIO = 0.60;
export const BASELINE_TOKEN_REGIMES = Object.freeze([
  "NORMAL",
  "LOW_BASELINE_TOKEN_REGIME",
]);
export const TAIL_STATUSES = Object.freeze([
  "TAIL_STABLE",
  "TAIL_WARNING",
  "TAIL_REGRESSION",
  "NOT_ENOUGH_SAMPLES",
]);
export const DISTRIBUTION_TAIL_STATUSES = Object.freeze([
  "TAIL_ACCEPTABLE",
  "TAIL_REGRESSION",
  "NOT_ENOUGH_SAMPLES",
]);
export const COMBINED_TAIL_STATUSES = Object.freeze([
  "TAIL_CONSISTENT",
  "TAIL_PAIRED_RATIO_SENSITIVE",
  "TAIL_DISTRIBUTION_REGRESSION",
  "TAIL_UNRESOLVED",
]);
export const BENCHMARK_VERIFICATION_RESULTS = Object.freeze([
  "PASS",
  "FAIL",
  "NOT_AVAILABLE",
]);
export const BENCHMARK_USAGE_SOURCES = Object.freeze([
  "PROVIDER_REPORTED",
  "HOST_REPORTED",
  "UNKNOWN",
]);
export const BENCHMARK_CONTEXT_USAGE_SOURCES = Object.freeze([
  "HOST_REPORTED",
  "UNKNOWN",
]);
export const BENCHMARK_CONTEXT_USAGE_ITEMS = Object.freeze([
  "taskContext",
  "guides",
  "history",
  "protocolInstructions",
  "repositoryContext",
  "other",
]);
export const BENCHMARK_QUALITY_SOURCES = Object.freeze([
  "EXTERNAL_REPORTED",
  "HOST_REPORTED",
  "UNKNOWN",
]);
export const BENCHMARK_QUALITY_FIELDS = Object.freeze([
  "visualQuality",
  "responsiveQuality",
  "accessibility",
  "interactionPolish",
  "requirementsCompleteness",
]);
export const REQUIRED_BENCHMARK_SCENARIO_IDS = Object.freeze([
  "documentation-correction",
  "static-landing-page",
  "small-bug-fix",
  "api-feature",
  "authentication-change",
  "infrastructure-release",
  "novatask-saas-landing-page",
]);
export const LIGHT_EFFICIENCY_OBJECTIVES = Object.freeze({
  p50TokenOverheadPercent: 35,
  p95TokenOverheadPercent: 60,
});

const PROFILE_BY_MODE = Object.freeze({
  direct: { requestedProfile: null, resolvedProfile: null },
  forgeloopBalanced: { requestedProfile: "balanced", resolvedProfile: null },
  forgeloopAdaptive: { requestedProfile: "auto", resolvedProfile: null },
});

function benchmarkError(message) {
  const error = new Error(message);
  error.code = "E_BENCHMARK_INVALID";
  return error;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw benchmarkError(`${label} must be an object`);
  }
  return value;
}

function assertString(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return value;
  if (typeof value !== "string" || value.length === 0) {
    throw benchmarkError(`${label} must be a non-empty string${nullable ? " or null" : ""}`);
  }
  return value;
}

function assertNullableFiniteNumber(value, label) {
  if (value === null) return value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw benchmarkError(`${label} must be a non-negative finite number or null`);
  }
  return value;
}

function assertNullableNonNegativeInteger(value, label) {
  if (value === null) return value;
  if (!Number.isInteger(value) || value < 0) {
    throw benchmarkError(`${label} must be a non-negative integer or null`);
  }
  return value;
}

function assertNullableProfile(value, label) {
  if (value === null) return value;
  if (typeof value !== "string" || !["light", "balanced", "full"].includes(value)) {
    throw benchmarkError(`${label} must be light, balanced, full, or null`);
  }
  return value;
}

function assertRunSetId(value) {
  assertString(value, "runSetId");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value)) {
    throw benchmarkError("runSetId contains unsupported characters");
  }
  return value;
}

function assertRunId(value) {
  assertString(value, "runId");
  if (!/^run-[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(value)) {
    throw benchmarkError("runId must start with run- and contain safe identifier characters");
  }
  return value;
}

function assertScenarioId(value) {
  assertString(value, "scenarioId");
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(value)) {
    throw benchmarkError("scenarioId must be a lowercase portable identifier");
  }
  return value;
}

function assertTimestamp(value, label) {
  assertString(value, label);
  if (Number.isNaN(Date.parse(value))) throw benchmarkError(`${label} must be a valid timestamp`);
  return value;
}

function normalizedModeProfile(mode, resolvedProfile) {
  const expected = PROFILE_BY_MODE[mode];
  if (!expected) throw benchmarkError(`Unsupported benchmark mode: ${mode}`);
  if (mode === "direct" && resolvedProfile !== null) {
    throw benchmarkError(`${mode} must not report a ForgeLoop resolved profile`);
  }
  if (mode !== "direct" && (typeof resolvedProfile !== "string" || !resolvedProfile)) {
    throw benchmarkError(`${mode} must report its resolved ForgeLoop profile`);
  }
  if (mode !== "direct" && !["light", "balanced", "full"].includes(resolvedProfile)) {
    throw benchmarkError(`${mode} resolvedProfile must be light, balanced, or full`);
  }
  return expected;
}

export function assertBenchmarkScenario(value) {
  const scenario = assertObject(value, "benchmark scenario");
  if (scenario.schemaVersion !== 1) throw benchmarkError("benchmark scenario schemaVersion must be 1");
  if (scenario.benchmarkVersion !== BENCHMARK_VERSION) {
    throw benchmarkError(`benchmark scenario benchmarkVersion must be ${BENCHMARK_VERSION}`);
  }
  assertScenarioId(scenario.scenarioId);
  assertString(scenario.description, "description");
  assertObject(scenario.input, "input");
  assertString(scenario.input.workType, "input.workType");
  for (const key of ["surfaces", "risks", "platforms"]) {
    if (!Array.isArray(scenario.input[key]) || scenario.input[key].some((item) => typeof item !== "string" || !item)) {
      throw benchmarkError(`input.${key} must be an array of non-empty strings`);
    }
  }
  if (!["light", "balanced", "full"].includes(scenario.expectedProfile)) {
    throw benchmarkError("expectedProfile must be light, balanced, or full");
  }
  let resolvedProfile;
  try {
    resolvedProfile = evaluateRoute(scenario.input).executionProfile.resolved;
  } catch (error) {
    throw benchmarkError(`input must be a valid ForgeLoop route: ${error.message}`);
  }
  if (resolvedProfile !== scenario.expectedProfile) {
    throw benchmarkError(
      `expectedProfile does not match the default route resolution: ${scenario.expectedProfile} !== ${resolvedProfile}`,
    );
  }
  if (scenario.referenceTask !== undefined) {
    const referenceTask = assertObject(scenario.referenceTask, "referenceTask");
    assertString(referenceTask.name, "referenceTask.name");
    for (const field of ["requirements", "exclusions"]) {
      if (!Array.isArray(referenceTask[field]) || referenceTask[field].some((item) => typeof item !== "string" || item.trim() === "")) {
        throw benchmarkError(`referenceTask.${field} must be an array of non-empty strings`);
      }
    }
    assertString(referenceTask.artifactMode, "referenceTask.artifactMode");
  }
  assertObject(scenario.measurements, "measurements");
  for (const mode of BENCHMARK_MODES) {
    const measurement = assertObject(scenario.measurements[mode], `measurements.${mode}`);
    for (const field of [
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
      "totalTokens",
    ]) {
      assertNullableNonNegativeInteger(measurement[field], `measurements.${mode}.${field}`);
    }
    assertNullableFiniteNumber(measurement.wallClockMs, `measurements.${mode}.wallClockMs`);
    if (!BENCHMARK_VERIFICATION_RESULTS.includes(measurement.verification)) {
      throw benchmarkError(`measurements.${mode}.verification is not a supported result`);
    }
  }
  return scenario;
}

export function assertRequiredBenchmarkScenarios(scenarios) {
  if (!Array.isArray(scenarios)) throw benchmarkError("benchmark scenarios must be an array");
  const ids = new Set(scenarios.map((scenario) => scenario.scenarioId));
  const missing = REQUIRED_BENCHMARK_SCENARIO_IDS.filter((scenarioId) => !ids.has(scenarioId));
  if (missing.length > 0) {
    throw benchmarkError(`missing required benchmark scenario(s): ${missing.join(", ")}`);
  }
  return scenarios;
}

function normalizeBenchmarkUsage(value) {
  let usage;
  try {
    usage = normalizeUsage(value, {
      defaultSource: "UNKNOWN",
      allowedSources: BENCHMARK_USAGE_SOURCES,
    });
  } catch (error) {
    throw benchmarkError(error.message);
  }
  if (usage.source === "UNKNOWN" && [
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheReadTokens,
    usage.cacheWriteTokens,
    usage.totalTokens,
    usage.costUsd,
    usage.model,
    usage.provider,
  ].some((field) => field !== null)) {
    throw benchmarkError("UNKNOWN usage must keep all measured values and identity fields null");
  }
  return usage;
}

export function normalizeBenchmarkContextUsage(value, expectedProfile = null) {
  assertNullableProfile(expectedProfile, "contextUsage expected profile");
  if (value === undefined || value === null) {
    return {
      source: "UNKNOWN",
      profile: expectedProfile,
      items: Object.fromEntries(BENCHMARK_CONTEXT_USAGE_ITEMS.map((item) => [item, null])),
    };
  }
  const contextUsage = assertObject(value, "contextUsage");
  const source = contextUsage.source ?? "UNKNOWN";
  if (!BENCHMARK_CONTEXT_USAGE_SOURCES.includes(source)) {
    throw benchmarkError(`contextUsage.source must be one of ${BENCHMARK_CONTEXT_USAGE_SOURCES.join(", ")}`);
  }
  const profile = contextUsage.profile ?? expectedProfile;
  assertNullableProfile(profile, "contextUsage.profile");
  if (profile !== expectedProfile) {
    throw benchmarkError("contextUsage.profile must match the resolved benchmark profile");
  }
  const items = assertObject(contextUsage.items ?? {}, "contextUsage.items");
  const unknownItem = Object.keys(items).find((item) => !BENCHMARK_CONTEXT_USAGE_ITEMS.includes(item));
  if (unknownItem) throw benchmarkError(`contextUsage.items contains unsupported item: ${unknownItem}`);
  const normalizedItems = Object.fromEntries(BENCHMARK_CONTEXT_USAGE_ITEMS.map((item) => {
    const valueForItem = items[item] ?? null;
    return [item, assertNullableNonNegativeInteger(valueForItem, `contextUsage.items.${item}`)];
  }));
  if (source === "UNKNOWN" && Object.values(normalizedItems).some((item) => item !== null)) {
    throw benchmarkError("UNKNOWN context usage must keep every context item null");
  }
  return { source, profile, items: normalizedItems };
}

export function normalizeBenchmarkQuality(value) {
  if (value === undefined || value === null) {
    return {
      source: "UNKNOWN",
      scores: Object.fromEntries(BENCHMARK_QUALITY_FIELDS.map((field) => [field, null])),
    };
  }
  const quality = assertObject(value, "quality");
  const source = quality.source ?? "UNKNOWN";
  if (!BENCHMARK_QUALITY_SOURCES.includes(source)) {
    throw benchmarkError(`quality.source must be one of ${BENCHMARK_QUALITY_SOURCES.join(", ")}`);
  }
  const scores = assertObject(quality.scores ?? {}, "quality.scores");
  const unknownScore = Object.keys(scores).find((field) => !BENCHMARK_QUALITY_FIELDS.includes(field));
  if (unknownScore) throw benchmarkError(`quality.scores contains unsupported field: ${unknownScore}`);
  const normalizedScores = Object.fromEntries(BENCHMARK_QUALITY_FIELDS.map((field) => {
    const score = scores[field] ?? null;
    if (score !== null && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 5)) {
      throw benchmarkError(`quality.scores.${field} must be between 0 and 5 or null`);
    }
    return [field, score];
  }));
  if (source === "UNKNOWN" && Object.values(normalizedScores).some((score) => score !== null)) {
    throw benchmarkError("UNKNOWN quality must keep every score null");
  }
  return { source, scores: normalizedScores };
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) throw benchmarkError(`${label} must be an array`);
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      throw benchmarkError(`${label} must contain only non-empty strings`);
    }
  }
  return value;
}

// Every diagnostics field is nullable. Unavailable host telemetry stays null;
// it is never estimated from prompt size, file size, or elapsed time.
export function normalizeBenchmarkDiagnostics(value) {
  if (value === undefined || value === null) return null;
  const diagnostics = assertObject(value, "diagnostics");
  const allowedKeys = new Set([
    "executionProfile",
    ...BENCHMARK_DIAGNOSTIC_COUNT_FIELDS,
    "guideCount",
    "guideIds",
    "contextRefreshes",
    "hostWarnings",
    "terminationReason",
    "flags",
  ]);
  const unknownKey = Object.keys(diagnostics).find((key) => !allowedKeys.has(key));
  if (unknownKey) throw benchmarkError(`diagnostics contains unsupported field: ${unknownKey}`);
  const executionProfile = diagnostics.executionProfile ?? null;
  assertNullableProfile(executionProfile, "diagnostics.executionProfile");
  const normalized = { executionProfile };
  for (const field of BENCHMARK_DIAGNOSTIC_COUNT_FIELDS) {
    normalized[field] = assertNullableNonNegativeInteger(diagnostics[field] ?? null, `diagnostics.${field}`);
  }
  normalized.guideCount = assertNullableNonNegativeInteger(diagnostics.guideCount ?? null, "diagnostics.guideCount");
  normalized.guideIds = assertStringArray(diagnostics.guideIds ?? [], "diagnostics.guideIds");
  normalized.hostWarnings = assertStringArray(diagnostics.hostWarnings ?? [], "diagnostics.hostWarnings");
  normalized.terminationReason = assertString(diagnostics.terminationReason ?? null, "diagnostics.terminationReason", { nullable: true });
  const flags = assertStringArray(diagnostics.flags ?? [], "diagnostics.flags");
  const unknownFlag = flags.find((flag) => !BENCHMARK_RUNAWAY_SIGNALS.includes(flag));
  if (unknownFlag) throw benchmarkError(`diagnostics.flags contains unsupported signal: ${unknownFlag}`);
  normalized.flags = BENCHMARK_RUNAWAY_SIGNALS.filter((signal) => flags.includes(signal));
  return normalized;
}

// Observational runaway-execution signals. Host-reported flags are preserved;
// deterministic signals are added only where the recorded diagnostics support
// them. A token outlier with no explanatory signal becomes UNKNOWN_TOKEN_SPIKE.
export function evaluateRunawaySignals(run, {
  medianModelTurns = null,
  medianToolCalls = null,
  tokenOutlier = false,
} = {}) {
  const diagnostics = normalizeBenchmarkDiagnostics(run?.diagnostics ?? null);
  const signals = new Set(diagnostics?.flags ?? []);
  const doubled = (value, median) => (
    typeof value === "number"
    && typeof median === "number"
    && median > 0
    && value > median * 2
  );
  if (doubled(diagnostics?.modelTurns ?? null, medianModelTurns)) signals.add("EXCESSIVE_MODEL_TURNS");
  if (doubled(diagnostics?.toolCalls ?? null, medianToolCalls)) signals.add("EXCESSIVE_TOOL_CALLS");
  const verificationCycles = diagnostics?.verificationCycles ?? run?.verificationCycles ?? null;
  if (verificationCycles !== null && verificationCycles > 1) signals.add("EXCESSIVE_VERIFICATION_CYCLES");
  if ((diagnostics?.contextRefreshes ?? null) !== null && diagnostics.contextRefreshes > 1) {
    signals.add("REPEATED_CONTEXT_REFRESH");
  }
  if ((diagnostics?.retries ?? null) !== null && diagnostics.retries > 0) signals.add("UNEXPECTED_RETRY");
  if ((diagnostics?.correctionCycles ?? null) !== null && diagnostics.correctionCycles > 1) {
    signals.add("CORRECTION_LOOP");
  }
  if (tokenOutlier && signals.size === 0) signals.add("UNKNOWN_TOKEN_SPIKE");
  return BENCHMARK_RUNAWAY_SIGNALS.filter((signal) => signals.has(signal));
}

function contextUsageForRun(run) {
  return normalizeBenchmarkContextUsage(run.contextUsage, run.metadata?.resolvedProfile ?? null);
}

function measuredContextTokens(contextUsage) {
  if (contextUsage.source !== "HOST_REPORTED") return null;
  const values = BENCHMARK_CONTEXT_USAGE_ITEMS.map((item) => contextUsage.items[item]);
  if (values.some((item) => item === null)) return null;
  return values.reduce((sum, item) => sum + item, 0);
}

function assertBenchmarkMetadata(metadata, run) {
  assertObject(metadata, "metadata");
  assertScenarioId(metadata.scenarioId);
  if (!BENCHMARK_MODES.includes(metadata.mode)) throw benchmarkError("metadata.mode is unsupported");
  if (metadata.scenarioId !== run.scenarioId || metadata.mode !== run.mode) {
    throw benchmarkError("benchmark metadata does not match the run identity");
  }
  if (metadata.benchmarkVersion !== run.benchmarkVersion) {
    throw benchmarkError("benchmark metadata benchmarkVersion does not match the run");
  }
  assertString(metadata.environmentClass, "metadata.environmentClass");
  for (const field of ["model", "provider", "projectRevision"]) {
    assertString(metadata[field], `metadata.${field}`, { nullable: true });
  }
  assertString(metadata.promptSpecFingerprint, "metadata.promptSpecFingerprint");
  assertString(metadata.requestedProfile, "metadata.requestedProfile", { nullable: true });
  assertString(metadata.resolvedProfile, "metadata.resolvedProfile", { nullable: true });
  normalizedModeProfile(run.mode, metadata.resolvedProfile);
  if (metadata.requestedProfile !== PROFILE_BY_MODE[run.mode].requestedProfile) {
    throw benchmarkError("metadata.requestedProfile does not match the benchmark mode");
  }
  assertNullableNonNegativeInteger(metadata.verificationCycles, "metadata.verificationCycles");
  assertNullableNonNegativeInteger(metadata.comparableSteps, "metadata.comparableSteps");
  if (metadata.verificationCycles !== run.verificationCycles || metadata.comparableSteps !== run.comparableSteps) {
    throw benchmarkError("benchmark metadata does not match measured run values");
  }
  for (const field of ["nodeVersion", "os", "arch"]) {
    if (metadata[field] !== undefined) assertString(metadata[field], `metadata.${field}`);
  }
  return metadata;
}

export function assertBenchmarkRun(value) {
  const run = assertObject(value, "benchmark run");
  if (run.schemaVersion !== 1) throw benchmarkError("benchmark run schemaVersion must be 1");
  if (!SUPPORTED_BENCHMARK_VERSIONS.includes(run.benchmarkVersion)) {
    throw benchmarkError(`benchmark run benchmarkVersion must be one of ${SUPPORTED_BENCHMARK_VERSIONS.join(", ")}`);
  }
  assertRunSetId(run.runSetId);
  assertRunId(run.runId);
  assertScenarioId(run.scenarioId);
  if (!BENCHMARK_MODES.includes(run.mode)) throw benchmarkError("benchmark run mode is unsupported");
  if (!Number.isInteger(run.runIndex) || run.runIndex < 1) throw benchmarkError("runIndex must be a positive integer");
  assertTimestamp(run.recordedAt, "recordedAt");
  const usage = normalizeBenchmarkUsage(run.usage);
  assertNullableFiniteNumber(run.wallClockMs, "wallClockMs");
  if (!BENCHMARK_VERIFICATION_RESULTS.includes(run.verification)) {
    throw benchmarkError("verification is not a supported result");
  }
  assertNullableNonNegativeInteger(run.verificationCycles, "verificationCycles");
  assertNullableNonNegativeInteger(run.comparableSteps, "comparableSteps");
  assertBenchmarkMetadata(run.metadata, run);
  if ("diagnostics" in run) normalizeBenchmarkDiagnostics(run.diagnostics);
  normalizeBenchmarkContextUsage(run.contextUsage, run.metadata.resolvedProfile);
  normalizeBenchmarkQuality(run.quality);
  if (usage.model !== null && run.metadata.model !== usage.model) {
    throw benchmarkError("metadata.model must match usage.model when reported");
  }
  if (usage.provider !== null && run.metadata.provider !== usage.provider) {
    throw benchmarkError("metadata.provider must match usage.provider when reported");
  }
  return run;
}

export function createBenchmarkRun({
  runSetId,
  runId,
  runIndex,
  scenario,
  mode,
  recordedAt = new Date().toISOString(),
  usage = {},
  wallClockMs = null,
  verification = "NOT_AVAILABLE",
  verificationCycles = null,
  comparableSteps = null,
  diagnostics = undefined,
  contextUsage = undefined,
  quality = undefined,
  metadata = {},
} = {}) {
  assertBenchmarkScenario(scenario);
  const normalizedUsage = normalizeBenchmarkUsage(usage);
  const profile = PROFILE_BY_MODE[mode];
  if (!profile) throw benchmarkError(`Unsupported benchmark mode: ${mode}`);
  const resolvedProfile = metadata.resolvedProfile ?? profile.resolvedProfile;
  normalizedModeProfile(mode, resolvedProfile);
  const normalizedDiagnostics = normalizeBenchmarkDiagnostics(diagnostics);
  const run = {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    runSetId,
    runId,
    scenarioId: scenario.scenarioId,
    mode,
    runIndex,
    recordedAt,
    usage: normalizedUsage,
    wallClockMs,
    verification,
    verificationCycles,
    comparableSteps,
    ...(normalizedDiagnostics === null ? {} : { diagnostics: normalizedDiagnostics }),
    contextUsage: normalizeBenchmarkContextUsage(contextUsage, resolvedProfile),
    quality: normalizeBenchmarkQuality(quality),
    metadata: {
      scenarioId: scenario.scenarioId,
      mode,
      model: metadata.model ?? normalizedUsage.model,
      provider: metadata.provider ?? normalizedUsage.provider,
      promptSpecFingerprint: metadata.promptSpecFingerprint,
      projectRevision: metadata.projectRevision ?? null,
      benchmarkVersion: BENCHMARK_VERSION,
      environmentClass: metadata.environmentClass,
      requestedProfile: profile.requestedProfile,
      resolvedProfile,
      verificationCycles,
      comparableSteps,
      ...(metadata.nodeVersion ? { nodeVersion: metadata.nodeVersion } : {}),
      ...(metadata.os ? { os: metadata.os } : {}),
      ...(metadata.arch ? { arch: metadata.arch } : {}),
    },
  };
  return assertBenchmarkRun(run);
}

function sortedFinite(values) {
  return values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
}

function percentileOf(sorted, fraction) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (position - lower));
}

function statistic(values) {
  const usable = sortedFinite(values);
  if (usable.length === 0) return { count: 0, average: null, p50: null, p95: null, minimum: null, maximum: null };
  return {
    count: usable.length,
    average: Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4)),
    p50: Number(percentileOf(usable, 0.5).toFixed(4)),
    p95: Number(percentileOf(usable, 0.95).toFixed(4)),
    minimum: usable[0],
    maximum: usable.at(-1),
  };
}

// Benchmark methodology v2 favors robust statistics for skewed token
// distributions: median/IQR/MAD instead of average/stddev alone.
export function robustStatistic(values) {
  const usable = sortedFinite(values);
  if (usable.length === 0) {
    return {
      count: 0,
      average: null,
      minimum: null,
      p25: null,
      p50: null,
      p75: null,
      p90: null,
      p95: null,
      maximum: null,
      iqr: null,
      mad: null,
      outlierCount: 0,
    };
  }
  const q1 = percentileOf(usable, 0.25);
  const median = percentileOf(usable, 0.5);
  const q3 = percentileOf(usable, 0.75);
  const iqr = q3 - q1;
  const upperFence = q3 + 1.5 * iqr;
  const deviations = usable.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  return {
    count: usable.length,
    average: Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4)),
    minimum: usable[0],
    p25: Number(q1.toFixed(4)),
    p50: Number(median.toFixed(4)),
    p75: Number(q3.toFixed(4)),
    p90: Number(percentileOf(usable, 0.9).toFixed(4)),
    p95: Number(percentileOf(usable, 0.95).toFixed(4)),
    maximum: usable.at(-1),
    iqr: Number(iqr.toFixed(4)),
    mad: Number(percentileOf(deviations, 0.5).toFixed(4)),
    outlierCount: usable.filter((value) => value > upperFence).length,
  };
}

function trustedMeasurement(run) {
  return ["PROVIDER_REPORTED", "HOST_REPORTED"].includes(run.usage.source)
    && run.verification === "PASS"
    && run.metadata.model !== null
    && run.metadata.provider !== null
    && run.metadata.promptSpecFingerprint !== null
    && run.metadata.projectRevision !== null
    && run.metadata.comparableSteps !== null
    && run.metadata.comparableSteps > 0;
}

function comparablePair(left, right) {
  if (!trustedMeasurement(left) || !trustedMeasurement(right)) return false;
  const fields = [
    "scenarioId",
    "model",
    "provider",
    "promptSpecFingerprint",
    "projectRevision",
    "benchmarkVersion",
    "environmentClass",
    "nodeVersion",
    "os",
    "arch",
  ];
  return fields.every((field) => (left.metadata[field] ?? null) === (right.metadata[field] ?? null));
}

export function distributionDeltaPercent(baselineStats, candidateStats) {
  if (!baselineStats || !candidateStats) return { p50: null, p95: null };
  const p50Delta = (Number.isFinite(baselineStats.p50) && Number.isFinite(candidateStats.p50) && baselineStats.p50 > 0)
    ? Number((((candidateStats.p50 - baselineStats.p50) / baselineStats.p50) * 100).toFixed(4))
    : null;
  const p95Delta = (Number.isFinite(baselineStats.p95) && Number.isFinite(candidateStats.p95) && baselineStats.p95 > 0)
    ? Number((((candidateStats.p95 - baselineStats.p95) / baselineStats.p95) * 100).toFixed(4))
    : null;
  return { p50: p50Delta, p95: p95Delta };
}

function legacyComparisonForMode(directRuns, modeRuns) {
  const directByIndex = new Map(directRuns.map((run) => [run.runIndex, run]));
  const pairs = modeRuns
    .map((run) => ({ variant: run, direct: directByIndex.get(run.runIndex) }))
    .filter((pair) => pair.direct && comparablePair(pair.direct, pair.variant));
  const tokenOverheads = pairs
    .filter(({ direct, variant }) => Number.isFinite(direct.usage.totalTokens) && Number.isFinite(variant.usage.totalTokens) && direct.usage.totalTokens > 0)
    .map(({ direct, variant }) => ((variant.usage.totalTokens - direct.usage.totalTokens) / direct.usage.totalTokens) * 100);
  const timeOverheads = pairs
    .filter(({ direct, variant }) => Number.isFinite(direct.wallClockMs) && Number.isFinite(variant.wallClockMs) && direct.wallClockMs > 0)
    .map(({ direct, variant }) => ((variant.wallClockMs - direct.wallClockMs) / direct.wallClockMs) * 100);
  const tokenStats = statistic(tokenOverheads);
  const timeStats = statistic(timeOverheads);
  const claimAllowed = tokenStats.count > 0 && timeStats.count > 0;
  return {
    comparablePairs: pairs.length,
    tokenComparablePairs: tokenStats.count,
    timeComparablePairs: timeStats.count,
    tokenOverheadPercent: { p50: tokenStats.p50, p95: tokenStats.p95 },
    timeOverheadPercent: { p50: timeStats.p50, p95: timeStats.p95 },
    claimStatus: claimAllowed ? "OBSERVATIONAL" : "NOT_COMPARABLE",
    claimAllowed,
    reason: claimAllowed
      ? "Trusted usage, actual timing, verification, and matching comparability metadata are present."
      : "Efficiency claims require trusted usage, actual timing, PASS verification, positive comparable steps, and matching metadata.",
  };
}

function comparisonForMode(directRuns, modeRuns) {
  const directByIndex = new Map(directRuns.map((run) => [run.runIndex, run]));
  const pairs = modeRuns
    .map((run) => ({ variant: run, direct: directByIndex.get(run.runIndex) }))
    .filter((pair) => pair.direct && comparablePair(pair.direct, pair.variant));

  const validTokenPairs = pairs.filter(({ direct, variant }) => (
    Number.isFinite(direct.usage?.totalTokens)
    && Number.isFinite(variant.usage?.totalTokens)
    && direct.usage.totalTokens > 0
  ));
  const validTimePairs = pairs.filter(({ direct, variant }) => (
    Number.isFinite(direct.wallClockMs)
    && Number.isFinite(variant.wallClockMs)
    && direct.wallClockMs > 0
  ));

  const comparableDirectTokens = validTokenPairs.map(({ direct }) => direct.usage.totalTokens);
  const comparableCandidateTokens = validTokenPairs.map(({ variant }) => variant.usage.totalTokens);

  const comparableDirectStats = robustStatistic(comparableDirectTokens);
  const comparableCandidateStats = robustStatistic(comparableCandidateTokens);

  const distDelta = distributionDeltaPercent(comparableDirectStats, comparableCandidateStats);

  const lowBaselineThreshold = (Number.isFinite(comparableDirectStats.p50) && comparableDirectStats.p50 > 0)
    ? Number((comparableDirectStats.p50 * LOW_BASELINE_RATIO).toFixed(4))
    : null;

  const pairedRuns = validTokenPairs.map(({ direct, variant }) => {
    const directTokens = direct.usage.totalTokens;
    const candidateTokens = variant.usage.totalTokens;
    const pairedOverhead = Number((((candidateTokens - directTokens) / directTokens) * 100).toFixed(4));
    const absoluteDelta = candidateTokens - directTokens;
    const baselineRegime = (lowBaselineThreshold !== null && directTokens < lowBaselineThreshold)
      ? "LOW_BASELINE_TOKEN_REGIME"
      : "NORMAL";
    return {
      runIndex: variant.runIndex,
      directTokens,
      candidateTokens,
      absoluteDeltaTokens: absoluteDelta,
      pairedOverheadPercent: pairedOverhead,
      baselineRegime,
    };
  });

  const tokenOverheads = validTokenPairs.map(({ direct, variant }) => (
    ((variant.usage.totalTokens - direct.usage.totalTokens) / direct.usage.totalTokens) * 100
  ));
  const timeOverheads = validTimePairs.map(({ direct, variant }) => (
    ((variant.wallClockMs - direct.wallClockMs) / direct.wallClockMs) * 100
  ));

  const tokenStats = statistic(tokenOverheads);
  const timeStats = statistic(timeOverheads);
  const claimAllowed = tokenStats.count > 0 && timeStats.count > 0;

  const lowBaselinePairCount = pairedRuns.filter((p) => p.baselineRegime === "LOW_BASELINE_TOKEN_REGIME").length;

  return {
    comparablePairs: pairs.length,
    tokenComparablePairs: tokenStats.count,
    timeComparablePairs: timeStats.count,
    tokenOverheadPercent: { p50: tokenStats.p50, p95: tokenStats.p95 },
    pairedOverheadPercent: { p50: tokenStats.p50, p95: tokenStats.p95 },
    distributionDeltaPercent: distDelta,
    timeOverheadPercent: { p50: timeStats.p50, p95: timeStats.p95 },
    pairedRatioDiagnostics: {
      pairCount: pairs.length,
      baselineMinimum: comparableDirectStats.minimum,
      baselineP25: comparableDirectStats.p25,
      baselineP50: comparableDirectStats.p50,
      lowBaselineThreshold,
      lowBaselinePairCount,
    },
    pairedRuns,
    claimStatus: claimAllowed ? "OBSERVATIONAL" : "NOT_COMPARABLE",
    claimAllowed,
    reason: claimAllowed
      ? "Trusted usage, actual timing, verification, and matching comparability metadata are present."
      : "Efficiency claims require trusted usage, actual timing, PASS verification, positive comparable steps, and matching metadata.",
  };
}

function contextUsageAggregate(runs, statisticFn = statistic) {
  const contextUsages = runs.map(contextUsageForRun);
  const totals = contextUsages.map(measuredContextTokens);
  return {
    sources: [...new Set(contextUsages.map((contextUsage) => contextUsage.source))].sort(),
    profiles: [...new Set(contextUsages.map((contextUsage) => contextUsage.profile).filter(Boolean))].sort(),
    measuredRuns: totals.filter((value) => value !== null).length,
    totalTokens: statisticFn(totals),
    items: Object.fromEntries(BENCHMARK_CONTEXT_USAGE_ITEMS.map((item) => [
      item,
      statisticFn(contextUsages.map((contextUsage) => contextUsage.items[item])),
    ])),
  };
}

function qualityAggregate(runs, statisticFn = statistic) {
  const quality = runs.map((run) => normalizeBenchmarkQuality(run.quality));
  return {
    sources: [...new Set(quality.map((item) => item.source))].sort(),
    scores: Object.fromEntries(BENCHMARK_QUALITY_FIELDS.map((field) => [
      field,
      statisticFn(quality.map((item) => item.scores[field])),
    ])),
  };
}

function contextInflationForScenario(balancedRuns, adaptiveRuns) {
  const lightRuns = adaptiveRuns.filter((run) => run.metadata.resolvedProfile === "light");
  const balancedByIndex = new Map(balancedRuns.map((run) => [run.runIndex, run]));
  const pairs = lightRuns
    .map((light) => ({
      light,
      balanced: balancedByIndex.get(light.runIndex),
    }))
    .map((pair) => ({
      ...pair,
      lightTotal: pair.light ? measuredContextTokens(contextUsageForRun(pair.light)) : null,
      balancedTotal: pair.balanced ? measuredContextTokens(contextUsageForRun(pair.balanced)) : null,
    }))
    .filter((pair) => pair.light && pair.balanced && pair.lightTotal !== null && pair.balancedTotal !== null);
  const inflatedPairs = pairs.filter((pair) => pair.lightTotal > pair.balancedTotal);
  const status = lightRuns.length === 0
    ? "NOT_COMPARABLE"
    : pairs.length === 0
      ? "NOT_COMPARABLE"
      : inflatedPairs.length > 0 ? "CONTEXT_INFLATION" : "NOT_DETECTED";
  return {
    status,
    comparablePairs: pairs.length,
    inflatedPairs: inflatedPairs.length,
    lightContextTokens: statistic(pairs.map((pair) => pair.lightTotal)),
    balancedContextTokens: statistic(pairs.map((pair) => pair.balancedTotal)),
    blocking: false,
    reason: status === "CONTEXT_INFLATION"
      ? "Host-reported LIGHT context exceeded the comparable BALANCED context in at least one repeated run."
      : status === "NOT_DETECTED"
        ? "Comparable host-reported LIGHT and BALANCED context values did not show inflation."
        : lightRuns.length === 0
          ? "The adaptive mode did not resolve to LIGHT for this scenario."
          : "Context inflation requires complete HOST_REPORTED context items for matching LIGHT and BALANCED runs.",
  };
}

// Deterministic benchmark-level outlier classification. The IQR rule is an
// analysis convention, not protocol truth; it never changes lifecycle state.
export function analyzeTokenOutliers(runsByMode) {
  return {
    policy: OUTLIER_POLICY,
    minimumSamples: OUTLIER_MINIMUM_SAMPLES,
    modes: Object.fromEntries(BENCHMARK_MODES.map((mode) => [
      mode,
      tokenOutlierAnalysisForMode(runsByMode[mode] ?? []),
    ])),
  };
}

function tokenOutlierAnalysisForMode(runs) {
  const measured = runs.filter((run) => Number.isFinite(run.usage.totalTokens));
  const notEnough = {
    sampleCount: runs.length,
    measuredCount: measured.length,
    status: "NOT_ENOUGH_SAMPLES",
    q1: null,
    q3: null,
    iqr: null,
    median: null,
    upperFence: null,
    outliers: [],
  };
  if (measured.length < OUTLIER_MINIMUM_SAMPLES) return notEnough;
  const stats = robustStatistic(measured.map((run) => run.usage.totalTokens));
  const medianModelTurns = robustStatistic(measured.map((run) => run.diagnostics?.modelTurns ?? null)).p50;
  const medianToolCalls = robustStatistic(measured.map((run) => run.diagnostics?.toolCalls ?? null)).p50;
  const upperFence = stats.p75 + 1.5 * stats.iqr;
  const outliers = measured
    .filter((run) => run.usage.totalTokens > upperFence)
    .map((run) => ({
      runId: run.runId,
      runIndex: run.runIndex,
      totalTokens: run.usage.totalTokens,
      scenarioMedianTokens: stats.p50,
      ratioToMedian: stats.p50 > 0 ? Number((run.usage.totalTokens / stats.p50).toFixed(4)) : null,
      reasons: ["TOKEN_IQR_OUTLIER"],
      diagnosticSignals: evaluateRunawaySignals(run, { medianModelTurns, medianToolCalls, tokenOutlier: true }),
    }))
    .sort((left, right) => left.runIndex - right.runIndex);
  return {
    sampleCount: runs.length,
    measuredCount: measured.length,
    status: "MEASURED",
    q1: stats.p25,
    q3: stats.p75,
    iqr: stats.iqr,
    median: stats.p50,
    upperFence: Number(upperFence.toFixed(4)),
    outliers,
  };
}

// Observational tail stability status; the thresholds are benchmark policy,
// never lifecycle policy.
export function classifyTailStatus({
  sampleCount,
  p95TokenOverheadPercent,
  outlierCount = 0,
  sampleMinimum = TAIL_SAMPLE_MINIMUM,
  regressionPercent = LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
} = {}) {
  if (!Number.isInteger(sampleCount) || sampleCount < sampleMinimum) return "NOT_ENOUGH_SAMPLES";
  if (p95TokenOverheadPercent === null || p95TokenOverheadPercent === undefined) return "NOT_ENOUGH_SAMPLES";
  if (p95TokenOverheadPercent > regressionPercent) return "TAIL_REGRESSION";
  if (outlierCount > 0) return "TAIL_WARNING";
  return "TAIL_STABLE";
}

export function classifyDistributionTailStatus({
  sampleCount,
  distributionP95DeltaPercent,
  sampleMinimum = TAIL_SAMPLE_MINIMUM,
  regressionPercent = LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
} = {}) {
  if (!Number.isInteger(sampleCount) || sampleCount < sampleMinimum) return "NOT_ENOUGH_SAMPLES";
  if (distributionP95DeltaPercent === null || distributionP95DeltaPercent === undefined) return "NOT_ENOUGH_SAMPLES";
  if (distributionP95DeltaPercent > regressionPercent) return "TAIL_REGRESSION";
  return "TAIL_ACCEPTABLE";
}

export function classifyCombinedTailStatus({
  pairedStatus,
  distributionStatus,
  lowBaselinePairCount = 0,
  sampleCount,
  sampleMinimum = TAIL_SAMPLE_MINIMUM,
} = {}) {
  if (!Number.isInteger(sampleCount) || sampleCount < sampleMinimum) return "TAIL_UNRESOLVED";
  if (pairedStatus === "NOT_ENOUGH_SAMPLES" || distributionStatus === "NOT_ENOUGH_SAMPLES") return "TAIL_UNRESOLVED";
  if (distributionStatus === "TAIL_REGRESSION") return "TAIL_DISTRIBUTION_REGRESSION";
  if (pairedStatus === "TAIL_REGRESSION" && distributionStatus === "TAIL_ACCEPTABLE" && lowBaselinePairCount > 0) {
    return "TAIL_PAIRED_RATIO_SENSITIVE";
  }
  if (pairedStatus === "TAIL_STABLE" && distributionStatus === "TAIL_ACCEPTABLE") return "TAIL_CONSISTENT";
  if (pairedStatus === "TAIL_WARNING" && distributionStatus === "TAIL_ACCEPTABLE") return "TAIL_CONSISTENT";
  if (pairedStatus === distributionStatus) return "TAIL_CONSISTENT";
  return "TAIL_UNRESOLVED";
}

function diagnosticsAggregate(runs) {
  return Object.fromEntries(BENCHMARK_DIAGNOSTIC_COUNT_FIELDS.map((field) => [
    field,
    robustStatistic(runs.map((run) => run.diagnostics?.[field] ?? null)),
  ]));
}

function modeAggregateRobust(runs, { includeContextUsage = false, includeQuality = false } = {}) {
  const verificationCount = runs.filter((run) => run.verification === "PASS").length;
  const tokenPerStep = runs.map((run) => (
    Number.isFinite(run.usage.totalTokens) && Number.isInteger(run.comparableSteps) && run.comparableSteps > 0
      ? run.usage.totalTokens / run.comparableSteps
      : null
  ));
  return {
    runCount: runs.length,
    verificationSuccessRate: runs.length > 0 ? Number((verificationCount / runs.length).toFixed(4)) : null,
    usageSources: [...new Set(runs.map((run) => run.usage.source))].sort(),
    totalTokens: robustStatistic(runs.map((run) => run.usage.totalTokens)),
    wallClockMs: robustStatistic(runs.map((run) => run.wallClockMs)),
    verificationCycles: robustStatistic(runs.map((run) => run.verificationCycles)),
    comparableSteps: robustStatistic(runs.map((run) => run.comparableSteps)),
    tokensPerComparableStep: robustStatistic(tokenPerStep),
    diagnostics: diagnosticsAggregate(runs),
    ...(includeContextUsage ? { contextUsage: contextUsageAggregate(runs, robustStatistic) } : {}),
    ...(includeQuality ? { quality: qualityAggregate(runs, robustStatistic) } : {}),
  };
}

function modeAggregate(runs, { includeContextUsage = false, includeQuality = false } = {}) {
  const verificationCount = runs.filter((run) => run.verification === "PASS").length;
  const comparableSteps = runs.map((run) => run.comparableSteps);
  const tokenPerStep = runs.map((run) => (
    Number.isFinite(run.usage.totalTokens) && Number.isInteger(run.comparableSteps) && run.comparableSteps > 0
      ? run.usage.totalTokens / run.comparableSteps
      : null
  ));
  return {
    runCount: runs.length,
    verificationSuccessRate: runs.length > 0 ? Number((verificationCount / runs.length).toFixed(4)) : null,
    usageSources: [...new Set(runs.map((run) => run.usage.source))].sort(),
    totalTokens: statistic(runs.map((run) => run.usage.totalTokens)),
    wallClockMs: statistic(runs.map((run) => run.wallClockMs)),
    verificationCycles: statistic(runs.map((run) => run.verificationCycles)),
    comparableSteps: statistic(comparableSteps),
    tokensPerComparableStep: statistic(tokenPerStep),
    ...(includeContextUsage ? { contextUsage: contextUsageAggregate(runs) } : {}),
    ...(includeQuality ? { quality: qualityAggregate(runs) } : {}),
  };
}

function lightObjectivesFor(scenario, comparisons) {
  if (scenario.expectedProfile !== "light") return null;
  return {
    p50TokenOverheadPercent: LIGHT_EFFICIENCY_OBJECTIVES.p50TokenOverheadPercent,
    p95TokenOverheadPercent: LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
    status: comparisons.forgeloopAdaptive?.claimAllowed ? "OBSERVATIONAL" : "NOT_VERIFIED",
    p50Pass: comparisons.forgeloopAdaptive?.tokenOverheadPercent.p50 === null
      ? null
      : comparisons.forgeloopAdaptive.tokenOverheadPercent.p50 <= LIGHT_EFFICIENCY_OBJECTIVES.p50TokenOverheadPercent,
    p95Pass: comparisons.forgeloopAdaptive?.tokenOverheadPercent.p95 === null
      ? null
      : comparisons.forgeloopAdaptive.tokenOverheadPercent.p95 <= LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
  };
}

export function aggregateBenchmarkRuns({ scenario, runs } = {}) {
  assertBenchmarkScenario(scenario);
  if (!Array.isArray(runs) || runs.length === 0) throw benchmarkError("runs must contain at least one benchmark run");
  for (const run of runs) assertBenchmarkRun(run);
  const runSetIds = new Set(runs.map((run) => run.runSetId));
  if (runSetIds.size !== 1) throw benchmarkError("all runs in an aggregate must belong to one run set");
  if (runs.some((run) => run.scenarioId !== scenario.scenarioId)) {
    throw benchmarkError("aggregate runs must belong to the supplied scenario");
  }
  const byMode = Object.fromEntries(BENCHMARK_MODES.map((mode) => [
    mode,
    runs.filter((run) => run.mode === mode).sort((left, right) => left.runIndex - right.runIndex),
  ]));
  const duplicateKeys = new Set();
  for (const run of runs) {
    const key = `${run.mode}:${run.runIndex}`;
    if (duplicateKeys.has(key)) throw benchmarkError(`duplicate benchmark run: ${key}`);
    duplicateKeys.add(key);
  }
  const directRuns = byMode.direct;
  const includeContextUsage = runs.some((run) => Object.prototype.hasOwnProperty.call(run, "contextUsage"));
  const includeQuality = runs.some((run) => Object.prototype.hasOwnProperty.call(run, "quality"));
  const legacy = runs.every((run) => run.benchmarkVersion === "1");
  if (legacy) {
    const comparisons = Object.fromEntries(BENCHMARK_MODES.map((mode) => [
      mode,
      mode === "direct" ? null : legacyComparisonForMode(directRuns, byMode[mode]),
    ]));
    const lightObjectives = lightObjectivesFor(scenario, comparisons);
    return {
      schemaVersion: 1,
      benchmarkVersion: "1",
      runSetId: runs[0].runSetId,
      scenarioId: scenario.scenarioId,
      expectedProfile: scenario.expectedProfile,
      modeAggregates: Object.fromEntries(BENCHMARK_MODES.map((mode) => [mode, modeAggregate(byMode[mode], { includeContextUsage, includeQuality })])),
      comparisons,
      lightObjectives,
      sourcePolicy: "PROVIDER_REPORTED_OR_HOST_REPORTED_ONLY",
      claimsAllowed: Object.values(comparisons).some((comparison) => comparison?.claimAllowed === true),
      generatedFromRunCount: runs.length,
      ...(includeContextUsage
        ? { contextInflation: contextInflationForScenario(byMode.forgeloopBalanced, byMode.forgeloopAdaptive) }
        : {}),
    };
  }
  const comparisons = Object.fromEntries(BENCHMARK_MODES.map((mode) => [
    mode,
    mode === "direct" ? null : comparisonForMode(directRuns, byMode[mode]),
  ]));
  const lightObjectives = lightObjectivesFor(scenario, comparisons);
  const outlierAnalysis = analyzeTokenOutliers(byMode);
  const comparisonsWithTail = Object.fromEntries(BENCHMARK_MODES.map((mode) => {
    const comparison = comparisons[mode];
    if (comparison === null) return [mode, null];
    const outlierCount = outlierAnalysis.modes[mode].outliers.length;
    const pairedStatus = classifyTailStatus({
      sampleCount: comparison.tokenComparablePairs,
      p95TokenOverheadPercent: comparison.tokenOverheadPercent.p95,
      outlierCount,
    });
    const distributionStatus = classifyDistributionTailStatus({
      sampleCount: comparison.tokenComparablePairs,
      distributionP95DeltaPercent: comparison.distributionDeltaPercent.p95,
    });
    const combinedInterpretation = classifyCombinedTailStatus({
      pairedStatus,
      distributionStatus,
      lowBaselinePairCount: comparison.pairedRatioDiagnostics?.lowBaselinePairCount ?? 0,
      sampleCount: comparison.tokenComparablePairs,
    });
    return [mode, {
      ...comparison,
      tail: {
        sampleMinimum: TAIL_SAMPLE_MINIMUM,
        sampleCount: comparison.tokenComparablePairs,
        p95TokenOverheadPercent: comparison.tokenOverheadPercent.p95,
        pairedOverheadP95Percent: comparison.pairedOverheadPercent.p95,
        distributionP95DeltaPercent: comparison.distributionDeltaPercent.p95,
        outlierCount,
        status: pairedStatus,
        pairedStatus,
        distributionStatus,
        combinedInterpretation,
      },
    }];
  }));
  return {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    runSetId: runs[0].runSetId,
    scenarioId: scenario.scenarioId,
    expectedProfile: scenario.expectedProfile,
    modeAggregates: Object.fromEntries(BENCHMARK_MODES.map((mode) => [mode, modeAggregateRobust(byMode[mode], { includeContextUsage, includeQuality })])),
    comparisons: comparisonsWithTail,
    lightObjectives,
    sourcePolicy: "PROVIDER_REPORTED_OR_HOST_REPORTED_ONLY",
    claimsAllowed: Object.values(comparisons).some((comparison) => comparison?.claimAllowed === true),
    generatedFromRunCount: runs.length,
    ...(includeContextUsage
      ? { contextInflation: contextInflationForScenario(byMode.forgeloopBalanced, byMode.forgeloopAdaptive) }
      : {}),
    outlierAnalysis,
  };
}

export function benchmarkScenarioFingerprint(scenario) {
  assertBenchmarkScenario(scenario);
  return canonicalFingerprint({
    benchmarkVersion: scenario.benchmarkVersion,
    scenarioId: scenario.scenarioId,
    description: scenario.description,
    input: scenario.input,
    expectedProfile: scenario.expectedProfile,
  });
}

export function benchmarkProfileForMode(mode) {
  if (!PROFILE_BY_MODE[mode]) throw benchmarkError(`Unsupported benchmark mode: ${mode}`);
  return { ...PROFILE_BY_MODE[mode] };
}
