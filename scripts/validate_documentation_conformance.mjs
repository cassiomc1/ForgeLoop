#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMANDS } from "../src/cli.js";
import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { DISCOVERY_SURFACES } from "../src/core/discovery-surfaces.js";
import { ALL_KNOWN_ERROR_CODES, PUBLIC_ERROR_CODES } from "../src/core/error-codes.js";
import { nativeShim } from "../src/core/native-adapters.js";
import { WORK_PHASES } from "../src/core/protocol.js";
import { readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = getPackageRoot();

/**
 * Normalizes a raw option string from Markdown to match CLI definition option keys.
 * Examples:
 *   "`--path <directory>`" -> "--path"
 *   "`-- <argv...>`" -> "--"
 *   "`<name>`" -> "<name>"
 */
export function normalizeCliOption(rawOption) {
  const cleaned = rawOption.trim().replace(/`/g, "");
  if (cleaned.startsWith("-- ")) return "--";
  if (cleaned.startsWith("<") && cleaned.endsWith(">")) return cleaned;
  return cleaned.split(" ")[0];
}

/**
 * Validates documentation against canonical schemas, CLI registry, and protocol constants.
 * Purely structural, deterministic, offline, and side-effect-free.
 */
export async function validateDocumentationConformance({ rootDir = repositoryRoot } = {}) {
  const errors = [];

  // =========================================================================
  // 1. Validate Artifact Reference against JSON Schemas & Registry
  // =========================================================================
  const artifactDocPath = path.join(rootDir, "docs", "ARTIFACT_REFERENCE.md");
  const artifactDocContent = await readFile(artifactDocPath, "utf8");

  // Extract sections tagged with <!-- forgeloop-doc: schema=X artifact=Y -->
  const docTagPattern = /<!--\s*forgeloop-doc:\s*schema=([a-z0-9_-]+)\s+artifact=(.+?)\s*-->/g;
  let match;
  const taggedArtifacts = new Map();

  while ((match = docTagPattern.exec(artifactDocContent)) !== null) {
    const [, schemaName, rawArtifactPath] = match;
    const artifactPath = rawArtifactPath.trim();
    const tagIndex = match.index;
    const nextTagIndex = artifactDocContent.indexOf("<!-- forgeloop-doc:", tagIndex + match[0].length);
    const sectionContent = nextTagIndex !== -1
      ? artifactDocContent.slice(tagIndex, nextTagIndex)
      : artifactDocContent.slice(tagIndex);

    taggedArtifacts.set(schemaName, { artifactPath, sectionContent });
  }

  // Ensure all public registered artifacts with a schema are covered
  for (const [key, artifactInfo] of Object.entries(ARTIFACT_REGISTRY)) {
    if (!artifactInfo.isPublic) continue;
    if (!taggedArtifacts.has(artifactInfo.schema)) {
      errors.push(
        `DOC_ARTIFACT_SECTION_MISSING: Artifact "${key}" with schema "${artifactInfo.schema}" is missing a tagged section in docs/ARTIFACT_REFERENCE.md`,
      );
    } else {
      const tagged = taggedArtifacts.get(artifactInfo.schema);
      if (tagged.artifactPath !== artifactInfo.path) {
        errors.push(
          `DOC_ARTIFACT_PATH_MISMATCH: Artifact "${key}" tagged path "${tagged.artifactPath}" does not match registry path "${artifactInfo.path}"`,
        );
      }
    }
  }

  // Validate each tagged schema section
  for (const [schemaName, { artifactPath, sectionContent }] of taggedArtifacts.entries()) {
    let schema;
    try {
      schema = await readSchema(schemaName, packageRoot);
    } catch (err) {
      errors.push(`DOC_SCHEMA_NOT_FOUND: Schema "${schemaName}" for artifact "${artifactPath}" cannot be loaded: ${err.message}`);
      continue;
    }

    if (!schema.properties) continue;

    // Extract documented top-level property names: - `propertyName` (not indented)
    const documentedFieldMatches = sectionContent.matchAll(
      /(?:^|\n)- `([a-zA-Z0-9_-]+)`(?:\s*\*\(([^)]+)\)\*)?/g,
    );
    const documentedFields = new Map();
    for (const fieldMatch of documentedFieldMatches) {
      const fieldName = fieldMatch[1];
      const modifiers = (fieldMatch[2] ?? "").toLowerCase();
      documentedFields.set(fieldName, {
        isRequired: modifiers.includes("required"),
        isOptional: modifiers.includes("optional"),
        rawModifiers: modifiers,
      });
    }

    const schemaProperties = Object.keys(schema.properties);
    const requiredProperties = new Set(schema.required ?? []);

    // Check for undocumented schema properties
    for (const prop of schemaProperties) {
      if (!documentedFields.has(prop)) {
        errors.push(
          `DOC_SCHEMA_FIELD_MISSING: In "${artifactPath}" (schema "${schemaName}"), schema property "${prop}" is not documented in docs/ARTIFACT_REFERENCE.md`,
        );
      }
    }

    // Check for fake/extra documented properties that don't exist in schema
    for (const prop of documentedFields.keys()) {
      if (!schema.properties[prop]) {
        errors.push(
          `DOC_SCHEMA_FIELD_EXTRA: In "${artifactPath}" (schema "${schemaName}"), documented property "${prop}" does not exist in schema`,
        );
      }
    }

    // Check required vs optional alignment
    for (const [prop, docMeta] of documentedFields.entries()) {
      if (!schema.properties[prop]) continue;
      const schemaRequires = requiredProperties.has(prop);
      if (schemaRequires && docMeta.isOptional) {
        errors.push(
          `DOC_SCHEMA_REQUIRED_MISMATCH: In "${artifactPath}" property "${prop}" is required in schema but documented as optional`,
        );
      } else if (!schemaRequires && docMeta.isRequired) {
        errors.push(
          `DOC_SCHEMA_OPTIONAL_MISMATCH: In "${artifactPath}" property "${prop}" is optional in schema but documented as required`,
        );
      }
    }

    // Specific structural & semantic constraints:
    // 1. Gate decisions must be array of strings, not array of objects
    if (schemaName === "gate") {
      if (schema.properties.decisions?.items?.type !== "string") {
        errors.push(`DOC_SCHEMA_TYPE_MISMATCH: Gate decisions in schema must be array of string`);
      }
      if (sectionContent.includes("decision-1") || sectionContent.includes("\"text\":")) {
        errors.push(`DOC_SCHEMA_STRUCTURE_MISMATCH: Gate decisions must be documented as array of strings`);
      }
    }

    // 2. Events must document seq, event, at, hash, previousHash
    if (schemaName === "event") {
      for (const expectedField of ["seq", "event", "at", "previousHash", "hash"]) {
        if (!documentedFields.has(expectedField)) {
          errors.push(`DOC_EVENT_FIELD_MISSING: Event ledger must document "${expectedField}"`);
        }
      }
      for (const nonPersistedField of ["eventId", "sequence", "prevHash"]) {
        if (documentedFields.has(nonPersistedField)) {
          errors.push(`DOC_EVENT_NON_PERSISTED_FIELD: Event ledger must not document non-persisted runtime name "${nonPersistedField}"`);
        }
      }
    }

    // 3. Execution artifacts must have kind: const COMMAND_EXECUTION and exitCode: integer or null
    if (schemaName === "execution") {
      if (/output logs|stdout\/stderr logs|captures output/i.test(sectionContent)) {
        errors.push(`DOC_EXECUTION_STDOUT_CLAIM: Execution artifact documentation must not claim stdout/stderr logs are stored`);
      }
      if (!sectionContent.includes("COMMAND_EXECUTION")) {
        errors.push(`DOC_EXECUTION_KIND_CONST_MISMATCH: Execution kind must be documented as const COMMAND_EXECUTION`);
      }
      const exitCodeLine = sectionContent.split("\n").find((l) => l.includes("`exitCode`"));
      if (!exitCodeLine || !/integer\s+or\s+null/i.test(exitCodeLine)) {
        errors.push(`DOC_EXECUTION_EXIT_CODE_TYPE_MISMATCH: Execution exitCode must be documented as integer or null`);
      }
    }

    // 4. Contract assumptions source const and requirement structure
    if (schemaName === "current-contract") {
      const sourceProp = schema.properties.assumptions?.items?.properties?.source;
      if (sourceProp?.const !== "agent-default") {
        errors.push(`DOC_CONTRACT_SOURCE_CONST: Contract assumption source must be const "agent-default"`);
      }
      // Check requirement definitions in current-contract
      if (!sectionContent.includes("PRODUCT") || !sectionContent.includes("VERIFICATION") || !sectionContent.includes("LIFECYCLE")) {
        errors.push(`DOC_CONTRACT_REQUIREMENT_TYPES_MISSING: current-contract verification must document all requirement types including PRODUCT`);
      }
      const reqIdLine = sectionContent.split("\n").find((l) => l.includes("`id`"));
      if (reqIdLine && /required/i.test(reqIdLine)) {
        errors.push(`DOC_CONTRACT_REQUIREMENT_ID_REQUIRED_MISMATCH: requirement id is optional in schema`);
      }
    }
  }

  // =========================================================================
  // 2. Validate CLI Reference against COMMANDS and CLI_COMMAND_DEFINITIONS
  // =========================================================================
  const cliDocPath = path.join(rootDir, "docs", "CLI_REFERENCE.md");
  const cliDocContent = await readFile(cliDocPath, "utf8");

  // Every command in COMMANDS must have a heading: ### `command`
  for (const command of COMMANDS) {
    const headingPattern = new RegExp(`### \`${command}\``);
    if (!headingPattern.test(cliDocContent)) {
      errors.push(`DOC_CLI_COMMAND_MISSING: Command "${command}" is not documented in docs/CLI_REFERENCE.md`);
    }

    const commandDef = CLI_COMMAND_DEFINITIONS[command];
    if (!commandDef) {
      errors.push(`CLI_DEFINITION_MISSING: Command "${command}" missing from CLI_COMMAND_DEFINITIONS`);
      continue;
    }

    // Extract section for this command
    const sectionStart = cliDocContent.indexOf(`### \`${command}\``);
    if (sectionStart !== -1) {
      const nextHeadingIndex = cliDocContent.indexOf("\n### `", sectionStart + 5);
      const commandSection = nextHeadingIndex !== -1
        ? cliDocContent.slice(sectionStart, nextHeadingIndex)
        : cliDocContent.slice(sectionStart);

      // Validate documented flags under this command
      const documentedOptionMatches = commandSection.matchAll(
        /(?:^|\n)[ \t]*-[ \t]*(`--?[a-zA-Z0-9_-]+(?: <[^>]+>)?`|`-- <[^>]+>`|`<[a-zA-Z0-9_-]+>`)/g,
      );
      const documentedOptions = new Set();
      for (const optMatch of documentedOptionMatches) {
        documentedOptions.add(normalizeCliOption(optMatch[1]));
      }

      // Check for missing command options (excluding global options --path, --help, --version unless explicitly in command options)
      for (const optKey of Object.keys(commandDef.options)) {
        if (optKey === "--path" || optKey === "--help" || optKey === "--version") continue;
        if (!documentedOptions.has(optKey)) {
          errors.push(
            `DOC_CLI_OPTION_MISSING: Command "${command}" definition includes option "${optKey}" which is not documented in CLI_REFERENCE.md`,
          );
        }
      }

      // Check for extra documented options that command does not accept
      for (const docOpt of documentedOptions) {
        if (!commandDef.options[docOpt] && docOpt !== "--path" && docOpt !== "--help" && docOpt !== "--version") {
          errors.push(
            `DOC_CLI_OPTION_EXTRA: Command "${command}" in CLI_REFERENCE.md documents unsupported option "${docOpt}"`,
          );
        }
      }

      // Check run-check specifically for stdout/stderr claims
      if (command === "run-check" && /captures (exit code and )?output/i.test(commandSection)) {
        errors.push(`DOC_RUN_CHECK_STDOUT_CLAIM: run-check documentation must not claim stdout/stderr logs are captured or stored`);
      }

      // Check init specifically to ensure --adopt is not present
      if (command === "init" && documentedOptions.has("--adopt")) {
        errors.push(`DOC_INIT_ADOPT_EXTRA: init command does not accept --adopt; --adopt is a doctor option`);
      }
    }
  }

  // Bidirectional check: ensure no extra commands are documented
  const documentedCommandHeadings = [...cliDocContent.matchAll(/### `([a-z0-9_-]+)`/g)].map((m) => m[1]);
  const knownCommandSet = new Set(COMMANDS);
  for (const docCommand of documentedCommandHeadings) {
    if (!knownCommandSet.has(docCommand)) {
      errors.push(`DOC_CLI_COMMAND_EXTRA: Documented command "${docCommand}" does not exist in COMMANDS`);
    }
  }

  // =========================================================================
  // 3. Validate Public Error Codes against docs/TROUBLESHOOTING.md
  // =========================================================================
  const troubleDocPath = path.join(rootDir, "docs", "TROUBLESHOOTING.md");
  const troubleDocContent = await readFile(troubleDocPath, "utf8");

  // Every PUBLIC_ERROR_CODE must be documented
  for (const [, codeMeta] of Object.entries(PUBLIC_ERROR_CODES)) {
    if (!troubleDocContent.includes(codeMeta.code)) {
      errors.push(
        `DOC_ERROR_CODE_MISSING: Stable public error code "${codeMeta.code}" is not documented in docs/TROUBLESHOOTING.md`,
      );
    }
  }

  // Extract all E_* error codes from TROUBLESHOOTING.md and verify they exist in ALL_KNOWN_ERROR_CODES
  const documentedCodes = [...new Set(troubleDocContent.match(/\bE_[A-Z0-9_]+\b/g) ?? [])];
  for (const code of documentedCodes) {
    if (!ALL_KNOWN_ERROR_CODES.has(code)) {
      errors.push(
        `DOC_ERROR_CODE_UNKNOWN: Documented error code "${code}" does not exist in ALL_KNOWN_ERROR_CODES`,
      );
    }
  }

  // =========================================================================
  // 4. Validate Lifecycle Phases against WORK_PHASES
  // =========================================================================
  for (const phase of WORK_PHASES) {
    if (!artifactDocContent.includes(phase)) {
      errors.push(`DOC_LIFECYCLE_PHASE_MISSING: Lifecycle phase "${phase}" is not referenced in docs/ARTIFACT_REFERENCE.md`);
    }
  }

  // =========================================================================
  // 5. Validate Cross-Harness Resume Rules across Adapters
  // =========================================================================
  const resumePattern = /work-state\.json`?\s+exists/i;
  for (const surface of DISCOVERY_SURFACES) {
    const surfacePath = path.join(rootDir, surface.path);
    const content = await readFile(surfacePath, "utf8");
    if (!resumePattern.test(content)) {
      errors.push(`DOC_ADAPTER_RESUME_RULE_MISSING: Adapter "${surface.path}" is missing cross-harness resume rule`);
    }
    if (!/forgeloop next/i.test(content)) {
      errors.push(`DOC_ADAPTER_NEXT_ACTION_MISSING: Adapter "${surface.path}" is missing reference to forgeloop next`);
    }
  }

  for (const surface of DISCOVERY_SURFACES) {
    const shim = nativeShim(surface.path);
    if (!resumePattern.test(shim)) {
      errors.push(`DOC_NATIVE_SHIM_RESUME_RULE_MISSING: nativeShim for "${surface.path}" is missing cross-harness resume rule`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      taggedArtifactsCount: taggedArtifacts.size,
      commandsCount: COMMANDS.length,
      publicErrorCodesCount: Object.keys(PUBLIC_ERROR_CODES).length,
      discoverySurfacesCount: DISCOVERY_SURFACES.length,
    },
  };
}

// Direct execution CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const result = await validateDocumentationConformance();
    if (!result.valid) {
      console.error("\n❌ DOCUMENTATION CONFORMANCE FAILURES:");
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log(
      `Documentation conformance valid: ${result.summary.taggedArtifactsCount} artifacts, ${result.summary.commandsCount} commands, ${result.summary.publicErrorCodesCount} error codes, ${result.summary.discoverySurfacesCount} discovery adapters`,
    );
  } catch (error) {
    console.error(`Documentation conformance crashed: ${error.message}`);
    process.exit(1);
  }
}
