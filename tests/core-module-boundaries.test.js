import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import * as nextAction from "../src/core/next-action.js";
import * as preflight from "../src/core/preflight.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

test("next-action facade keeps its public exports", () => {
  assert.equal(typeof nextAction.getNextAction, "function");
  assert.equal(typeof nextAction.NEXT_ACTIONS, "object");
});

test("preflight facade keeps its public exports", () => {
  assert.equal(typeof preflight.evaluatePreflight, "function");
  assert.equal(typeof preflight.validatePersistedPreflight, "function");
  assert.equal(typeof preflight.validateReadyProtocolConsistency, "function");
  assert.equal(typeof preflight.runPreflight, "function");
});

test("next-action responsibilities have explicit internal module boundaries", async () => {
  for (const file of [
    "src/core/next-action-model.js",
    "src/core/next-action-artifacts.js",
    "src/core/next-action-phases.js",
    "src/core/next-action-continuity.js",
  ]) {
    await access(path.join(repositoryRoot, file));
  }
});

test("preflight responsibilities have explicit internal module boundaries", async () => {
  for (const file of [
    "src/core/preflight-model.js",
    "src/core/preflight-loaders.js",
    "src/core/preflight-consistency.js",
  ]) {
    await access(path.join(repositoryRoot, file));
  }
});

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

test("Sentrux-specific code stays behind the structural-quality adapter boundary", async () => {
  const sourceFiles = await listJavaScriptFiles(path.join(repositoryRoot, "src", "core"));
  const allowed = path.join(repositoryRoot, "src", "core", "structural-quality", "sentrux-mcp.js");
  for (const sourceFile of sourceFiles) {
    if (sourceFile === allowed) continue;
    const source = await readFile(sourceFile, "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*sentrux[^"']*["']/i, sourceFile);
  }
});
