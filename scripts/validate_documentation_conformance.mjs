#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMANDS } from "../src/cli.js";
import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { COMPLETION_STATUSES } from "../src/core/completion.js";
import { PRODUCTION_READINESS_STATUSES, PUBLICATION_STATUSES } from "../src/core/completion-artifacts.js";
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

export const OPERATIONAL_DOCUMENTS = Object.freeze([
  "README.md",
  "docs/GETTING_STARTED.md",
  "docs/CROSS_HARNESS_CONTINUITY.md",
  "docs/CLI_REFERENCE.md",
  "docs/RECIPES.md",
  "docs/TROUBLESHOOTING.md",
  "LOOP_ENGINEERING.md",
  "EXECUTION_STATE.md",
  "PROTOCOL_INTEGRATION.md",
]);

export const LEGACY_TASK_PATH_PATTERNS = Object.freeze([
  /\.forgeloop\/current-contract\.json/g,
  /\.forgeloop\/routing-result\.json/g,
  /\.forgeloop\/preflight\.json/g,
  /\.forgeloop\/work-state\.json/g,
  /\.forgeloop\/continuity\.json/g,
  /\.forgeloop\/execution-receipt\.json/g,
  /\.forgeloop\/events\.ndjson/g,
  /\.forgeloop\/gates(?:\/|`|\b)/g,
  /\.forgeloop\/executions(?:\/|`|\b)/g,
]);

export function stripLegacyLayoutExamples(content) {
  return content.replace(
    /<!-- BEGIN FORGELOOP LEGACY LAYOUT EXAMPLE -->[\s\S]*?<!-- END FORGELOOP LEGACY LAYOUT EXAMPLE -->/g,
    "",
  );
}

/**
 * Minimal shell-like tokenizer for documented CLI examples. Groups quoted
 * segments so option values containing spaces stay a single token. This is
 * intentionally not a full shell parser.
 */
export function tokenizeCliExampleLine(line) {
  const parts = [];
  const pattern = /--[^\s=]+=(?:"[^"]*"|'[^']*'|\S+)|"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    parts.push(match[0]);
  }
  return parts;
}

/**
 * Validates fenced shell examples inside a CLI command section against the
 * canonical command definition:
 *   - the command must exist;
 *   - every long option must exist for that command;
 *   - boolean flags must not receive values (inline `=value` or adjacent token);
 *   - value options must receive a value;
 *   - bare positional tokens are rejected unless the command defines a
 *     positional option (e.g. `policy <name>`);
 *   - content after a passthrough `--` is ignored;
 *   - record-terminal-result `--type`/`--status` pairs must use the canonical
 *     terminal status sets.
 * Comments, environment assignments, and line continuations are ignored.
 */
export function validateCliExamples(sectionContent, command, commandDef) {
  const errors = [];
  const stripQuotes = (value) => (typeof value === "string" ? value.replace(/^["']|["']$/g, "") : value);
  const exampleBlocks = [...sectionContent.matchAll(/```(?:bash|sh)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const hasPositional = Object.keys(commandDef.options).some((key) => /^<[^>]+>$/.test(key));

  for (const block of exampleBlocks) {
    // Join continuation lines (trailing backslash) before parsing. EOL-safe:
    // GitHub Actions may check out the repository with CRLF line endings.
    const joined = block.replace(/\\\r?\n/g, " ");
    for (const rawLine of joined.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/\\$/, "");
      if (!line || line.startsWith("#")) continue;
      if (/^(export\s+)?[A-Za-z_][A-Za-z0-9_]*=/.test(line)) continue; // environment assignment
      if (!line.startsWith("forgeloop ")) continue;
      const parts = tokenizeCliExampleLine(line);
      const exampleCommand = parts[1];
      if (!exampleCommand || exampleCommand.startsWith("-")) continue; // e.g. `forgeloop --help`
      const exampleDef = CLI_COMMAND_DEFINITIONS[exampleCommand];
      if (!exampleDef) {
        errors.push(
          `DOC_CLI_EXAMPLE_COMMAND_UNKNOWN: Command "${command}" example references unknown command "${exampleCommand}"`,
        );
        continue;
      }

      let sawPassthrough = false;
      let typeValue = null;
      let statusValue = null;
      for (let index = 2; index < parts.length; index += 1) {
        const arg = parts[index];
        if (sawPassthrough) break;
        if (arg === "--") {
          sawPassthrough = true;
          break;
        }
        if (!arg.startsWith("--")) {
          if (!hasPositional) {
            errors.push(
              `DOC_CLI_EXAMPLE_POSITIONAL_UNEXPECTED: Command "${command}" example passes unexpected positional "${arg}" (${exampleCommand})`,
            );
          }
          continue;
        }
        const equalsIndex = arg.indexOf("=");
        const flag = equalsIndex !== -1 ? arg.slice(0, equalsIndex) : arg;
        const inlineValue = equalsIndex !== -1 ? arg.slice(equalsIndex + 1) : undefined;
        const option = exampleDef.options[flag];
        if (!option) {
          errors.push(
            `DOC_CLI_EXAMPLE_OPTION_UNSUPPORTED: Command "${command}" example uses unsupported option "${flag}" (${exampleCommand})`,
          );
          continue;
        }
        if (option.takesValue === false) {
          if (inlineValue !== undefined) {
            errors.push(
              `DOC_CLI_EXAMPLE_BOOLEAN_VALUE: Command "${command}" example passes a value to boolean option "${flag}" (${exampleCommand})`,
            );
          } else {
            const next = parts[index + 1];
            if (next !== undefined && next !== "--" && !next.startsWith("--") && !/^<.*>$/.test(next)) {
              errors.push(
                `DOC_CLI_EXAMPLE_BOOLEAN_VALUE: Command "${command}" example passes value "${next}" to boolean option "${flag}" (${exampleCommand})`,
              );
            }
          }
        } else if (inlineValue !== undefined) {
          if (flag === "--type") typeValue = stripQuotes(inlineValue);
          if (flag === "--status") statusValue = stripQuotes(inlineValue);
        } else {
          const next = parts[index + 1];
          if (next === undefined || next === "--" || next.startsWith("--")) {
            errors.push(
              `DOC_CLI_EXAMPLE_VALUE_MISSING: Command "${command}" example option "${flag}" requires a value (${exampleCommand})`,
            );
          } else {
            if (flag === "--type") typeValue = stripQuotes(next);
            if (flag === "--status") statusValue = stripQuotes(next);
            index += 1; // consume the value token
          }
        }
      }

      if (exampleCommand === "record-terminal-result" && typeValue && statusValue) {
        const allowed = typeValue === "PUBLICATION"
          ? PUBLICATION_STATUSES
          : typeValue === "PRODUCTION_READINESS"
            ? PRODUCTION_READINESS_STATUSES
            : null;
        if (allowed && !allowed.includes(statusValue)) {
          errors.push(
            `DOC_CLI_EXAMPLE_STATUS_INVALID: record-terminal-result example uses status "${statusValue}" which is not valid for type "${typeValue}"`,
          );
        }
      }
    }
  }
  return errors;
}

/**
 * Validates manual `Mutation:` prose for a CLI command section against the
 * canonical CLI definition metadata (mutation class, writes, removes).
 * Rejects:
 *   - read-only commands documented as writing/mutating;
 *   - mutating commands documented as read-only;
 *   - write/remove claims on commands whose runtime writes/removes are empty.
 */
export function validateCliMutationClaim(commandSection, command, commandDef) {
  const errors = [];
  const mutationLine = commandSection.split("\n").find((line) => /- \*\*Mutation\*\*:/.test(line));
  if (!mutationLine) return errors;
  const text = mutationLine.replace(/- \*\*Mutation\*\*:\s*/, "");
  const claimsReadOnly = /read-?only/i.test(text);
  const claimsMutation = /writes?\b|updates?\b|persists?\b|appends?\b|removes?\b|moves?\b|deletes?\b|mutat/i.test(text);

  if (commandDef.mutation === "READ_ONLY") {
    if (!claimsReadOnly && claimsMutation) {
      errors.push(
        `DOC_CLI_MUTATION_CLAIM_INVALID: Command "${command}" is READ_ONLY but documented as mutating ("${text.trim()}")`,
      );
    }
  } else {
    if (claimsReadOnly) {
      errors.push(
        `DOC_CLI_MUTATION_CLAIM_INVALID: Command "${command}" mutates (${commandDef.mutation}) but is documented as read-only ("${text.trim()}")`,
      );
    }
  }

  if (claimsMutation && !claimsReadOnly && commandDef.writes.length === 0 && commandDef.removes.length === 0) {
    errors.push(
      `DOC_CLI_MUTATION_CLAIM_INVALID: Command "${command}" claims writes/removes but runtime writes=[] and removes=[] ("${text.trim()}")`,
    );
  }
  return errors;
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

      // Validate manual fenced examples against the canonical command definition
      errors.push(...validateCliExamples(commandSection, command, commandDef));

      // Validate manual Mutation: prose against canonical mutation metadata
      errors.push(...validateCliMutationClaim(commandSection, command, commandDef));

      // complete must document the machine-owned return status set
      if (command === "complete") {
        const returnStatusLine = commandSection.split("\n").find((line) => /- \*\*Return Status\*\*:/.test(line));
        if (!returnStatusLine) {
          errors.push(
            `DOC_COMPLETION_RETURN_STATUS_MISSING: complete must document a "Return Status" line listing ${COMPLETION_STATUSES.join(" | ")}`,
          );
        } else {
          for (const status of COMPLETION_STATUSES) {
            if (!returnStatusLine.includes(status)) {
              errors.push(
                `DOC_COMPLETION_RETURN_STATUS_MISMATCH: complete "Return Status" must include "${status}" from COMPLETION_STATUSES`,
              );
            }
          }
        }
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

  // =========================================================================
  // 6. Validate Operational Documents and Legacy Path Guard
  // =========================================================================
  for (const relativePath of OPERATIONAL_DOCUMENTS) {
    const docPath = path.join(rootDir, relativePath);
    let content = "";
    try {
      content = await readFile(docPath, "utf8");
    } catch {
      continue;
    }
    const sanitized = stripLegacyLayoutExamples(content);
    for (const pattern of LEGACY_TASK_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(sanitized)) {
        errors.push(
          `DOC_LEGACY_TASK_PATH_OUTSIDE_MIGRATION: ${relativePath} documents a ForgeLoop 1.0 singleton task path outside an explicit legacy migration region`,
        );
      }
    }
  }

  // README duplicate heading & diagram reference checks
  const readmePath = path.join(rootDir, "README.md");
  let readmeContent = "";
  try {
    readmeContent = await readFile(readmePath, "utf8");
  } catch {
    // ignore
  }

  if (readmeContent) {
    const headings = (readmeContent.match(/^#{1,6}\s+(.+)$/gm) || []).map((h) =>
      h.replace(/^#{1,6}\s+/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    );
    const crossHarnessHeadings = headings.filter((h) => h === "cross harness continuity");
    if (crossHarnessHeadings.length > 1) {
      errors.push(`DOC_README_DUPLICATE_TOPIC: README.md contains duplicate "Cross-harness continuity" heading`);
    }

    const diagramMatch = readmeContent.match(/!\[.*?\]\(((\.\/)?docs\/assets\/forgeloop-flow\.svg)\)/);
    if (!diagramMatch) {
      errors.push(`DOC_README_DIAGRAM_REFERENCE_INVALID: README.md must reference ./docs/assets/forgeloop-flow.svg via Markdown image syntax`);
    } else {
      const diagramRelPath = diagramMatch[1];
      const diagramAbsPath = path.resolve(rootDir, diagramRelPath);
      try {
        const stats = await stat(diagramAbsPath);
        if (!stats.isFile() || stats.size === 0) {
          errors.push(`DOC_README_DIAGRAM_REFERENCE_INVALID: Diagram asset ${diagramRelPath} is empty or not a regular file`);
        }
      } catch {
        errors.push(`DOC_README_DIAGRAM_REFERENCE_INVALID: Diagram asset ${diagramRelPath} does not exist`);
      }
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
