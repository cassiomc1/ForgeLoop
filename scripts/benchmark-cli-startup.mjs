#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ITERATIONS = 7;
const DEFAULT_BUDGET_MS = 1000;

function numericArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} requires a positive number`);
  return value;
}

export function benchmarkCliStartup({
  iterations = DEFAULT_ITERATIONS,
  budgetMs = DEFAULT_BUDGET_MS,
  spawnProcess = spawnSync,
  cwd = repositoryRoot,
} = {}) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const result = spawnProcess(process.execPath, ["src/cli.js", "protocol-info", "--json"], {
      cwd,
      stdio: "ignore",
      shell: false,
    });
    const elapsed = performance.now() - started;
    if (result.status !== 0) {
      throw new Error(`protocol-info startup command failed with exit code ${result.status ?? "unknown"}`);
    }
    samples.push(elapsed);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { iterations, budgetMs, medianMs: median, samplesMs: samples };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = benchmarkCliStartup({
      iterations: numericArgument("--iterations", DEFAULT_ITERATIONS),
      budgetMs: numericArgument("--budget-ms", DEFAULT_BUDGET_MS),
    });
    console.log(`CLI startup median: ${result.medianMs.toFixed(1)} ms (budget: ${result.budgetMs} ms, samples: ${result.iterations})`);
    if (result.medianMs > result.budgetMs) {
      console.error("CLI startup budget exceeded.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`CLI startup benchmark failed: ${error.message}`);
    process.exitCode = 1;
  }
}
