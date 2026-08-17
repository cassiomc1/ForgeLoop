#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMANDS } from "../src/cli.js";
import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { PUBLIC_ERROR_CODES } from "../src/core/error-codes.js";
import { readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = getPackageRoot();

/**
 * Deterministically generates the markdown artifact registry summary table.
 */
export function generateArtifactRegistryTable() {
  const rows = [
    "| Artifact File | Schema | Ownership | Mutability | Trust Role |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const artifact of Object.values(ARTIFACT_REGISTRY)) {
    if (!artifact.isPublic) continue;
    const fileCol = artifact.path.replace(".forgeloop/", "");
    const schemaCol = `\`${artifact.schema}\``;
    const ownerCol = artifact.owner.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const mutabilityCol = artifact.mutability.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const trustRoleCol = artifact.trustRole.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    rows.push(`| \`${fileCol}\` | ${schemaCol} | ${ownerCol} | ${mutabilityCol} | ${trustRoleCol} |`);
  }

  return rows.join("\n");
}

/**
 * Deterministically generates canonical fields for a JSON schema.
 */
export async function generateCanonicalFieldsForSchema(schemaName) {
  const schema = await readSchema(schemaName, packageRoot);
  if (!schema.properties) return "";

  const requiredProps = new Set(schema.required ?? []);
  const lines = [];

  for (const [propName, propDef] of Object.entries(schema.properties)) {
    const isRequired = requiredProps.has(propName);
    const modifiers = [];

    // Type / union
    if (propDef.oneOf) {
      const types = propDef.oneOf.map((t) => (t.type ? t.type : (t.const !== undefined ? JSON.stringify(t.const) : "object")));
      modifiers.push(types.join(" or "));
    } else if (propDef.type === "array") {
      modifiers.push("array");
    } else if (propDef.type) {
      modifiers.push(propDef.type);
    }

    modifiers.push(isRequired ? "required" : "optional");

    // Const
    if (propDef.const !== undefined) {
      modifiers.push(`const: ${typeof propDef.const === "string" ? `\`${propDef.const}\`` : propDef.const}`);
    }

    // Enum
    if (propDef.enum) {
      modifiers.push(`enum: ${propDef.enum.map((e) => `\`${e}\``).join(", ")}`);
    }

    // Pattern
    if (propDef.pattern) {
      modifiers.push(`pattern: \`${propDef.pattern}\``);
    }

    lines.push(`- \`${propName}\` *(${modifiers.join(", ")})*`);
  }

  return lines.join("\n");
}

/**
 * Deterministically generates the CLI command index table.
 */
export function generateCliCommandIndexTable() {
  const categoryMap = new Map();
  const categoryTitles = {
    "project-maintenance": "Setup & Maintenance",
    lifecycle: "Lifecycle & State",
    continuity: "Cross-Harness Continuity",
    verification: "Verification & Completion",
    diagnostics: "Inspection & Diagnostics",
    "policy-audit": "Policy & Auditing",
  };

  for (const [cmdName, def] of Object.entries(CLI_COMMAND_DEFINITIONS)) {
    const title = categoryTitles[def.category] ?? def.category;
    if (!categoryMap.has(title)) {
      categoryMap.set(title, []);
    }
    categoryMap.get(title).push(`[\`${cmdName}\`](#${cmdName})`);
  }

  const rows = [
    "| Category | Commands |",
    "| --- | --- |",
  ];

  for (const [catTitle, cmds] of categoryMap.entries()) {
    rows.push(`| **${catTitle}** | ${cmds.join(", ")} |`);
  }

  return rows.join("\n");
}

/**
 * Deterministically generates the CLI options list for a command.
 */
export function generateCliOptionsForCommand(commandName) {
  const def = CLI_COMMAND_DEFINITIONS[commandName];
  if (!def || !def.options) return "";

  const lines = [];
  for (const [optName, optDef] of Object.entries(def.options)) {
    if (optName === "--help" || optName === "--version") continue;
    let label = optName;
    if (optDef.valueName) {
      label = optName === "--" ? `-- <${optDef.valueName}>` : `${optName} <${optDef.valueName}>`;
    }
    const repeatableSuffix = optDef.repeatable ? " (repeatable)" : "";
    lines.push(`  - \`${label}\`: ${optDef.description}${repeatableSuffix}`);
  }

  return lines.join("\n");
}

/**
 * Deterministically generates the public error codes table for TROUBLESHOOTING.md.
 */
export function generatePublicErrorCodesTable() {
  const rows = [
    "| Code | Meaning | Safe Resolution |",
    "| --- | --- | --- |",
  ];

  for (const err of Object.values(PUBLIC_ERROR_CODES)) {
    rows.push(`| \`${err.code}\` | ${err.meaning} | ${err.safeResolution} |`);
  }

  return rows.join("\n");
}

/**
 * Registry of all deterministic documentation generation targets.
 */
export function getDocumentationGenerationTargets() {
  const targets = [
    {
      file: "docs/ARTIFACT_REFERENCE.md",
      region: "artifact-registry",
      generate: () => generateArtifactRegistryTable(),
    },
    {
      file: "docs/CLI_REFERENCE.md",
      region: "cli-command-index",
      generate: () => generateCliCommandIndexTable(),
    },
    {
      file: "docs/TROUBLESHOOTING.md",
      region: "public-error-codes",
      generate: () => generatePublicErrorCodesTable(),
    },
  ];

  // Schema field regions for artifacts
  for (const artifact of Object.values(ARTIFACT_REGISTRY)) {
    if (!artifact.isPublic) continue;
    targets.push({
      file: "docs/ARTIFACT_REFERENCE.md",
      region: `schema:${artifact.schema}`,
      generate: () => generateCanonicalFieldsForSchema(artifact.schema),
    });
  }

  // CLI command option regions
  for (const cmd of COMMANDS) {
    targets.push({
      file: "docs/CLI_REFERENCE.md",
      region: `cli:${cmd}:options`,
      generate: () => generateCliOptionsForCommand(cmd),
    });
  }

  return targets;
}

/**
 * Replaces or checks generated regions in target markdown files.
 * @param {Object} options
 * @param {string} options.rootDir - Base repository directory
 * @param {boolean} options.write - True to persist changes, false to check only
 * @returns {Promise<{ valid: boolean, errors: string[], updatedFiles: string[] }>}
 */
export async function processGeneratedDocumentation({ rootDir = repositoryRoot, write = false } = {}) {
  const targets = getDocumentationGenerationTargets();
  const filesMap = new Map();
  const errors = [];
  const updatedFiles = [];

  // Group targets by relative file path
  for (const target of targets) {
    if (!filesMap.has(target.file)) {
      filesMap.set(target.file, []);
    }
    filesMap.get(target.file).push(target);
  }

  for (const [relPath, fileTargets] of filesMap.entries()) {
    const fullPath = path.join(rootDir, relPath);
    let originalContent;
    try {
      originalContent = await readFile(fullPath, "utf8");
    } catch (err) {
      errors.push(`DOC_GENERATED_TARGET_MISSING: Cannot read target file "${relPath}": ${err.message}`);
      continue;
    }

    let modifiedContent = originalContent;
    const seenRegions = new Set();

    for (const target of fileTargets) {
      if (seenRegions.has(target.region)) {
        errors.push(`DOC_GENERATED_REGION_DUPLICATE: Target file "${relPath}" has duplicate region ID "${target.region}"`);
        continue;
      }
      seenRegions.add(target.region);

      const beginMarker = `<!-- BEGIN FORGELOOP GENERATED: ${target.region} -->`;
      const endMarker = `<!-- END FORGELOOP GENERATED: ${target.region} -->`;

      const beginIndex = modifiedContent.indexOf(beginMarker);
      if (beginIndex === -1) {
        // Region marker not in file - skip if optional or report if missing
        continue;
      }

      const endIndex = modifiedContent.indexOf(endMarker, beginIndex + beginMarker.length);
      if (endIndex === -1) {
        errors.push(
          `DOC_GENERATED_REGION_INVALID: In "${relPath}", region "${target.region}" has a BEGIN marker without matching END marker`,
        );
        continue;
      }

      const generatedText = await target.generate();
      const newRegionContent = `${beginMarker}\n\n${generatedText.trim()}\n\n${endMarker}`;
      const existingRegionContent = modifiedContent.slice(beginIndex, endIndex + endMarker.length);

      if (existingRegionContent !== newRegionContent) {
        if (!write) {
          errors.push(
            `DOC_GENERATED_REGION_STALE: In "${relPath}", generated region "${target.region}" is stale. Run 'npm run docs:generate' to update.`,
          );
        }
        modifiedContent = modifiedContent.slice(0, beginIndex) + newRegionContent + modifiedContent.slice(endIndex + endMarker.length);
      }
    }

    if (write && modifiedContent !== originalContent) {
      // Normalize line endings to LF
      const normalizedContent = modifiedContent.replace(/\r\n/g, "\n");
      await writeFile(fullPath, normalizedContent, "utf8");
      updatedFiles.push(relPath);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    updatedFiles,
  };
}

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isCheck = process.argv.includes("--check");
  const isWrite = process.argv.includes("--write") || !isCheck;

  try {
    const result = await processGeneratedDocumentation({ write: isWrite });
    if (!result.valid) {
      console.error("\n❌ DOCUMENTATION GENERATION / FRESHNESS FAILURES:");
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }

    if (isWrite) {
      if (result.updatedFiles.length > 0) {
        console.log(`✅ Successfully updated generated documentation regions in: ${result.updatedFiles.join(", ")}`);
      } else {
        console.log("✅ Generated documentation regions are up to date (no files modified).");
      }
    } else {
      console.log("✅ All generated documentation regions are fresh and match canonical definitions.");
    }
  } catch (error) {
    console.error(`Documentation generation crashed: ${error.message}`);
    process.exit(1);
  }
}
