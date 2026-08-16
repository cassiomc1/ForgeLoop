import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { classifyCommandResolution } from "../src/core/verification-capability.js";
import {
  classifyPnpmInvocation,
  classifyYarnInvocation,
} from "../src/core/package-manager-classifiers.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const corpusPath = path.join(repositoryRoot, "tests/fixtures/verification/npm-argv.json");

test("verification classifier preserves the real npm argv corpus", async () => {
  const cases = JSON.parse(await readFile(corpusPath, "utf8"));
  for (const fixture of cases) {
    assert.deepEqual(classifyCommandResolution(fixture.argv), fixture.expected, fixture.name);
  }
});

test("verification responsibilities have explicit internal module boundaries", async () => {
  for (const file of [
    "src/core/verification-constants.js",
    "src/core/command-tokenizer.js",
    "src/core/npm-classifier.js",
    "src/core/package-manager-classifiers.js",
    "src/core/command-resolution.js",
    "src/core/installation-authority.js",
  ]) {
    await access(path.join(repositoryRoot, file));
  }
});

test("package-manager classifiers keep pnpm and yarn installation boundaries explicit", () => {
  assert.deepEqual(classifyPnpmInvocation(["dlx", "eslint"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "pnpm dlx",
    tool: "eslint",
  });
  assert.deepEqual(classifyYarnInvocation(["add", "eslint"]), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "yarn",
    tool: "eslint",
  });
});
