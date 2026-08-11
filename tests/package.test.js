import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

import { TEMPLATE_PATHS } from "../src/core/templates.js";

test("npm tarball contains the CLI, templates, and license notices only", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const listing = JSON.parse(output)[0].files.map((entry) => entry.path);

  for (const expected of [
    "src/cli.js",
    "src/core/agent-support.js",
    ...TEMPLATE_PATHS,
    ".mdfiles/.gitignore",
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
    "LICENSE",
    "LICENSE-DOCS.md",
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
  for (const excluded of [
    "tests/cli.test.js",
    "scripts/scan_secrets.py",
    ".mdfiles/work-state.json",
    "docs/superpowers/plans/2026-08-11-10-of-10-roadmap-implementation.md",
  ]) {
    assert.equal(listing.includes(excluded), false, `unexpected ${excluded}`);
  }
});

test("CLI package entry is executable by Node-compatible shells", async () => {
  const cli = await readFile("src/cli.js", "utf8");
  const metadata = await stat("src/cli.js");
  assert.match(cli, /^#!\/usr\/bin\/env node\n/);
  assert.notEqual(metadata.mode & 0o111, 0);
});

test("release workflow uses a compatible OIDC publishing toolchain", async () => {
  const workflow = await readFile(".github/workflows/npm-publish.yml", "utf8");

  assert.match(workflow, /setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm publish --access public\n/);
  assert.match(workflow, /scripts\/validate_markdown.py --self-test/);
  assert.match(workflow, /scripts\/validate_markdown.py\n/);
  assert.doesNotMatch(workflow, /--provenance/);
});

test("supported Node engine versions are exercised in docs CI", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const workflow = await readFile(".github/workflows/docs-quality.yml", "utf8");

  assert.equal(packageJson.engines.node, ">=20");
  assert.match(workflow, /node-version: \[20, 22, 24\]/);
});
