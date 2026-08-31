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
  assertBenchmarkScenario,
  createBenchmarkRun,
  normalizeBenchmarkContextUsage,
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
    benchmarkVersion: "1",
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
    assert.equal(aggregate.comparisons.forgeloopAdaptive.claimStatus, "OBSERVATIONAL");
    assert.equal(aggregate.contextInflation.status, "NOT_DETECTED");

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
