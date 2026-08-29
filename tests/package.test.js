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
    "src/integration.js",
    "src/integration.d.ts",
    "src/core/command-runtime.js",
    "src/core/command-executors.js",
    "src/core/command-input.js",
    "src/core/integration-invocation-policy.js",
    "src/core/integration-resources.js",
    "src/core/integration-limits.js",
    "src/core/project-root.js",
    "src/config/guides.json",
    "src/core/discovery-surfaces.js",
    "src/core/verification-capability.js",
    "src/core/task-claim-state.js",
    "src/core/recovery-history.js",
    ...TEMPLATE_PATHS.filter((relativePath) => ![".forgeloop/.gitignore", "AGENT_COMPATIBILITY.md"].includes(relativePath)),
    ".forgeloop/forgeloop.gitignore",
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
    "schemas/task-recovery.schema.json",
    "schemas/evidence.schema.json",
    "schemas/action.schema.json",
    "schemas/approval.schema.json",
    "schemas/capability-policy.schema.json",
    "schemas/trajectory-evaluation.schema.json",
    "schemas/trajectory-scenario.schema.json",
    "THREAT_MODEL.md",
    "CONTRACT_COVERAGE.md",
    "PROTOCOL_INTEGRATION.md",
    "DOCS_INDEX.md",
    "docs/RELEASE_CHECKLIST.md",
    "docs/MCP.md",
    "docs/UNIVERSAL_INTEGRATION.md",
    "docs/CODE_ATTESTATION.md",
    "docs/REVISION_PROVIDERS.md",
    "docs/SIGNING_PROVIDERS.md",
    "docs/PLATFORM_ADAPTERS.md",
    "docs/AGENT_PROTOCOL_SUMMARY.md",
    "docs/diagrams/README.md",
    "docs/diagrams/manifest.json",
    "docs/diagrams/forgeloop-engineering-flow.workflow.json",
    "docs/assets/diagrams/forgeloop-engineering-flow.html",
    "docs/assets/diagrams/forgeloop-engineering-flow.svg",
    "docs/assets/diagrams/forgeloop-engineering-flow.receipt.json",
    "scripts/CI_VALIDATORS.md",
    "LICENSE",
    "LICENSE-DOCS.md",
    "completions/forgeloop.bash",
    "completions/_forgeloop",
    "completions/forgeloop.fish",
    "integrations/generic-ci/verify.sh",
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
  for (const excluded of [
    "src/core/agent-support.js",
    "tests/cli.test.js",
    "scripts/scan_secrets.py",
    ".forgeloop/work-state.json",
    "docs/assets/eng_readme_forgeloop.png",
    "docs/superpowers/plans/2026-08-11-10-of-10-roadmap-implementation.md",
    "docs/RELEASE_CHECKLIST_1_4.md",
    "docs/RELEASE_CHECKLIST_1_5_MCP.md",
    "docs/RELEASE_CHECKLIST_1_6_1.md",
    // The MCP package ships separately, never inside the core tarball.
    ...listing.filter((entry) => entry.startsWith("integrations/mcp/")),
  ]) {
    assert.equal(listing.includes(excluded), false, `unexpected ${excluded}`);
  }

  const forbiddenOraclePatterns = [
    /EXPECTED_ROUTE/i,
    /REQUIRED_EVIDENCE/i,
    /REQUIRED_GATES/i,
    /blind-premium-website/i,
    /^conformance\//i,
  ];

  for (const packagedPath of listing) {
    for (const pattern of forbiddenOraclePatterns) {
      assert.equal(pattern.test(packagedPath), false, `oracle leakage in tarball: ${packagedPath}`);
    }
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
  assert.match(workflow, /npm publish --provenance --access public\n/);
  assert.match(workflow, /scripts\/validate_markdown.py --self-test/);
  assert.match(workflow, /scripts\/validate_markdown.py\n/);
  assert.match(workflow, /--provenance/);
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

test("published package metadata declares the repository license and integration types", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const mcpPackageJson = JSON.parse(await readFile("integrations/mcp/package.json", "utf8"));
  assert.equal(packageJson.license, "MIT");
  assert.equal(mcpPackageJson.license, "MIT");
  assert.equal(packageJson.exports?.["./integration"]?.types, "./src/integration.d.ts");
  assert.ok(packageJson.files.includes("src"));
});

test("documentation manifest packaged:true entries always ship in the core tarball", async () => {
  const manifest = JSON.parse(await readFile("docs/documentation-manifest.json", "utf8"));
  const expectedDocs = manifest.documents
    .filter((entry) => entry.packaged === true)
    .map((entry) => entry.path)
    .sort();

  const output = execFileSync(npmCommand, ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const listing = JSON.parse(output)[0].files.map((entry) => entry.path);

  assert.ok(expectedDocs.length > 0, "manifest must declare at least one packaged document");
  for (const docPath of expectedDocs) {
    assert.ok(
      listing.includes(docPath),
      `documentation manifest marks ${docPath} packaged:true but the core tarball omits it`,
    );
  }
});
