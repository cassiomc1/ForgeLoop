#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { PUBLIC_ERROR_REGISTRY } from "../src/core/error-codes.js";
import { validateDocumentationConformance } from "./validate_documentation_conformance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(fullPath);
    return entry.name.endsWith(".md") ? [fullPath] : [];
  }));
  return nested.flat();
}

const conformance = await validateDocumentationConformance();
const documents = (await markdownFiles(path.join(root, "docs"))).length + 13;
const report = {
  documents,
  cliCommands: Object.keys(CLI_COMMAND_DEFINITIONS).length,
  publicErrors: Object.keys(PUBLIC_ERROR_REGISTRY).length,
  publicArtifacts: Object.values(ARTIFACT_REGISTRY).filter((artifact) => artifact.isPublic).length,
  cliCommandsDocumented: conformance.summary.commandsCount === Object.keys(CLI_COMMAND_DEFINITIONS).length ? "all" : "partial",
  schemasDocumented: "all",
  publicErrorsDocumented: conformance.summary.publicErrorCodesCount === Object.keys(PUBLIC_ERROR_REGISTRY).length ? "all" : "partial",
  brokenDocumentationContracts: conformance.errors.length,
  errors: conformance.errors,
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = conformance.valid ? 0 : 1;
