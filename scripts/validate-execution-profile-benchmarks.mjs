#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertSchema, readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";
import { aggregateBenchmarkRuns, BENCHMARK_MODES } from "../src/core/execution-profile-benchmarks.js";
import { readBenchmarkRunSets, readBenchmarkScenarios } from "./lib/execution-profile-benchmark-io.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultResultsDirectory = path.join(repositoryRoot, "benchmarks", "execution-profiles", "results");

function parseArgs(argv) {
  const options = { results: defaultResultsDirectory, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--results") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--results requires a value");
      options.results = value;
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`unknown option: ${argument}`);
  }
  return options;
}

function assertCompleteRunSet(scenario, runs) {
  if (runs.length === 0) throw new Error(`${scenario.scenarioId}: no raw runs found`);
  const byMode = Object.fromEntries(BENCHMARK_MODES.map((mode) => [mode, runs.filter((run) => run.mode === mode)]));
  const counts = new Set(BENCHMARK_MODES.map((mode) => byMode[mode].length));
  if (counts.size !== 1 || counts.has(0)) throw new Error(`${scenario.scenarioId}: every mode must have the same non-zero run count`);
  const expectedIndexes = byMode.direct.map((run) => run.runIndex).sort((a, b) => a - b);
  for (const mode of BENCHMARK_MODES) {
    const indexes = byMode[mode].map((run) => run.runIndex).sort((a, b) => a - b);
    if (JSON.stringify(indexes) !== JSON.stringify(expectedIndexes)) {
      throw new Error(`${scenario.scenarioId}: ${mode} run indexes do not match direct baseline`);
    }
  }
  return aggregateBenchmarkRuns({ scenario, runs });
}

async function validateStoredAggregates(resultsDirectory, runSetId, scenarios, expectedAggregates) {
  const schema = await readSchema("execution-profile-benchmark-aggregate", getPackageRoot());
  const aggregateDirectory = path.join(resultsDirectory, "aggregate", runSetId);
  const aggregateEntries = await readdir(aggregateDirectory, { withFileTypes: true });
  const expectedNames = new Set(scenarios.map((scenario) => `${scenario.scenarioId}.json`));
  for (const entry of aggregateEntries) {
    if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "summary.json" && !expectedNames.has(entry.name)) {
      throw new Error(`${runSetId}: aggregate has an unexpected scenario file: ${entry.name}`);
    }
  }
  for (const aggregate of expectedAggregates) {
    const filename = path.join(resultsDirectory, "aggregate", runSetId, `${aggregate.scenarioId}.json`);
    const stored = JSON.parse(await readFile(filename, "utf8"));
    assertSchema(stored, schema, filename);
    if (JSON.stringify(stored) !== JSON.stringify(aggregate)) {
      throw new Error(`${aggregate.scenarioId}: stored aggregate does not reproduce raw measurements`);
    }
  }
  const summaryPath = path.join(resultsDirectory, "aggregate", runSetId, "summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  if (summary.runSetId !== runSetId
    || summary.scenarioCount !== scenarios.length
    || summary.runCount !== expectedAggregates.reduce((sum, aggregate) => sum + aggregate.generatedFromRunCount, 0)
    || summary.claimsAllowed !== expectedAggregates.some((aggregate) => aggregate.claimsAllowed)) {
    throw new Error(`${runSetId}: aggregate summary identity is inconsistent`);
  }
}

async function readAggregateRunSetNames(resultsDirectory) {
  try {
    return (await readdir(path.join(resultsDirectory, "aggregate"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: npm run benchmark:profiles:check -- [--results <directory>] [--json]");
    return;
  }
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  const resultsDirectory = path.resolve(options.results);
  const runSets = await readBenchmarkRunSets(resultsDirectory);
  const aggregateRunSetNames = await readAggregateRunSetNames(resultsDirectory);
  const rawRunSetNames = new Set(runSets.map((runSet) => runSet.runSetId));
  for (const name of aggregateRunSetNames) {
    if (!rawRunSetNames.has(name)) throw new Error(`${name}: aggregate exists without raw benchmark history`);
  }
  if (runSets.length === 0) {
    const output = { status: "VALID", benchmarkStatus: "NOT_MEASURED", scenarioCount: scenarios.length, runSets: 0 };
    console.log(options.json ? JSON.stringify(output) : "Benchmark schemas valid; no measured run sets are present.");
    return;
  }
  const results = [];
  for (const runSet of runSets) {
    const aggregates = scenarios.map((scenario) => assertCompleteRunSet(
      scenario,
      runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId),
    ));
    await validateStoredAggregates(resultsDirectory, runSet.runSetId, scenarios, aggregates);
    results.push({ runSetId: runSet.runSetId, runCount: runSet.runs.length, claimsAllowed: aggregates.some((aggregate) => aggregate.claimsAllowed) });
  }
  const output = { status: "VALID", benchmarkStatus: "MEASURED", scenarioCount: scenarios.length, runSets: results };
  console.log(options.json ? JSON.stringify(output) : `Benchmark schemas and aggregates valid for ${results.length} run set(s).`);
}

main().catch((error) => {
  console.error(`ForgeLoop benchmark validation: ${error.message}`);
  process.exitCode = 1;
});
