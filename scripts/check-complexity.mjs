#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function complexitySnapshot(results) {
  const snapshot = {};
  for (const result of results) {
    const scores = result.messages.filter(message => message.ruleId === "complexity")
      .map(message => Number(message.message.match(/complexity of (\d+)/u)?.[1]))
      .sort((a, b) => b - a);
    if (scores.some(score => !Number.isFinite(score))) throw new Error(`Unrecognized complexity diagnostic: ${result.filePath}`);
    if (scores.length) snapshot[path.relative(root, result.filePath).replaceAll("\\", "/")] = scores;
  }
  return snapshot;
}

export function complexityRegressions(current, baseline) {
  const regressions = [];
  for (const [file, scores] of Object.entries(current)) {
    scores.forEach((score, index) => {
      const limit = baseline[file]?.[index] ?? 25;
      if (score > limit) regressions.push({ file, score, limit });
    });
  }
  return regressions;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseline = JSON.parse(await readFile(path.join(root, "scripts/complexity-baseline.json"), "utf8"));
  const current = complexitySnapshot(await new ESLint({ cwd: root }).lintFiles(["src/**/*.js"]));
  const regressions = complexityRegressions(current, baseline);
  console.log(JSON.stringify({ status: regressions.length ? "FAIL" : "PASS", regressions }));
  if (regressions.length) process.exitCode = 1;
}
