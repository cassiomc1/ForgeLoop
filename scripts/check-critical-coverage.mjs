#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath = path.join(repositoryRoot, "coverage", "coverage-summary.json");

export const CRITICAL_COVERAGE_THRESHOLDS = Object.freeze({
  "src/core/next-action.js": { lines: 90, branches: 80 },
  "src/core/next-action-phases.js": { lines: 70, branches: 70 },
  "src/core/verification-execution.js": { lines: 85, branches: 70 },
  "src/core/transaction.js": { lines: 90, branches: 75 },
  "src/core/completion.js": { lines: 85, branches: 55 },
  "src/core/preflight.js": { lines: 90, branches: 75 },
  "src/core/events.js": { lines: 85, branches: 75 },
  "src/core/installation-authority.js": { lines: 95, branches: 90 },
  "src/core/trusted-authority.js": { lines: 85, branches: 70 },
  "src/core/repository.js": { lines: 80, branches: 60 },
  "src/core/policy-discovery.js": { lines: 75, branches: 45 },
  "src/core/policy-adapters.js": { lines: 70, branches: 45 },
  "src/core/task-identity.js": { lines: 75, branches: 50 },
  "src/core/task-migration-validation.js": { lines: 75, branches: 50 },
});

function findSummaryEntry(summary, relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return summary[absolutePath] ?? summary[relativePath] ?? summary[path.resolve(relativePath)];
}

export async function checkCriticalCoverage({ summary = null, readSummary = readFile } = {}) {
  const value = summary ?? JSON.parse(await readSummary(summaryPath, "utf8"));
  const failures = [];
  const missing = [];
  for (const [file, thresholds] of Object.entries(CRITICAL_COVERAGE_THRESHOLDS)) {
    const entry = findSummaryEntry(value, file);
    if (!entry) {
      missing.push(file);
      continue;
    }
    for (const metric of ["lines", "branches"]) {
      const actual = entry[metric]?.pct;
      if (typeof actual !== "number" || actual < thresholds[metric]) {
        failures.push({ file, metric, actual, required: thresholds[metric] });
      }
    }
  }
  return { ok: failures.length === 0 && missing.length === 0, failures, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkCriticalCoverage();
    if (result.missing.length > 0) {
      console.error(`Critical coverage report is missing: ${result.missing.join(", ")}`);
    }
    for (const failure of result.failures) {
      console.error(`${failure.file} ${failure.metric}: ${failure.actual ?? "unknown"}% (required ${failure.required}%)`);
    }
    if (!result.ok) process.exitCode = 1;
    else console.log("Critical-module coverage meets the configured thresholds.");
  } catch (error) {
    console.error(`Critical coverage check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
