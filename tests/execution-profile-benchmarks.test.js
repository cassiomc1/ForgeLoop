import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { evaluateRoute } from "../src/core/router.js";
import { projectExecutionProfileContext } from "../src/core/execution-profile-context.js";
import { assertSchema, readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";
import {
  aggregateBenchmarkRuns,
  analyzeTokenOutliers,
  assertBenchmarkScenario,
  classifyCombinedTailStatus,
  classifyDistributionTailStatus,
  classifyTailStatus,
  createBenchmarkRun,
  distributionDeltaPercent,
  evaluateRunawaySignals,
  normalizeBenchmarkContextUsage,
  normalizeBenchmarkDiagnostics,
  robustStatistic,
} from "../src/core/execution-profile-benchmarks.js";
import { readBenchmarkRunSets, readBenchmarkScenarios } from "../scripts/lib/execution-profile-benchmark-io.mjs";
import { removeTempTree } from "./helpers/rm-safe.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureAdapter = path.join(repositoryRoot, "tests", "fixtures", "execution-profile-benchmark-adapter.mjs");
const finalizerAdapter = path.join(repositoryRoot, "tests", "fixtures", "execution-profile-benchmark-finalizer-adapter.mjs");

test("all benchmark scenarios are schema-valid and resolve to their expected profiles", async () => {
  const schema = await readSchema("execution-profile-benchmark-scenario", getPackageRoot());
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  assert.equal(scenarios.length, 7);
  assert.ok(scenarios.some((scenario) => scenario.scenarioId === "novatask-saas-landing-page"));
  for (const scenario of scenarios) {
    assertSchema(scenario, schema, scenario.scenarioId);
    assert.equal(evaluateRoute(scenario.input).executionProfile.resolved, scenario.expectedProfile, scenario.scenarioId);
    assertBenchmarkScenario(scenario);
  }
  const invalidProfile = { ...scenarios[0], expectedProfile: scenarios[0].expectedProfile === "light" ? "balanced" : "light" };
  assert.throws(() => assertBenchmarkScenario(invalidProfile), /does not match the default route resolution/);
});

test("profile-aware context changes optional depth without permitting a safety downgrade", () => {
  const route = evaluateRoute({
    workType: "release",
    surfaces: ["ci"],
    risks: ["publication"],
    platforms: ["ci"],
  }, { requestedProfile: "light" });
  assert.equal(route.executionProfile.resolved, "full");
  assert.equal(route.executionProfile.escalated, true);
  const context = projectExecutionProfileContext({
    taskId: "profile-context-fixture",
    contract: {
      objective: "Release fixture.",
      deliverables: ["package.json"],
      constraints: ["Keep protocol invariants."],
      verification: [{ id: "release-check", text: "release check", type: "VERIFICATION" }],
    },
    route,
    state: { phase: "EXECUTING", selectedGuides: ["clean", "test", "security"] },
    nextAction: { nextAction: "START_VERIFICATION" },
  });
  assert.equal(context.contextPolicy.contextDepth, "expanded");
  assert.ok(context.contextPolicy.allowedOptionalContext.includes("risk-context"));
  assert.equal(context.invariants.lifecyclePhasesPreserved, true);
  assert.equal(context.invariants.requiredGatesPreserved, true);
  assert.equal(context.invariants.lifecyclePhaseSkippingAllowed, false);
});

test("context usage is host-observed, profile-bound, and never estimated", () => {
  assert.deepEqual(normalizeBenchmarkContextUsage(undefined, "light"), {
    source: "UNKNOWN",
    profile: "light",
    items: {
      taskContext: null,
      guides: null,
      history: null,
      protocolInstructions: null,
      repositoryContext: null,
      other: null,
    },
  });
  assert.throws(() => normalizeBenchmarkContextUsage({
    source: "UNKNOWN",
    profile: "light",
    items: { taskContext: 10 },
  }, "light"), /UNKNOWN context usage/);
  assert.throws(() => normalizeBenchmarkContextUsage({
    source: "HOST_REPORTED",
    profile: "balanced",
    items: {},
  }, "light"), /match the resolved benchmark profile/);
});

test("aggregates preserve unavailable telemetry and permit only comparable observations", async () => {
  const scenario = {
    schemaVersion: 1,
    benchmarkVersion: "2",
    scenarioId: "documentation-correction",
    description: "Fixture scenario.",
    input: { workType: "documentation", surfaces: [], risks: [], platforms: [] },
    expectedProfile: "light",
    measurements: {
      direct: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null, wallClockMs: null, verification: "NOT_AVAILABLE" },
      forgeloopBalanced: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null, wallClockMs: null, verification: "NOT_AVAILABLE" },
      forgeloopAdaptive: { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null, wallClockMs: null, verification: "NOT_AVAILABLE" },
    },
  };
  const runs = [];
  for (const mode of ["direct", "forgeloopBalanced", "forgeloopAdaptive"]) {
    runs.push(createBenchmarkRun({
      runSetId: "fixture-set",
      runId: `run-${mode}-001`,
      runIndex: 1,
      scenario,
      mode,
      usage: {
        inputTokens: 50,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 100,
        costUsd: 0,
        model: "fixture-model",
        provider: "fixture-provider",
        source: "HOST_REPORTED",
      },
      wallClockMs: 100,
      verification: "PASS",
      verificationCycles: 1,
      comparableSteps: 2,
      contextUsage: {
        source: "HOST_REPORTED",
        profile: mode === "direct" ? null : mode === "forgeloopBalanced" ? "balanced" : "light",
        items: {
          taskContext: mode === "direct" ? 100 : mode === "forgeloopBalanced" ? 80 : 60,
          guides: 0,
          history: 0,
          protocolInstructions: 0,
          repositoryContext: 0,
          other: 0,
        },
      },
      metadata: {
        promptSpecFingerprint: "fixture-prompt",
        projectRevision: "a".repeat(40),
        environmentClass: "darwin-node20",
        resolvedProfile: mode === "direct" ? null : mode === "forgeloopBalanced" ? "balanced" : "light",
      },
    }));
  }
  const aggregate = aggregateBenchmarkRuns({ scenario, runs });
  assert.equal(aggregate.claimsAllowed, true);
  assert.equal(aggregate.comparisons.forgeloopAdaptive.claimStatus, "OBSERVATIONAL");
  assert.equal(aggregate.lightObjectives.status, "OBSERVATIONAL");
  assert.equal(aggregate.contextInflation.status, "NOT_DETECTED");
  assert.equal(aggregate.modeAggregates.forgeloopAdaptive.contextUsage.totalTokens.p50, 60);
  assert.throws(() => createBenchmarkRun({
    runSetId: "fixture-set",
    runId: "run-invalid-profile-001",
    runIndex: 1,
    scenario,
    mode: "forgeloopAdaptive",
    usage: { source: "UNKNOWN" },
    wallClockMs: null,
    metadata: {
      promptSpecFingerprint: "fixture-prompt",
      environmentClass: "darwin-node20",
      resolvedProfile: "unsupported",
    },
  }), /resolvedProfile must be light, balanced, or full/);
  assert.throws(() => createBenchmarkRun({
    runSetId: "fixture-set",
    runId: "run-invalid-001",
    runIndex: 1,
    scenario,
    mode: "direct",
    usage: { totalTokens: 100, source: "UNKNOWN" },
    wallClockMs: 10,
    metadata: {
      promptSpecFingerprint: "fixture-prompt",
      environmentClass: "darwin-node20",
      resolvedProfile: null,
    },
  }), /UNKNOWN usage/);
});

test("runner records raw runs, writes reproducible aggregates, and never claims unknown data", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "forgeloop-benchmark-results-"));
  try {
    const runner = path.join(repositoryRoot, "scripts", "run-execution-profile-benchmarks.mjs");
    const result = JSON.parse(execFileSync(process.execPath, [
      runner,
      "--target", repositoryRoot,
      "--adapter", fixtureAdapter,
      "--runs", "2",
      "--run-set", "fixture-runner",
      "--output", output,
      "--json",
    ], { cwd: repositoryRoot, encoding: "utf8" }));
    assert.equal(result.status, "MEASURED");
    assert.equal(result.scenarioCount, 7);
    assert.equal(result.runCount, 42);
    assert.equal(result.claimsAllowed, true);

    const aggregate = JSON.parse(await readFile(
      path.join(output, "aggregate", "fixture-runner", "documentation-correction.json"),
      "utf8",
    ));
    assert.equal(aggregate.benchmarkVersion, "2");
    assert.equal(aggregate.comparisons.forgeloopAdaptive.claimStatus, "OBSERVATIONAL");
    assert.equal(aggregate.contextInflation.status, "NOT_DETECTED");
    assert.equal(aggregate.outlierAnalysis.policy, "TOKEN_IQR_1_5");
    assert.equal(aggregate.outlierAnalysis.modes.direct.outliers.length, 0);
    assert.equal(aggregate.comparisons.forgeloopAdaptive.tail.status, "NOT_ENOUGH_SAMPLES");
    assert.equal(aggregate.comparisons.forgeloopAdaptive.tail.sampleMinimum, 20);
    assert.equal(typeof aggregate.modeAggregates.forgeloopAdaptive.totalTokens.iqr, "number");
    assert.equal(typeof aggregate.modeAggregates.forgeloopAdaptive.totalTokens.mad, "number");
    assert.equal(aggregate.modeAggregates.forgeloopAdaptive.diagnostics.modelTurns.p50, 2);

    const rawRun = JSON.parse(await readFile(
      path.join(output, "raw", "fixture-runner", "documentation-correction", "forgeloopAdaptive", "run-001.json"),
      "utf8",
    ));
    assert.equal(rawRun.diagnostics.terminationReason, "COMPLETED");
    assert.deepEqual(rawRun.diagnostics.guideIds, ["fixture-guide"]);
    assert.equal(rawRun.diagnostics.executionProfile, "light");

    const reporter = path.join(repositoryRoot, "scripts", "report-execution-profile-outliers.mjs");
    const report = JSON.parse(execFileSync(process.execPath, [reporter, "--results", output, "--json"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }));
    assert.equal(report.policy, "TOKEN_IQR_1_5");
    assert.equal(report.runSetCount, 1);
    assert.equal(report.outlierCount, 0);
    assert.deepEqual(report.reports, []);

    const validator = path.join(repositoryRoot, "scripts", "validate-execution-profile-benchmarks.mjs");
    const validation = JSON.parse(execFileSync(process.execPath, [validator, "--results", output, "--json"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }));
    assert.equal(validation.status, "VALID");
    assert.equal(validation.benchmarkStatus, "MEASURED");
  } finally {
    await removeTempTree(output);
  }
});

test("runner finalizes quality after the complete host run set without changing efficiency records", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "forgeloop-benchmark-finalizer-"));
  try {
    const runner = path.join(repositoryRoot, "scripts", "run-execution-profile-benchmarks.mjs");
    const result = JSON.parse(execFileSync(process.execPath, [
      runner,
      "--target", repositoryRoot,
      "--adapter", finalizerAdapter,
      "--runs", "1",
      "--run-set", "fixture-finalizer",
      "--output", output,
      "--json",
    ], { cwd: repositoryRoot, encoding: "utf8" }));
    assert.deepEqual(result.qualityFinalization, { status: "MEASURED", recordCount: 21 });

    const uiRun = JSON.parse(await readFile(
      path.join(output, "raw", "fixture-finalizer", "static-landing-page", "direct", "run-001.json"),
      "utf8",
    ));
    const codeRun = JSON.parse(await readFile(
      path.join(output, "raw", "fixture-finalizer", "api-feature", "direct", "run-001.json"),
      "utf8",
    ));
    assert.equal(uiRun.quality.source, "EXTERNAL_REPORTED");
    assert.equal(uiRun.quality.scores.visualQuality, 4);
    assert.equal(codeRun.quality.source, "UNKNOWN");
    assert.equal(typeof uiRun.wallClockMs, "number");
    assert.equal(typeof codeRun.wallClockMs, "number");
  } finally {
    await removeTempTree(output);
  }
});

test("summary reports NOT_MEASURED when no provider or host run history exists", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "forgeloop-empty-benchmark-"));
  try {
    const summary = path.join(repositoryRoot, "scripts", "summarize-execution-profile-benchmarks.mjs");
    const result = JSON.parse(execFileSync(process.execPath, [summary, "--results", output, "--json"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }));
    assert.equal(result.status, "NOT_MEASURED");
    assert.equal(result.claimsAllowed, false);
    assert.equal(result.scenarioCount, 7);
  } finally {
    await removeTempTree(output);
  }
});

test("robust statistics report median spread and IQR outliers without inventing values", () => {
  assert.deepEqual(robustStatistic([]), {
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
  });
  assert.equal(robustStatistic([null, "x", Number.NaN]).count, 0);
  const stats = robustStatistic([100, 102, 101, 99, 103, 100, 400]);
  assert.equal(stats.count, 7);
  assert.equal(stats.minimum, 99);
  assert.equal(stats.p25, 100);
  assert.equal(stats.p50, 101);
  assert.equal(stats.p75, 102.5);
  assert.equal(stats.iqr, 2.5);
  assert.equal(stats.mad, 1);
  assert.equal(stats.outlierCount, 1);
  assert.equal(stats.maximum, 400);
});

test("diagnostics stay nullable, reject unknown telemetry, and order signals deterministically", () => {
  assert.equal(normalizeBenchmarkDiagnostics(undefined), null);
  assert.equal(normalizeBenchmarkDiagnostics(null), null);
  const normalized = normalizeBenchmarkDiagnostics({
    flags: ["UNEXPECTED_RETRY", "EXCESSIVE_MODEL_TURNS"],
    modelTurns: 4,
  });
  assert.deepEqual(normalized.flags, ["EXCESSIVE_MODEL_TURNS", "UNEXPECTED_RETRY"]);
  assert.equal(normalized.modelTurns, 4);
  assert.equal(normalized.toolCalls, null);
  assert.equal(normalized.terminationReason, null);
  assert.deepEqual(normalized.guideIds, []);
  assert.throws(() => normalizeBenchmarkDiagnostics({ invented: 1 }), /unsupported field/u);
  assert.throws(() => normalizeBenchmarkDiagnostics({ flags: ["NOT_A_SIGNAL"] }), /unsupported signal/u);
  assert.throws(() => normalizeBenchmarkDiagnostics({ modelTurns: -1 }), /non-negative integer/u);
});

test("runaway signals preserve host flags and derive only from recorded diagnostics", () => {
  assert.deepEqual(evaluateRunawaySignals(null), []);
  assert.deepEqual(
    evaluateRunawaySignals(
      { verificationCycles: 1, diagnostics: { modelTurns: 9, toolCalls: 15, retries: 1 } },
      { medianModelTurns: 3, medianToolCalls: 7 },
    ),
    ["EXCESSIVE_MODEL_TURNS", "EXCESSIVE_TOOL_CALLS", "UNEXPECTED_RETRY"],
  );
  assert.deepEqual(evaluateRunawaySignals({ verificationCycles: 2 }), ["EXCESSIVE_VERIFICATION_CYCLES"]);
  assert.deepEqual(evaluateRunawaySignals({ diagnostics: { contextRefreshes: 2 } }), ["REPEATED_CONTEXT_REFRESH"]);
  assert.deepEqual(evaluateRunawaySignals({ diagnostics: { correctionCycles: 3 } }), ["CORRECTION_LOOP"]);
  assert.deepEqual(
    evaluateRunawaySignals({ diagnostics: { flags: ["HOST_RETRY"] } }, { tokenOutlier: true }),
    ["HOST_RETRY"],
  );
  assert.deepEqual(evaluateRunawaySignals({}, { tokenOutlier: true }), ["UNKNOWN_TOKEN_SPIKE"]);
});

test("token outlier classification uses the IQR fence and explains spikes with diagnostics", () => {
  const runsFor = (tokensByIndex) => tokensByIndex.map((totalTokens, index) => ({
    runId: `run-spike-${index + 1}`,
    runIndex: index + 1,
    usage: { totalTokens },
    diagnostics: { modelTurns: index === tokensByIndex.length - 1 ? 12 : 3 },
  }));
  const sparse = analyzeTokenOutliers({
    direct: runsFor([100, 101, 99]),
    forgeloopBalanced: [],
    forgeloopAdaptive: [],
  });
  assert.equal(sparse.policy, "TOKEN_IQR_1_5");
  assert.equal(sparse.minimumSamples, 4);
  assert.equal(sparse.modes.direct.status, "NOT_ENOUGH_SAMPLES");
  assert.equal(sparse.modes.forgeloopBalanced.sampleCount, 0);

  const measured = analyzeTokenOutliers({
    direct: runsFor([100, 101, 99, 100, 900]),
    forgeloopBalanced: [],
    forgeloopAdaptive: [],
  }).modes.direct;
  assert.equal(measured.status, "MEASURED");
  assert.equal(measured.median, 100);
  assert.equal(measured.outliers.length, 1);
  assert.equal(measured.outliers[0].runIndex, 5);
  assert.equal(measured.outliers[0].totalTokens, 900);
  assert.equal(measured.outliers[0].ratioToMedian, 9);
  assert.deepEqual(measured.outliers[0].reasons, ["TOKEN_IQR_OUTLIER"]);
  assert.deepEqual(measured.outliers[0].diagnosticSignals, ["EXCESSIVE_MODEL_TURNS"]);
});

test("tail stability status distinguishes sample, regression, warning, and stable states", () => {
  assert.equal(classifyTailStatus({ sampleCount: 19, p95TokenOverheadPercent: 10 }), "NOT_ENOUGH_SAMPLES");
  assert.equal(classifyTailStatus({ sampleCount: 20, p95TokenOverheadPercent: null }), "NOT_ENOUGH_SAMPLES");
  assert.equal(classifyTailStatus({ sampleCount: 20, p95TokenOverheadPercent: 61 }), "TAIL_REGRESSION");
  assert.equal(classifyTailStatus({ sampleCount: 20, p95TokenOverheadPercent: 60 }), "TAIL_STABLE");
  assert.equal(classifyTailStatus({ sampleCount: 20, p95TokenOverheadPercent: 10, outlierCount: 2 }), "TAIL_WARNING");
  assert.equal(classifyTailStatus({ sampleCount: 20, p95TokenOverheadPercent: 10 }), "TAIL_STABLE");
});

test("distribution delta compares candidate and baseline distribution percentiles directly", () => {
  assert.deepEqual(distributionDeltaPercent({ p50: 100, p95: 100 }, { p50: 110, p95: 120 }), { p50: 10, p95: 20 });
  assert.deepEqual(distributionDeltaPercent(null, { p50: 100, p95: 100 }), { p50: null, p95: null });
  assert.deepEqual(distributionDeltaPercent({ p50: 0, p95: 0 }, { p50: 100, p95: 100 }), { p50: null, p95: null });
});

test("paired denominator sensitivity: low baseline values inflate paired overhead beyond distribution delta", () => {
  const directRuns = [100, 100, 20];
  const adaptiveRuns = [110, 110, 50];
  const directStats = robustStatistic(directRuns);
  const adaptiveStats = robustStatistic(adaptiveRuns);
  const distDelta = distributionDeltaPercent(directStats, adaptiveStats);
  
  // Paired overheads: (110-100)/100 = 10%, (110-100)/100 = 10%, (50-20)/20 = 150%
  const pairedOverheads = [10, 10, 150];
  const pairedP95 = robustStatistic(pairedOverheads).p95;

  assert.ok(pairedP95 > 100, `paired P95 (${pairedP95}%) should reflect low denominator spike`);
  assert.ok(distDelta.p95 < 20, `distribution P95 delta (${distDelta.p95}%) remains modest`);
});

test("low baseline classification and combined tail interpretation identify ratio sensitivity", () => {
  assert.equal(classifyDistributionTailStatus({ sampleCount: 20, distributionP95DeltaPercent: 13.2 }), "TAIL_ACCEPTABLE");
  assert.equal(classifyDistributionTailStatus({ sampleCount: 20, distributionP95DeltaPercent: 65 }), "TAIL_REGRESSION");
  assert.equal(classifyDistributionTailStatus({ sampleCount: 19, distributionP95DeltaPercent: 10 }), "NOT_ENOUGH_SAMPLES");

  assert.equal(classifyCombinedTailStatus({
    pairedStatus: "TAIL_REGRESSION",
    distributionStatus: "TAIL_ACCEPTABLE",
    lowBaselinePairCount: 7,
    sampleCount: 20,
  }), "TAIL_PAIRED_RATIO_SENSITIVE");

  assert.equal(classifyCombinedTailStatus({
    pairedStatus: "TAIL_REGRESSION",
    distributionStatus: "TAIL_REGRESSION",
    lowBaselinePairCount: 0,
    sampleCount: 20,
  }), "TAIL_DISTRIBUTION_REGRESSION");

  assert.equal(classifyCombinedTailStatus({
    pairedStatus: "TAIL_STABLE",
    distributionStatus: "TAIL_ACCEPTABLE",
    lowBaselinePairCount: 0,
    sampleCount: 20,
  }), "TAIL_CONSISTENT");

  assert.equal(classifyCombinedTailStatus({
    pairedStatus: "NOT_ENOUGH_SAMPLES",
    distributionStatus: "NOT_ENOUGH_SAMPLES",
    lowBaselinePairCount: 2,
    sampleCount: 18,
  }), "TAIL_UNRESOLVED");
});

test("benchmark tiers bound the runner repetition counts", () => {
  const runner = path.join(repositoryRoot, "scripts", "run-execution-profile-benchmarks.mjs");
  const attempt = (args) => {
    try {
      execFileSync(process.execPath, [runner, ...args], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return null;
    } catch (error) {
      return error.stderr ?? "";
    }
  };
  assert.match(attempt(["--tier", "huge", "--adapter", fixtureAdapter, "--json"]), /--tier must be one of smoke, evidence, tail/u);
  assert.match(attempt(["--tier", "smoke", "--runs", "4", "--adapter", fixtureAdapter, "--json"]), /--runs must be between 1 and 3/u);
  assert.match(attempt(["--tier", "tail", "--runs", "10", "--adapter", fixtureAdapter, "--json"]), /--runs must be between 20 and 30/u);
});

test("committed benchmark history, when present, is complete and reproducible", async () => {
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  const aggregateSchema = await readSchema("execution-profile-benchmark-aggregate", getPackageRoot());
  const resultsDirectory = path.join(repositoryRoot, "benchmarks", "execution-profiles", "results");
  const runSets = await readBenchmarkRunSets(resultsDirectory);
  for (const runSet of runSets) {
    for (const scenario of scenarios) {
      const runs = runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId);
      assert.ok(runs.length > 0, `${runSet.runSetId}/${scenario.scenarioId} must not be partial`);
      const modeCounts = ["direct", "forgeloopBalanced", "forgeloopAdaptive"]
        .map((mode) => runs.filter((run) => run.mode === mode).length);
      assert.equal(new Set(modeCounts).size, 1, `${runSet.runSetId}/${scenario.scenarioId} mode counts must match`);
      const aggregate = aggregateBenchmarkRuns({ scenario, runs });
      const stored = JSON.parse(await readFile(
        path.join(resultsDirectory, "aggregate", runSet.runSetId, `${scenario.scenarioId}.json`),
        "utf8",
      ));
      assertSchema(stored, aggregateSchema, `${runSet.runSetId}/${scenario.scenarioId} aggregate`);
      assert.deepEqual(stored, aggregate, `${runSet.runSetId}/${scenario.scenarioId} aggregate drift`);
    }
  }
});
