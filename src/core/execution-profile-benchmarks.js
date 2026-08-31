import { canonicalFingerprint } from "./artifacts.js";
import { evaluateRoute } from "./router.js";
import { normalizeUsage } from "./usage.js";

export const BENCHMARK_VERSION = "1";
export const BENCHMARK_MODES = Object.freeze([
  "direct",
  "forgeloopBalanced",
  "forgeloopAdaptive",
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
  if (run.benchmarkVersion !== BENCHMARK_VERSION) {
    throw benchmarkError(`benchmark run benchmarkVersion must be ${BENCHMARK_VERSION}`);
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

function statistic(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (usable.length === 0) return { count: 0, average: null, p50: null, p95: null, minimum: null, maximum: null };
  const percentile = (fraction) => {
    const position = (usable.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return usable[lower];
    return usable[lower] + ((usable[upper] - usable[lower]) * (position - lower));
  };
  return {
    count: usable.length,
    average: Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4)),
    p50: Number(percentile(0.5).toFixed(4)),
    p95: Number(percentile(0.95).toFixed(4)),
    minimum: usable[0],
    maximum: usable.at(-1),
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

function comparisonForMode(directRuns, modeRuns) {
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

function contextUsageAggregate(runs) {
  const contextUsages = runs.map(contextUsageForRun);
  const totals = contextUsages.map(measuredContextTokens);
  return {
    sources: [...new Set(contextUsages.map((contextUsage) => contextUsage.source))].sort(),
    profiles: [...new Set(contextUsages.map((contextUsage) => contextUsage.profile).filter(Boolean))].sort(),
    measuredRuns: totals.filter((value) => value !== null).length,
    totalTokens: statistic(totals),
    items: Object.fromEntries(BENCHMARK_CONTEXT_USAGE_ITEMS.map((item) => [
      item,
      statistic(contextUsages.map((contextUsage) => contextUsage.items[item])),
    ])),
  };
}

function qualityAggregate(runs) {
  const quality = runs.map((run) => normalizeBenchmarkQuality(run.quality));
  return {
    sources: [...new Set(quality.map((item) => item.source))].sort(),
    scores: Object.fromEntries(BENCHMARK_QUALITY_FIELDS.map((field) => [
      field,
      statistic(quality.map((item) => item.scores[field])),
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
  const comparisons = Object.fromEntries(BENCHMARK_MODES.map((mode) => [
    mode,
    mode === "direct" ? null : comparisonForMode(directRuns, byMode[mode]),
  ]));
  const lightObjectives = scenario.expectedProfile === "light"
    ? {
      p50TokenOverheadPercent: LIGHT_EFFICIENCY_OBJECTIVES.p50TokenOverheadPercent,
      p95TokenOverheadPercent: LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
      status: comparisons.forgeloopAdaptive?.claimAllowed ? "OBSERVATIONAL" : "NOT_VERIFIED",
      p50Pass: comparisons.forgeloopAdaptive?.tokenOverheadPercent.p50 === null
        ? null
        : comparisons.forgeloopAdaptive.tokenOverheadPercent.p50 <= LIGHT_EFFICIENCY_OBJECTIVES.p50TokenOverheadPercent,
      p95Pass: comparisons.forgeloopAdaptive?.tokenOverheadPercent.p95 === null
        ? null
        : comparisons.forgeloopAdaptive.tokenOverheadPercent.p95 <= LIGHT_EFFICIENCY_OBJECTIVES.p95TokenOverheadPercent,
    }
      : null;
  const includeContextUsage = runs.some((run) => Object.prototype.hasOwnProperty.call(run, "contextUsage"));
  const includeQuality = runs.some((run) => Object.prototype.hasOwnProperty.call(run, "quality"));
  return {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
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
