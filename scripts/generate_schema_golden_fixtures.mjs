#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SHIPPED_SCHEMA_NAMES, assertSchema, readSchema } from "../src/core/schema-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "tests", "fixtures", "schemas");

function resolveRef(rootSchema, ref) {
  return ref.slice(2).split("/").reduce((node, part) => node?.[part], rootSchema);
}

function sampleString(schema) {
  if (schema.pattern === "^[a-f0-9]{64}$") return "a".repeat(64);
  if (schema.pattern === "^[A-Za-z0-9_-]+$") return "fixture_id";
  const minimum = schema.minLength ?? 1;
  return "fixture".padEnd(minimum, "x");
}

function sample(schema, rootSchema, seen = new Set()) {
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return "fixture";
    return sample(resolveRef(rootSchema, schema.$ref), rootSchema, new Set([...seen, schema.$ref]));
  }
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.oneOf) return sample(schema.oneOf[0], rootSchema, seen);
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries((schema.required ?? []).map((key) => [key, sample(schema.properties?.[key] ?? {}, rootSchema, seen)]));
  }
  if (schema.type === "array") {
    const count = schema.minItems ?? 0;
    return Array.from({ length: count }, () => sample(schema.items ?? {}, rootSchema, seen));
  }
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") return schema.minimum ?? 0;
  if (schema.type === "null") return null;
  return sampleString(schema);
}

for (const name of SHIPPED_SCHEMA_NAMES) {
  const schema = await readSchema(name);
  const valid = sample(schema, schema);
  assertSchema(valid, schema, `${name} generated valid fixture`);
  const directory = path.join(fixtureRoot, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "valid.json"), `${JSON.stringify(valid, null, 2)}\n`);
  await writeFile(path.join(directory, "invalid.json"), "{}\n");
}
