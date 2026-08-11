import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

import { TEMPLATE_PATHS } from "../src/core/templates.js";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

test("npm tarball contains the CLI, templates, and license notices only", () => {
  const output = execFileSync(npmCommand, ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const listing = JSON.parse(output)[0].files.map((entry) => entry.path);

  for (const expected of [
    "src/cli.js",
    "src/core/agent-support.js",
    ...TEMPLATE_PATHS,
    ".forgeloop/.gitignore",
    "QUALITY_SCORECARD.md",
    "TERMINOLOGY.md",
    "EXECUTION_STATE.md",
    "DELEGATION_PROTOCOL.md",
    "ORCHESTRATOR_INTEGRATION.md",
    "schemas/routing-input.schema.json",
    "schemas/routing-result.schema.json",
    "schemas/work-state.schema.json",
    "schemas/execution-receipt.schema.json",
    "schemas/task-brief.schema.json",
    "schemas/delegated-result.schema.json",
    "schemas/evidence.schema.json",
    "THREAT_MODEL.md",
    "CONTRACT_COVERAGE.md",
    "LICENSE",
    "LICENSE-DOCS.md",
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
  for (const excluded of [
    "tests/cli.test.js",
    "scripts/scan_secrets.py",
    ".forgeloop/work-state.json",
    "docs/superpowers/plans/2026-08-11-10-of-10-roadmap-implementation.md",
  ]) {
    assert.equal(listing.includes(excluded), false, `unexpected ${excluded}`);
  }
});

test("CLI package entry is executable by Node-compatible shells", async () => {
  const cli = (await readFile("src/cli.js", "utf8")).replace(/\r\n/g, "\n");
  const metadata = await stat("src/cli.js");
  assert.match(cli, /^#!\/usr\/bin\/env node\n/);
  assert.ok(metadata.isFile());
  if (process.platform !== "win32") {
    assert.notEqual(metadata.mode & 0o111, 0);
  }
});

test("release workflow uses a compatible OIDC publishing toolchain", async () => {
  const workflow = (await readFile(".github/workflows/npm-publish.yml", "utf8")).replace(
    /\r\n/g,
    "\n",
  );

  assert.match(workflow, /setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm publish --access public\n/);
  assert.match(workflow, /scripts\/validate_markdown.py --self-test/);
  assert.match(workflow, /scripts\/validate_markdown.py\n/);
  assert.doesNotMatch(workflow, /--provenance/);
});

test("supported Node engine versions are exercised in docs CI", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const workflow = (await readFile(".github/workflows/docs-quality.yml", "utf8")).replace(
    /\r\n/g,
    "\n",
  );

  assert.equal(packageJson.engines.node, ">=20");
  assert.equal(packageJson.scripts.test, "node scripts/run-tests.js");
  assert.match(workflow, /node-version: \[20, 22, 24\]/);
  assert.match(
    workflow,
    /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/,
  );
});
