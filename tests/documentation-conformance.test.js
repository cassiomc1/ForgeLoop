import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { COMMANDS, parseArgs } from "../src/cli.js";
import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { CLI_COMMAND_METADATA } from "../src/core/cli-metadata.js";
import { ALL_KNOWN_ERROR_CODES, PUBLIC_ERROR_CODES } from "../src/core/error-codes.js";
import { readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";
import { validateDocumentationConformance } from "../scripts/validate_documentation_conformance.mjs";

const packageRoot = getPackageRoot();

test("validateDocumentationConformance passes on repository docs", async () => {
  const result = await validateDocumentationConformance();
  assert.equal(result.valid, true, `Expected valid documentation conformance, got errors: ${result.errors.join("\n")}`);
  assert.equal(result.errors.length, 0);
  assert.ok(result.summary.taggedArtifactsCount >= 12);
  assert.equal(result.summary.commandsCount, 27);
  assert.ok(result.summary.publicErrorCodesCount >= 13);
  assert.equal(result.summary.discoverySurfacesCount, 4);
});

test("ARTIFACT_REGISTRY covers all public schemas and matches ARTIFACT_REFERENCE", async () => {
  for (const [key, artifact] of Object.entries(ARTIFACT_REGISTRY)) {
    assert.ok(artifact.key, `Artifact ${key} must have key`);
    assert.ok(artifact.path, `Artifact ${key} must have path`);
    assert.ok(artifact.schema, `Artifact ${key} must have schema`);
    assert.ok(artifact.owner, `Artifact ${key} must have owner`);
    assert.ok(artifact.mutability, `Artifact ${key} must have mutability`);
    assert.ok(artifact.trustRole, `Artifact ${key} must have trustRole`);

    // Verify schema can be loaded
    const schema = await readSchema(artifact.schema, packageRoot);
    assert.ok(schema, `Schema ${artifact.schema} must load successfully`);
  }
});

test("CLI_COMMAND_DEFINITIONS and CLI_COMMAND_METADATA cover all 27 commands with valid options", () => {
  assert.equal(Object.keys(CLI_COMMAND_DEFINITIONS).length, 27);
  assert.equal(Object.keys(CLI_COMMAND_METADATA).length, 27);
  for (const command of COMMANDS) {
    const def = CLI_COMMAND_DEFINITIONS[command];
    const meta = CLI_COMMAND_METADATA[command];
    assert.ok(def, `Command ${command} must exist in CLI_COMMAND_DEFINITIONS`);
    assert.ok(meta, `Command ${command} must exist in CLI_COMMAND_METADATA`);
    assert.equal(def.name, command);
    assert.equal(meta.name, command);
    assert.ok(["lifecycle", "continuity", "verification", "policy-audit", "project-maintenance", "diagnostics"].includes(def.category));
    assert.ok(["READ_ONLY", "MUTATING", "EXTERNAL_EXECUTION"].includes(def.mutation));
    assert.ok(Array.isArray(meta.options));
    assert.ok(meta.options.includes("--help"));
    assert.ok(meta.options.includes("--version"));
  }
});

test("CLI parser behavior matches CLI_COMMAND_DEFINITIONS options", () => {
  // Test init does NOT accept --adopt
  assert.throws(() => {
    parseArgs(["init", "--adopt", "foo"]);
  }, /Option --adopt is not valid for init/i);

  // Test doctor DOES accept --adopt
  const parsedDoctor = parseArgs(["doctor", "--adopt", "foo"]);
  assert.deepEqual(parsedDoctor.options.adopt, ["foo"]);

  // Test route accepts --work and flags
  const parsedRoute = parseArgs(["route", "--work", "code", "--behavior-change"]);
  assert.equal(parsedRoute.options.work, "code");
  assert.equal(parsedRoute.options.behaviorChange, true);
});

test("PUBLIC_ERROR_CODES covers all documented stable codes", () => {
  for (const [key, errorMeta] of Object.entries(PUBLIC_ERROR_CODES)) {
    assert.equal(key, errorMeta.code);
    assert.equal(errorMeta.classification, "PUBLIC_STABLE");
    assert.ok(errorMeta.meaning);
    assert.ok(errorMeta.safeResolution);
    assert.ok(ALL_KNOWN_ERROR_CODES.has(errorMeta.code));
  }
});

test("negative fixtures & mutation tests: validateDocumentationConformance detects doc drift", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-doc-test-"));

  try {
    // Copy repository structure to tempDir
    await cp("docs", path.join(tempDir, "docs"), { recursive: true });
    await cp("schemas", path.join(tempDir, "schemas"), { recursive: true });
    await cp("src", path.join(tempDir, "src"), { recursive: true });
    await cp("AGENTS.md", path.join(tempDir, "AGENTS.md"));
    await cp("CLAUDE.md", path.join(tempDir, "CLAUDE.md"));
    await cp(".cursor", path.join(tempDir, ".cursor"), { recursive: true });
    await cp(".github", path.join(tempDir, ".github"), { recursive: true });

    // Baseline check
    const baseline = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(baseline.valid, true);

    const docFile = path.join(tempDir, "docs", "ARTIFACT_REFERENCE.md");
    const cliDocFile = path.join(tempDir, "docs", "CLI_REFERENCE.md");

    // Mutation 1: execution.kind corrupted from COMMAND_EXECUTION to command
    let docContent = await readFile(docFile, "utf8");
    await writeFile(docFile, docContent.replace("COMMAND_EXECUTION", "command"), "utf8");
    const mut1 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut1.valid, false);
    assert.ok(mut1.errors.some((e) => e.includes("DOC_EXECUTION_KIND_CONST_MISMATCH")));
    await writeFile(docFile, docContent, "utf8");

    // Mutation 2: execution.exitCode corrupted to integer only
    await writeFile(docFile, docContent.replace("integer or null", "integer"), "utf8");
    const mut2 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut2.valid, false);
    assert.ok(mut2.errors.some((e) => e.includes("DOC_EXECUTION_EXIT_CODE_TYPE_MISMATCH")));
    await writeFile(docFile, docContent, "utf8");

    // Mutation 3: init documented with --adopt
    let cliContent = await readFile(cliDocFile, "utf8");
    await writeFile(cliDocFile, cliContent.replace("### `init`\n\nInitializes ForgeLoop in a target repository.\n\n- **Purpose**: Installs canonical instruction templates under `.forgeloop/kit/`, creates discovery shims at root, and prepares `.forgeloop/`.\n- **When to use**: Once when onboarding a new repository to ForgeLoop.\n- **Mutation**: Writes `.forgeloop/kit/`, `.forgeloop/forgeloop.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`.\n- **Options**:\n  - `--dry-run`: Show planned writes without modifying files.", "### `init`\n\nInitializes ForgeLoop in a target repository.\n\n- **Purpose**: Installs canonical instruction templates under `.forgeloop/kit/`, creates discovery shims at root, and prepares `.forgeloop/`.\n- **When to use**: Once when onboarding a new repository to ForgeLoop.\n- **Mutation**: Writes `.forgeloop/kit/`, `.forgeloop/forgeloop.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`.\n- **Options**:\n  - `--adopt <path>`: Adopt adapter.\n  - `--dry-run`: Show planned writes without modifying files."), "utf8");
    const mut3 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut3.valid, false);
    assert.ok(mut3.errors.some((e) => e.includes("DOC_INIT_ADOPT_EXTRA") || e.includes("DOC_CLI_OPTION_EXTRA")));
    await writeFile(cliDocFile, cliContent, "utf8");

    // Mutation 4: current-contract requirement id marked required
    await writeFile(docFile, docContent.replace("- `id` *(string, optional)*", "- `id` *(string, required)*"), "utf8");
    const mut4 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut4.valid, false);
    assert.ok(mut4.errors.some((e) => e.includes("DOC_CONTRACT_REQUIREMENT_ID_REQUIRED_MISMATCH")));
    await writeFile(docFile, docContent, "utf8");

    // Mutation 5: Missing adapter resume rule
    const agentsFile = path.join(tempDir, "AGENTS.md");
    let agentsContent = await readFile(agentsFile, "utf8");
    await writeFile(agentsFile, agentsContent.replace(/work-state\.json/g, "other-state.json"), "utf8");
    const mut5 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut5.valid, false);
    assert.ok(mut5.errors.some((e) => e.includes("DOC_ADAPTER_RESUME_RULE_MISSING")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
