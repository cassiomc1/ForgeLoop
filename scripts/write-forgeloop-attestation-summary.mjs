#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function usage() {
  return [
    "Usage: node scripts/write-forgeloop-attestation-summary.mjs --input <result.json> [--output <summary.md>]",
    "",
    "When --output is omitted, GITHUB_STEP_SUMMARY is used when available; otherwise the summary is written to stdout.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { input: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      return null;
    }
    if (argument === "--input" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.input) throw new Error("--input is required");
  return options;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function summaryFor(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("The attestation result must be a JSON object");
  }
  const changed = safeNumber(result.changedPaths);
  const covered = safeNumber(result.coveredPaths);
  const uncovered = Array.isArray(result.uncoveredPaths) ? result.uncoveredPaths.length : 0;
  const signature = result.signature && typeof result.signature === "object"
    ? result.signature
    : {};
  const errorCodes = Array.isArray(result.errors)
    ? [...new Set(result.errors.map((error) => error?.code).filter(Boolean))].sort()
    : [];
  const lines = [
    "## ForgeLoop Attestation",
    "",
    `- **Status:** ${String(result.status ?? "UNKNOWN")}`,
    `- **Level:** ${String(result.level ?? "UNKNOWN")}`,
    `- **Revision provider:** ${String(result.revisionProvider ?? "unknown")}`,
    `- **Base:** ${String(result.baseRevision ?? "unknown")}`,
    `- **Head:** ${String(result.headRevision ?? "unknown")}`,
    `- **Coverage:** ${covered} / ${changed} changed paths`,
    `- **Uncovered paths:** ${uncovered}`,
    `- **Tasks:** ${safeNumber(result.tasks)}`,
    `- **Signature:** ${String(signature.status ?? "NOT_CHECKED")}`,
  ];
  if (errorCodes.length > 0) {
    lines.push("", "**Stable error codes**", "", ...errorCodes.map((code) => `- \`${code}\``));
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options) return 0;
  const result = JSON.parse(await readFile(path.resolve(options.input), "utf8"));
  const summary = summaryFor(result);
  const destination = options.output ?? process.env.GITHUB_STEP_SUMMARY;
  if (destination) {
    await writeFile(path.resolve(destination), `${summary}\n`, "utf8");
    console.log(`Wrote ForgeLoop attestation summary to ${destination}`);
  } else {
    process.stdout.write(`${summary}\n`);
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`Attestation summary failed: ${error.message}`);
  console.error(usage());
  process.exitCode = 2;
}
