#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { PUBLIC_ERROR_CODES } from "../src/core/error-codes.js";
import { readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";

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
      const types = propDef.oneOf.map((t) => t.type ?? (t.const !== undefined ? JSON.stringify(t.const) : "object"));
      modifiers.push(types.join(" or "));
    } else if (propDef.type === "array") {
      modifiers.push("array");
    } else if (propDef.type) {
      modifiers.push(propDef.type);
    }

    modifiers.push(isRequired ? "required" : "optional");

    // Const
    if (propDef.const !== undefined) {
      modifiers.push(`const: ${typeof propDef.const === "string" ? `"${propDef.const}"` : propDef.const}`);
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

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log("ForgeLoop Documentation Reference Generator (Deterministic & Offline)");
  console.log(`Generated ${Object.keys(ARTIFACT_REGISTRY).length} artifact mappings, ${Object.keys(CLI_COMMAND_DEFINITIONS).length} CLI commands, ${Object.keys(PUBLIC_ERROR_CODES).length} public error codes.`);
}
