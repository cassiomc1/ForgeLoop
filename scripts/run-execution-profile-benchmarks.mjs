#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { access, readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { evaluateRoute } from "../src/core/router.js";
import { currentRepositoryFingerprint } from "../src/core/repository.js";
import { getPackageRoot } from "../src/core/templates.js";
import { assertSchema, readSchema } from "../src/core/schema-validation.js";
import {
  aggregateBenchmarkRuns,
  BENCHMARK_MODES,
  BENCHMARK_VERSION,
  assertBenchmarkScenario,
  assertRequiredBenchmarkScenarios,
  createBenchmarkRun,
} from "../src/core/execution-profile-benchmarks.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioDirectory = path.join(repositoryRoot, "benchmarks", "execution-profiles");
const defaultOutputDirectory = path.join(scenarioDirectory, "results");

function usageError(message) {
  const error = new Error(message);
  error.code = "E_BENCHMARK_USAGE";
  return error;
}

function parseArgs(argv) {
  const options = {
    target: process.cwd(),
    adapter: null,
    runs: 5,
    runSetId: null,
    output: defaultOutputDirectory,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[++index];
      if (!next || next.startsWith("--")) throw usageError(`${argument} requires a value`);
      return next;
    };
    if (argument === "--target") options.target = value();
    else if (argument === "--adapter") options.adapter = value();
    else if (argument === "--runs") options.runs = Number(value());
    else if (argument === "--run-set") options.runSetId = value();
    else if (argument === "--output") options.output = value();
    else if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else throw usageError(`unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (!options.adapter) throw usageError("--adapter is required; ForgeLoop never invents provider or host measurements");
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 100) {
    throw usageError("--runs must be an integer from 1 through 100");
  }
  if (options.runSetId !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(options.runSetId)) {
    throw usageError("--run-set must contain only portable identifier characters");
  }
  return options;
}

function helpText() {
  return [
    "Usage: npm run benchmark:profiles -- --adapter <module> [options]",
    "",
    "The adapter must execute each scenario and return actual provider/host usage, verification, comparable steps, and optional host-reported contextUsage.",
    "Options: --target <path> --runs <1..100> --run-set <id> --output <directory> --json",
  ].join("\n");
}

async function loadScenarios() {
  const scenarioSchema = await readSchema("execution-profile-benchmark-scenario", getPackageRoot());
  const names = (await readdir(scenarioDirectory)).filter((name) => /^[a-z0-9-]+\.json$/u.test(name)).sort();
  const scenarios = [];
  for (const name of names) {
    const scenario = JSON.parse(await readFile(path.join(scenarioDirectory, name), "utf8"));
    assertSchema(scenario, scenarioSchema, name);
    scenarios.push(assertBenchmarkScenario(scenario));
  }
  try {
    return assertRequiredBenchmarkScenarios(scenarios);
  } catch (error) {
    throw usageError(error.message);
  }
}

async function loadAdapter(adapterSpecifier) {
  const adapterPath = path.resolve(process.cwd(), adapterSpecifier);
  const adapterModule = await import(pathToFileURL(adapterPath).href);
  const adapter = adapterModule.runBenchmark ?? adapterModule.default?.runBenchmark ?? adapterModule.default;
  if (typeof adapter !== "function") {
    throw usageError("benchmark adapter must export runBenchmark(input) or be a function default export");
  }
  return adapter;
}

function generatedRunSetId() {
  return new Date().toISOString().replace(/[-:.]/gu, "");
}

function environmentMetadata(adapterMetadata = {}) {
  return {
    environmentClass: adapterMetadata.environmentClass ?? `${process.platform}-node${process.versions.node.split(".")[0]}`,
    nodeVersion: adapterMetadata.nodeVersion ?? process.versions.node,
    os: adapterMetadata.os ?? process.platform,
    arch: adapterMetadata.arch ?? process.arch,
  };
}

function profileForMode(scenario, mode) {
  if (mode === "direct") return { requestedProfile: null, resolvedProfile: null };
  const requestedProfile = mode === "forgeloopBalanced" ? "balanced" : "auto";
  const route = evaluateRoute(scenario.input, { requestedProfile });
  return { requestedProfile, resolvedProfile: route.executionProfile.resolved };
}

function normalizedAdapterMetadata(response, target, repository, scenario, mode) {
  const adapterMetadata = response.metadata && typeof response.metadata === "object"
    ? response.metadata
    : {};
  const profile = profileForMode(scenario, mode);
  const environment = environmentMetadata(adapterMetadata);
  return {
    ...environment,
    model: response.usage?.model ?? adapterMetadata.model ?? null,
    provider: response.usage?.provider ?? adapterMetadata.provider ?? null,
    promptSpecFingerprint: response.promptSpecFingerprint ?? adapterMetadata.promptSpecFingerprint ?? null,
    // A Git revision is derived from the target rather than trusted from the adapter.
    projectRevision: repository.head ?? adapterMetadata.projectRevision ?? null,
    requestedProfile: profile.requestedProfile,
    resolvedProfile: profile.resolvedProfile,
    targetPath: target,
  };
}

async function executeRuns({ adapter, scenarios, target, runSetId, runs }) {
  const repository = await currentRepositoryFingerprint(target);
  const allRuns = [];
  for (const scenario of scenarios) {
    for (const mode of BENCHMARK_MODES) {
      for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
        const started = performance.now();
        const response = await adapter({
          benchmarkVersion: BENCHMARK_VERSION,
          scenario: structuredClone(scenario),
          mode,
          runIndex,
          target,
          projectRevision: repository.head ?? null,
          // The adapter owns execution; the runner owns elapsed-time measurement.
        });
        const wallClockMs = Number((performance.now() - started).toFixed(4));
        if (!response || typeof response !== "object" || Array.isArray(response)) {
          throw usageError(`${scenario.scenarioId}/${mode}/${runIndex}: adapter must return an object`);
        }
        const run = createBenchmarkRun({
          runSetId,
          runId: `run-${scenario.scenarioId}-${mode}-${String(runIndex).padStart(3, "0")}`,
          runIndex,
          scenario,
          mode,
          usage: response.usage ?? {},
          wallClockMs,
          verification: response.verification ?? "NOT_AVAILABLE",
          verificationCycles: response.verificationCycles ?? null,
          comparableSteps: response.comparableSteps ?? null,
          contextUsage: response.contextUsage,
          quality: response.quality,
          metadata: normalizedAdapterMetadata(response, target, repository, scenario, mode),
        });
        allRuns.push(run);
      }
    }
  }
  return allRuns;
}

async function writeResults({ outputDirectory, runSetId, scenarios, runs }) {
  const rawDirectory = path.join(outputDirectory, "raw", runSetId);
  const aggregateDirectory = path.join(outputDirectory, "aggregate", runSetId);
  try {
    await access(rawDirectory);
    throw usageError(`run set already exists and will not be overwritten: ${runSetId}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await access(aggregateDirectory);
    throw usageError(`aggregate run set already exists and will not be overwritten: ${runSetId}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(aggregateDirectory, { recursive: true });
  const aggregates = [];
  for (const scenario of scenarios) {
    const scenarioRuns = runs.filter((run) => run.scenarioId === scenario.scenarioId);
    const aggregate = aggregateBenchmarkRuns({ scenario, runs: scenarioRuns });
    aggregates.push(aggregate);
    for (const run of scenarioRuns) {
      const directory = path.join(rawDirectory, scenario.scenarioId, run.mode);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, `run-${String(run.runIndex).padStart(3, "0")}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
    }
    await writeFile(path.join(aggregateDirectory, `${scenario.scenarioId}.json`), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
  }
  const summary = {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_VERSION,
    runSetId,
    scenarioCount: scenarios.length,
    runCount: runs.length,
    claimsAllowed: aggregates.some((aggregate) => aggregate.claimsAllowed),
    scenarios: aggregates.map((aggregate) => ({
      scenarioId: aggregate.scenarioId,
      expectedProfile: aggregate.expectedProfile,
      claimsAllowed: aggregate.claimsAllowed,
      lightObjectives: aggregate.lightObjectives,
      contextInflation: aggregate.contextInflation ?? null,
    })),
  };
  await writeFile(path.join(aggregateDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return { rawDirectory, aggregateDirectory, summary };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }
  const target = path.resolve(options.target);
  const outputDirectory = path.resolve(options.output);
  const runSetId = options.runSetId ?? generatedRunSetId();
  const adapter = await loadAdapter(options.adapter);
  const scenarios = await loadScenarios();
  const runs = await executeRuns({ adapter, scenarios, target, runSetId, runs: options.runs });
  const result = await writeResults({ outputDirectory, runSetId, scenarios, runs });
  const output = {
    status: "MEASURED",
    runSetId,
    scenarioCount: scenarios.length,
    runCount: runs.length,
    outputDirectory,
    claimsAllowed: result.summary.claimsAllowed,
  };
  console.log(options.json ? JSON.stringify(output) : [
    `Benchmark run set: ${runSetId}`,
    `Scenarios: ${scenarios.length}`,
    `Runs: ${runs.length}`,
    `Claims allowed: ${result.summary.claimsAllowed ? "yes (observational only)" : "no"}`,
    `Results: ${outputDirectory}`,
  ].join("\n"));
}

main().catch((error) => {
  console.error(`ForgeLoop benchmark runner: ${error.message}`);
  process.exitCode = 1;
});
