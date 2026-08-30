#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { aggregateBenchmarkRuns, BENCHMARK_VERSION } from "../src/core/execution-profile-benchmarks.js";
import { readBenchmarkRunSets, readBenchmarkScenarios } from "./lib/execution-profile-benchmark-io.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultResultsDirectory = path.join(repositoryRoot, "benchmarks", "execution-profiles", "results");

function parseArgs(argv) {
  const options = { results: defaultResultsDirectory, runSetId: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (["--results", "--run-set"].includes(argument)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      if (argument === "--results") options.results = value;
      else options.runSetId = value;
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`unknown option: ${argument}`);
  }
  return options;
}

function helpText() {
  return "Usage: npm run benchmark:profiles:summary -- [--results <directory>] [--run-set <id>] [--json]";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  const runSets = await readBenchmarkRunSets(path.resolve(options.results), options.runSetId);
  const summaries = [];
  for (const runSet of runSets) {
    const aggregates = scenarios
      .map((scenario) => {
        const runs = runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId);
        return runs.length > 0 ? aggregateBenchmarkRuns({ scenario, runs }) : null;
      });
    summaries.push({
      runSetId: runSet.runSetId,
      runCount: runSet.runs.length,
      scenarioCount: aggregates.filter(Boolean).length,
      claimsAllowed: aggregates.some((aggregate) => aggregate?.claimsAllowed === true),
      scenarios: aggregates.filter(Boolean).map((aggregate) => ({
        scenarioId: aggregate.scenarioId,
        expectedProfile: aggregate.expectedProfile,
        claimsAllowed: aggregate.claimsAllowed,
        comparisons: aggregate.comparisons,
        lightObjectives: aggregate.lightObjectives,
      })),
    });
  }
  const output = {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    status: summaries.length === 0 ? "NOT_MEASURED" : "MEASURED",
    claimsAllowed: summaries.some((summary) => summary.claimsAllowed),
    scenarioCount: scenarios.length,
    runSets: summaries,
    claimPolicy: "No efficiency claim is allowed when trusted measurements are unavailable or non-comparable.",
  };
  if (options.json) console.log(JSON.stringify(output));
  else {
    console.log(`Benchmark status: ${output.status}`);
    console.log(`Run sets: ${summaries.length}`);
    console.log(`Claims allowed: ${output.claimsAllowed ? "yes (observational only)" : "no"}`);
    if (summaries.length === 0) console.log("No provider or host benchmark measurements are present.");
  }
}

main().catch((error) => {
  console.error(`ForgeLoop benchmark summary: ${error.message}`);
  process.exitCode = 1;
});
