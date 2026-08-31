#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeTokenOutliers,
  BENCHMARK_MODES,
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
  return "Usage: npm run benchmark:profiles:outliers -- [--results <directory>] [--run-set <id>] [--json]";
}

function diagnosticsValue(run, field) {
  return run?.diagnostics?.[field] ?? null;
}

function buildRows(runSet, scenario) {
  const runs = runSet.runs.filter((run) => run.scenarioId === scenario.scenarioId);
  if (runs.length === 0) return [];
  const byMode = Object.fromEntries(BENCHMARK_MODES.map((mode) => [
    mode,
    runs.filter((run) => run.mode === mode).sort((left, right) => left.runIndex - right.runIndex),
  ]));
  const runById = new Map(runs.map((run) => [run.runId, run]));
  const analysis = analyzeTokenOutliers(byMode);
  const rows = [];
  for (const mode of BENCHMARK_MODES) {
    const modeAnalysis = analysis.modes[mode];
    for (const outlier of modeAnalysis.outliers) {
      const run = runById.get(outlier.runId);
      rows.push({
        scenarioId: scenario.scenarioId,
        mode,
        runId: outlier.runId,
        totalTokens: outlier.totalTokens,
        scenarioMedianTokens: outlier.scenarioMedianTokens,
        ratioToMedian: outlier.ratioToMedian,
        reasons: outlier.reasons,
        diagnosticSignals: outlier.diagnosticSignals,
        verificationCycles: run?.verificationCycles ?? diagnosticsValue(run, "verificationCycles"),
        modelTurns: diagnosticsValue(run, "modelTurns"),
        toolCalls: diagnosticsValue(run, "toolCalls"),
        retries: diagnosticsValue(run, "retries"),
        correctionCycles: diagnosticsValue(run, "correctionCycles"),
      });
    }
  }
  return rows;
}

function formatValue(value) {
  return value === null || value === undefined ? "-" : String(value);
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
    for (const scenario of scenarios) {
      const rows = buildRows(runSet, scenario);
      if (rows.length > 0) reports.push({ runSetId: runSet.runSetId, scenarioId: scenario.scenarioId, outliers: rows });
    }
  }
  const outlierCount = reports.reduce((sum, report) => sum + report.outliers.length, 0);
  const output = {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    policy: "TOKEN_IQR_1_5",
    runSetCount: runSets.length,
    outlierCount,
    reports,
    note: "Outlier classification is a benchmark diagnostic. It never changes lifecycle truth or completion validity.",
  };
  if (options.json) {
    console.log(JSON.stringify(output));
    return;
  }
  if (outlierCount === 0) {
    console.log("No token outliers detected under the TOKEN_IQR_1_5 policy.");
    return;
  }
  const header = ["Scenario", "Mode", "Run ID", "Tokens", "Median", "Ratio", "VerCycles", "Turns", "ToolCalls", "Retries", "Corrections", "Signals"];
  console.log(header.join("\t"));
  for (const report of reports) {
    for (const row of report.outliers) {
      console.log([
        row.scenarioId,
        row.mode,
        row.runId,
        formatValue(row.totalTokens),
        formatValue(row.scenarioMedianTokens),
        formatValue(row.ratioToMedian),
        formatValue(row.verificationCycles),
        formatValue(row.modelTurns),
        formatValue(row.toolCalls),
        formatValue(row.retries),
        formatValue(row.correctionCycles),
        row.diagnosticSignals.length > 0 ? row.diagnosticSignals.join(",") : "-",
      ].join("\t"));
    }
  }
}

main().catch((error) => {
  console.error(`ForgeLoop benchmark outlier report: ${error.message}`);
  process.exitCode = 1;
});
