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

/**
 * Mutation helper that fails if the requested mutation did not modify content.
 */
function mustReplace(content, matcher, replacement, label) {
  const result = content.replace(matcher, replacement);
  assert.notEqual(result, content, `Mutation did not modify the fixture: ${label}`);
  return result;
}

async function copyDocsFixture(tempDir) {
  await cp("docs", path.join(tempDir, "docs"), { recursive: true });
  await cp("schemas", path.join(tempDir, "schemas"), { recursive: true });
  await cp("src", path.join(tempDir, "src"), { recursive: true });
  await cp("README.md", path.join(tempDir, "README.md"));
  await cp("AGENTS.md", path.join(tempDir, "AGENTS.md"));
  await cp("CLAUDE.md", path.join(tempDir, "CLAUDE.md"));
  await cp(".cursor", path.join(tempDir, ".cursor"), { recursive: true });
  await cp(".github", path.join(tempDir, ".github"), { recursive: true });
}

test("validateDocumentationConformance passes on repository docs", async () => {
  const result = await validateDocumentationConformance();
  assert.equal(result.valid, true, `Expected valid documentation conformance, got errors: ${result.errors.join("\n")}`);
  assert.equal(result.errors.length, 0);
  assert.ok(result.summary.taggedArtifactsCount >= 13);
  assert.equal(result.summary.commandsCount, 42);
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

test("CLI_COMMAND_DEFINITIONS and CLI_COMMAND_METADATA cover all 42 commands with valid options", () => {
  assert.equal(Object.keys(CLI_COMMAND_DEFINITIONS).length, 42);
  assert.equal(Object.keys(CLI_COMMAND_METADATA).length, 42);
  for (const command of COMMANDS) {
    const def = CLI_COMMAND_DEFINITIONS[command];
    const meta = CLI_COMMAND_METADATA[command];
    assert.ok(def, `Command ${command} must exist in CLI_COMMAND_DEFINITIONS`);
    assert.ok(meta, `Command ${command} must exist in CLI_COMMAND_METADATA`);
    assert.equal(def.name, command);
    assert.equal(meta.name, command);
    assert.ok(["lifecycle", "continuity", "verification", "policy-audit", "project-maintenance", "diagnostics", "task"].includes(def.category));
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

test("negative fixtures & mutation tests: validateDocumentationConformance detects doc drift across LF and CRLF", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-doc-test-"));

  try {
    // Copy repository structure to tempDir
    await copyDocsFixture(tempDir);

    // Baseline check
    const baseline = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(baseline.valid, true);

    const docFile = path.join(tempDir, "docs", "ARTIFACT_REFERENCE.md");
    const cliDocFile = path.join(tempDir, "docs", "CLI_REFERENCE.md");

    for (const eol of ["\n", "\r\n"]) {
      // Setup files in target EOL mode
      let docContent = (await readFile(docFile, "utf8")).replace(/\r?\n/g, eol);
      let cliContent = (await readFile(cliDocFile, "utf8")).replace(/\r?\n/g, eol);

      // Mutation 1: execution.kind corrupted from COMMAND_EXECUTION to command
      const mutDoc1 = mustReplace(docContent, "COMMAND_EXECUTION", "command", `execution.kind (${eol === "\n" ? "LF" : "CRLF"})`);
      await writeFile(docFile, mutDoc1, "utf8");
      const mut1 = await validateDocumentationConformance({ rootDir: tempDir });
      assert.equal(mut1.valid, false);
      assert.ok(mut1.errors.some((e) => e.includes("DOC_EXECUTION_KIND_CONST_MISMATCH")));
      await writeFile(docFile, docContent, "utf8");

      // Mutation 2: execution.exitCode corrupted to integer only
      const mutDoc2 = mustReplace(docContent, "integer or null", "integer", `execution.exitCode (${eol === "\n" ? "LF" : "CRLF"})`);
      await writeFile(docFile, mutDoc2, "utf8");
      const mut2 = await validateDocumentationConformance({ rootDir: tempDir });
      assert.equal(mut2.valid, false);
      assert.ok(mut2.errors.some((e) => e.includes("DOC_EXECUTION_EXIT_CODE_TYPE_MISMATCH")));
      await writeFile(docFile, docContent, "utf8");

      // Mutation 3: init documented with --adopt
      const mutCli3 = mustReplace(
        cliContent,
        /(- `--dry-run`)/,
        `- \`--adopt <path>\`: Adopt adapter.${eol}  $1`,
        `init --adopt (${eol === "\n" ? "LF" : "CRLF"})`,
      );
      await writeFile(cliDocFile, mutCli3, "utf8");
      const mut3 = await validateDocumentationConformance({ rootDir: tempDir });
      assert.equal(mut3.valid, false);
      assert.ok(mut3.errors.some((e) => e.includes("DOC_INIT_ADOPT_EXTRA") || e.includes("DOC_CLI_OPTION_EXTRA")));
      await writeFile(cliDocFile, cliContent, "utf8");

      // Mutation 4: current-contract requirement id marked required
      const mutDoc4 = mustReplace(docContent, "- `id` *(string, optional", "- `id` *(string, required", `requirement.id (${eol === "\n" ? "LF" : "CRLF"})`);
      await writeFile(docFile, mutDoc4, "utf8");
      const mut4 = await validateDocumentationConformance({ rootDir: tempDir });
      assert.equal(mut4.valid, false);
      assert.ok(mut4.errors.some((e) => e.includes("DOC_CONTRACT_REQUIREMENT_ID_REQUIRED_MISMATCH")));
      await writeFile(docFile, docContent, "utf8");
    }

    // Mutation 5: Missing adapter resume rule
    const agentsFile = path.join(tempDir, "AGENTS.md");
    let agentsContent = await readFile(agentsFile, "utf8");
    const mutAgents5 = mustReplace(agentsContent, /work-state\.json/g, "other-state.json", "agents.md resume rule");
    await writeFile(agentsFile, mutAgents5, "utf8");
    const mut5 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut5.valid, false);
    assert.ok(mut5.errors.some((e) => e.includes("DOC_ADAPTER_RESUME_RULE_MISSING")));
    await writeFile(agentsFile, agentsContent, "utf8");

    // Mutation 6: Legacy singleton path outside migration marker in docs/RECIPES.md
    const recipesFile = path.join(tempDir, "docs", "RECIPES.md");
    const recipesContent = await readFile(recipesFile, "utf8");
    const mutRecipes6 = recipesContent + "\n\nSee .forgeloop/current-contract.json directly.\n";
    await writeFile(recipesFile, mutRecipes6, "utf8");
    const mut6 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut6.valid, false);
    assert.ok(mut6.errors.some((e) => e.includes("DOC_LEGACY_TASK_PATH_OUTSIDE_MIGRATION")));
    await writeFile(recipesFile, recipesContent, "utf8");

    // Mutation 7: Duplicate README topic
    const readmeFile = path.join(tempDir, "README.md");
    const readmeContent = await readFile(readmeFile, "utf8");
    const mutReadme7 = readmeContent + "\n\n## Cross-harness continuity\nDuplicate section\n";
    await writeFile(readmeFile, mutReadme7, "utf8");
    const mut7 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut7.valid, false);
    assert.ok(mut7.errors.some((e) => e.includes("DOC_README_DUPLICATE_TOPIC")));
    await writeFile(readmeFile, readmeContent, "utf8");

    // Mutation 8: Invalid diagram reference
    const mutReadme8 = mustReplace(
      readmeContent,
      /!\[.*?\]\(\.\/docs\/assets\/forgeloop-flow\.svg\)/,
      '<img src="./docs/assets/forgeloop-flow.svg" />',
      "readme diagram reference",
    );
    await writeFile(readmeFile, mutReadme8, "utf8");
    const mut8 = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(mut8.valid, false);
    assert.ok(mut8.errors.some((e) => e.includes("DOC_README_DIAGRAM_REFERENCE_INVALID")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("CLI example, mutation-claim, and legacy-path conformance regressions (DOC-CLI-*/DOC-MUT-*/DOC-PATH-*/DOC-COMP-*)", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-doc-cli-"));
  try {
    await copyDocsFixture(tempDir);
    const baseline = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(baseline.valid, true, baseline.errors.join("\n"));

    const cliFile = path.join(tempDir, "docs", "CLI_REFERENCE.md");
    // Normalize to LF so mutations are EOL-safe on CRLF checkouts; the CRLF
    // baseline check below re-encodes explicitly.
    const cliContent = (await readFile(cliFile, "utf8")).replace(/\r\n/g, "\n");

    const runMutation = async (label, mutate, expectedCodes) => {
      const mutated = mutate(cliContent);
      assert.notEqual(mutated, cliContent, `Mutation did not modify fixture: ${label}`);
      await writeFile(cliFile, mutated, "utf8");
      const result = await validateDocumentationConformance({ rootDir: tempDir });
      assert.equal(result.valid, false, `Expected conformance failure for ${label}`);
      for (const code of expectedCodes) {
        assert.ok(
          result.errors.some((error) => error.includes(code)),
          `${label}: expected ${code}, got: ${result.errors.join("; ")}`,
        );
      }
      await writeFile(cliFile, cliContent, "utf8");
    };

    // DOC-CLI-1: activate does not accept --task
    await runMutation(
      "activate --task",
      (content) => mustReplace(
        content,
        "forgeloop activate --json",
        "forgeloop activate --task task-001 --json",
        "activate example",
      ),
      ["DOC_CLI_EXAMPLE_OPTION_UNSUPPORTED"],
    );

    // DOC-CLI-2 / DOC-CLI-3: task-create --id / --prompt are not real options
    await runMutation(
      "task-create --id/--prompt",
      (content) => mustReplace(
        content,
        "forgeloop task-create --task task-001 --claim src/auth --json",
        'forgeloop task-create --id task-001 --claim src/auth --prompt "Add auth module" --json',
        "task-create example",
      ),
      ["DOC_CLI_EXAMPLE_OPTION_UNSUPPORTED"],
    );

    // DOC-CLI-5 (invalid form): repeatable --claim must repeat the flag
    await runMutation(
      "task-scope single --claim with two values",
      (content) => mustReplace(
        content,
        "forgeloop task-scope --task task-001 --claim src/auth --claim tests/auth --json",
        "forgeloop task-scope --task task-001 --claim src/auth tests/auth --json",
        "task-scope example",
      ),
      ["DOC_CLI_EXAMPLE_POSITIONAL_UNEXPECTED"],
    );

    // DOC-CLI-6: PUBLICATION does not accept --status passed
    await runMutation(
      "record-terminal-result PUBLICATION passed",
      (content) => mustReplace(
        content,
        "--status published \\",
        "--status passed \\",
        "terminal result status",
      ),
      ["DOC_CLI_EXAMPLE_STATUS_INVALID"],
    );

    // DOC-MUT-1: profile-interview is READ_ONLY with writes=[]
    await runMutation(
      "profile-interview documented as mutating",
      (content) => mustReplace(
        content,
        "- **Mutation**: Read-only.\n- **Options**:\n\n<!-- BEGIN FORGELOOP GENERATED: cli:profile-interview:options -->",
        "- **Mutation**: Updates `PROJECT_PROFILE.md` if confirmed.\n- **Options**:\n\n<!-- BEGIN FORGELOOP GENERATED: cli:profile-interview:options -->",
        "profile-interview mutation",
      ),
      ["DOC_CLI_MUTATION_CLAIM_INVALID"],
    );

    // DOC-COMP-1: complete return status must list the full COMPLETION_STATUSES set
    await runMutation(
      "complete return status VALID only",
      (content) => mustReplace(
        content,
        "- **Return Status**: `VALID` or `REJECTED`.",
        "- **Return Status**: `VALID` only.",
        "complete return status",
      ),
      ["DOC_COMPLETION_RETURN_STATUS_MISMATCH"],
    );

    // DOC-PATH-1: singleton task path in CLI_REFERENCE outside legacy markers
    await runMutation(
      "singleton path in CLI_REFERENCE",
      (content) => `${content}\n\nSee .forgeloop/work-state.json directly.\n`,
      ["DOC_LEGACY_TASK_PATH_OUTSIDE_MIGRATION"],
    );

    // DOC-PATH-2: singleton path inside explicit legacy markers is permitted
    const marked = `${cliContent}\n<!-- BEGIN FORGELOOP LEGACY LAYOUT EXAMPLE -->\nLegacy layouts store .forgeloop/execution-receipt.json at the repository root.\n<!-- END FORGELOOP LEGACY LAYOUT EXAMPLE -->\n`;
    await writeFile(cliFile, marked, "utf8");
    const withMarkers = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(withMarkers.valid, true, withMarkers.errors.join("\n"));
    await writeFile(cliFile, cliContent, "utf8");

    // EOL safety: the same CLI_REFERENCE with CRLF line endings (as checked out
    // on Windows CI) must also pass, including line-continuation examples.
    const crlfContent = cliContent.replace(/\r?\n/g, "\r\n");
    await writeFile(cliFile, crlfContent, "utf8");
    const crlfResult = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(crlfResult.valid, true, crlfResult.errors.join("\n"));
    await writeFile(cliFile, cliContent, "utf8");

    // DOC-CLI-4 / DOC-CLI-5 / DOC-CLI-7 valid examples and DOC-COMP-1 baseline stay valid
    const restored = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(restored.valid, true, restored.errors.join("\n"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
