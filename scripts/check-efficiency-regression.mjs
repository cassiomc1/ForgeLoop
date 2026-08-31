#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { aggregateBenchmarkRuns } from "../src/core/execution-profile-benchmarks.js";
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

function statusForAggregate(aggregate, runs) {
  const hasMeasuredUsage = runs.some((run) => (
    ["PROVIDER_REPORTED", "HOST_REPORTED"].includes(run.usage.source)
    && run.usage.totalTokens !== null
  ));
  if (!hasMeasuredUsage) return "NOT_MEASURED";
  if (!aggregate.claimsAllowed) return "NOT_COMPARABLE";
  if (aggregate.lightObjectives
    && (aggregate.lightObjectives.p50Pass === false || aggregate.lightObjectives.p95Pass === false)) {
    return "EFFICIENCY_REGRESSION";
  }
  return "OK";
}

function overallStatus(statuses) {
  if (statuses.includes("EFFICIENCY_REGRESSION")) return "EFFICIENCY_REGRESSION";
  if (statuses.includes("NOT_COMPARABLE")) return "NOT_COMPARABLE";
  if (statuses.length === 0 || statuses.every((status) => status === "NOT_MEASURED")) return "NOT_MEASURED";
  return "OK";
}

function helpText() {
  return "Usage: npm run benchmark:profiles:regression -- [--results <directory>] [--json]";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  const runSets = await readBenchmarkRunSets(path.resolve(options.results));
  const reports = [];
  for (const runSet of runSets) {
    for (const scenario of scenarios) {
      const runs = runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId);
      if (runs.length === 0) {
        reports.push({ runSetId: runSet.runSetId, scenarioId: scenario.scenarioId, status: "NOT_COMPARABLE" });
        continue;
      }
      const aggregate = aggregateBenchmarkRuns({ scenario, runs });
      reports.push({
        runSetId: runSet.runSetId,
        scenarioId: scenario.scenarioId,
        expectedProfile: scenario.expectedProfile,
        status: statusForAggregate(aggregate, runs),
        claimsAllowed: aggregate.claimsAllowed,
        contextInflation: aggregate.contextInflation?.status ?? null,
      });
    }
  }
  const status = overallStatus(reports.map((report) => report.status));
  const output = {
    status,
    blocking: false,
    runSetCount: runSets.length,
    scenarioCount: scenarios.length,
    reports,
    policy: "EFFICIENCY_REGRESSION is an observational release-quality warning and never a ForgeLoop lifecycle failure.",
  };
  if (options.json) console.log(JSON.stringify(output));
  else {
    console.log(`Efficiency regression status: ${status}`);
    console.log(`Run sets: ${runSets.length}`);
    console.log("This report is observational and does not change lifecycle completion.");
  }
}

main().catch((error) => {
  console.error(`ForgeLoop efficiency regression check: ${error.message}`);
  process.exitCode = 1;
});
