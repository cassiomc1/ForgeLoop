import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSchema, readSchema } from "../../src/core/schema-validation.js";
import { getPackageRoot } from "../../src/core/templates.js";
import {
  assertBenchmarkScenario,
  assertBenchmarkRun,
  assertRequiredBenchmarkScenarios,
} from "../../src/core/execution-profile-benchmarks.js";

export async function readBenchmarkScenarios(repositoryRoot) {
  const directory = path.join(repositoryRoot, "benchmarks", "execution-profiles");
  const schema = await readSchema("execution-profile-benchmark-scenario", getPackageRoot());
  const names = (await readdir(directory)).filter((name) => /^[a-z0-9-]+\.json$/u.test(name)).sort();
  const scenarios = [];
  for (const name of names) {
    const scenario = JSON.parse(await readFile(path.join(directory, name), "utf8"));
    assertSchema(scenario, schema, name);
    scenarios.push(assertBenchmarkScenario(scenario));
  }
  return assertRequiredBenchmarkScenarios(scenarios);
}

async function readJsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await readJsonFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

export async function readBenchmarkRunSets(resultsDirectory, runSetId = null) {
  const rawDirectory = path.join(resultsDirectory, "raw");
  let names;
  try {
    names = (await readdir(rawDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && (runSetId === null || entry.name === runSetId))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const schema = await readSchema("execution-profile-benchmark-run", getPackageRoot());
  const runSets = [];
  for (const name of names) {
    const files = await readJsonFiles(path.join(rawDirectory, name));
    const runs = [];
    for (const filename of files) {
      const value = JSON.parse(await readFile(filename, "utf8"));
      assertSchema(value, schema, filename);
      runs.push(assertBenchmarkRun(value));
    }
    runSets.push({ runSetId: name, runs });
  }
  return runSets;
}
