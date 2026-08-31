#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregateBenchmarkRuns,
  BENCHMARK_VERSION,
} from "../src/core/execution-profile-benchmarks.js";
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
  return "Usage: npm run benchmark:profiles:tail-analysis -- [--results <directory>] [--run-set <id>] [--json]";
}

function buildScenarioReport(aggregate) {
  const directAgg = aggregate.modeAggregates?.direct;
  const adaptiveComp = aggregate.comparisons?.forgeloopAdaptive;
  const adaptiveAgg = aggregate.modeAggregates?.forgeloopAdaptive;

  const directTokens = directAgg?.totalTokens ?? {};
  const adaptiveTokens = adaptiveAgg?.totalTokens ?? {};

  const paired = adaptiveComp?.pairedOverheadPercent ?? {};
  const dist = adaptiveComp?.distributionDeltaPercent ?? {};
  const tail = adaptiveComp?.tail ?? {};
  const diag = adaptiveComp?.pairedRatioDiagnostics ?? {};

  const hasComparableRuns = (adaptiveComp?.pairedRuns?.length ?? 0) > 0;
  let compDirectP50 = diag.baselineP50 ?? directTokens.p50 ?? null;
  let compDirectP95 = directTokens.p95 ?? null;
  let compAdaptiveP50 = adaptiveTokens.p50 ?? null;
  let compAdaptiveP95 = adaptiveTokens.p95 ?? null;

  if (hasComparableRuns) {
    const dTokens = adaptiveComp.pairedRuns.map((r) => r.directTokens).sort((a, b) => a - b);
    const aTokens = adaptiveComp.pairedRuns.map((r) => r.candidateTokens).sort((a, b) => a - b);
    const pos95 = (dTokens.length - 1) * 0.95;
    const lower = Math.floor(pos95);
    const upper = Math.ceil(pos95);
    const calcP95 = (arr) => (lower === upper ? arr[lower] : arr[lower] + ((arr[upper] - arr[lower]) * (pos95 - lower)));
    const pos50 = (dTokens.length - 1) * 0.5;
    const lower50 = Math.floor(pos50);
    const upper50 = Math.ceil(pos50);
    const calcP50 = (arr) => (lower50 === upper50 ? arr[lower50] : arr[lower50] + ((arr[upper50] - arr[lower50]) * (pos50 - lower50)));

    compDirectP50 = Number(calcP50(dTokens).toFixed(4));
    compDirectP95 = Number(calcP95(dTokens).toFixed(4));
    compAdaptiveP50 = Number(calcP50(aTokens).toFixed(4));
    compAdaptiveP95 = Number(calcP95(aTokens).toFixed(4));
  }

  return {
    scenarioId: aggregate.scenarioId,
    expectedProfile: aggregate.expectedProfile,
    totalRunsPerMode: directAgg?.runCount ?? 0,
    verificationSuccessRate: adaptiveAgg?.verificationSuccessRate ?? 1,
    directP50: compDirectP50,
    adaptiveP50: compAdaptiveP50,
    distributionP50DeltaPercent: dist.p50 ?? null,
    directP95: compDirectP95,
    adaptiveP95: compAdaptiveP95,
    distributionP95DeltaPercent: dist.p95 ?? null,
    pairedOverheadP50Percent: paired.p50 ?? null,
    pairedOverheadP95Percent: paired.p95 ?? null,
    lowBaselinePairCount: diag.lowBaselinePairCount ?? 0,
    comparablePairCount: adaptiveComp?.tokenComparablePairs ?? 0,
    pairedStatus: tail.pairedStatus ?? "NOT_ENOUGH_SAMPLES",
    distributionStatus: tail.distributionStatus ?? "NOT_ENOUGH_SAMPLES",
    combinedInterpretation: tail.combinedInterpretation ?? "TAIL_UNRESOLVED",
    pairedRuns: adaptiveComp?.pairedRuns ?? [],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }
  const scenarios = await readBenchmarkScenarios(repositoryRoot);
  const runSets = await readBenchmarkRunSets(path.resolve(options.results), options.runSetId);
  const reports = [];

  for (const runSet of runSets) {
    const scenarioReports = [];
    for (const scenario of scenarios) {
      const runs = runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId);
      if (runs.length === 0) continue;
      const aggregate = aggregateBenchmarkRuns({ scenario, runs });
      scenarioReports.push(buildScenarioReport(aggregate));
    }
    reports.push({
      runSetId: runSet.runSetId,
      runCount: runSet.runs.length,
      scenarios: scenarioReports,
    });
  }

  const output = {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    status: reports.length === 0 ? "NOT_MEASURED" : "MEASURED",
    runSets: reports,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    for (const runSet of reports) {
      console.log(`\n======================================================`);
      console.log(`Run Set: ${runSet.runSetId} (${runSet.runCount} runs)`);
      console.log(`======================================================`);
      for (const sc of runSet.scenarios) {
        console.log(`\nScenario: ${sc.scenarioId} (expectedProfile: ${sc.expectedProfile})`);
        console.log(`  Direct P50:                   ${sc.directP50 ?? "N/A"}`);
        console.log(`  Adaptive P50:                 ${sc.adaptiveP50 ?? "N/A"}`);
        console.log(`  Distribution P50 Delta:       ${sc.distributionP50DeltaPercent !== null ? `${sc.distributionP50DeltaPercent > 0 ? "+" : ""}${sc.distributionP50DeltaPercent}%` : "N/A"}`);
        console.log(`  Direct P95:                   ${sc.directP95 ?? "N/A"}`);
        console.log(`  Adaptive P95:                 ${sc.adaptiveP95 ?? "N/A"}`);
        console.log(`  Distribution P95 Delta:       ${sc.distributionP95DeltaPercent !== null ? `${sc.distributionP95DeltaPercent > 0 ? "+" : ""}${sc.distributionP95DeltaPercent}%` : "N/A"}`);
        console.log(`  Paired Overhead P50:          ${sc.pairedOverheadP50Percent !== null ? `${sc.pairedOverheadP50Percent > 0 ? "+" : ""}${sc.pairedOverheadP50Percent}%` : "N/A"}`);
        console.log(`  Paired Overhead P95:          ${sc.pairedOverheadP95Percent !== null ? `${sc.pairedOverheadP95Percent > 0 ? "+" : ""}${sc.pairedOverheadP95Percent}%` : "N/A"}`);
        console.log(`  Low-Baseline Pairs:           ${sc.lowBaselinePairCount}`);
        console.log(`  Comparable Pairs:             ${sc.comparablePairCount}`);
        console.log(`  Paired Tail Status:           ${sc.pairedStatus}`);
        console.log(`  Distribution Tail Status:     ${sc.distributionStatus}`);
        console.log(`  Combined Interpretation:      ${sc.combinedInterpretation}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`ForgeLoop tail interpretation report: ${error.message}`);
  process.exitCode = 1;
});
