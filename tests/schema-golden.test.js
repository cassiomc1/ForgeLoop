import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SHIPPED_SCHEMA_NAMES, assertSchema, readSchema } from "../src/core/schema-validation.js";

const fixtureRoot = path.resolve(import.meta.dirname, "fixtures", "schemas");

test("every public schema has valid and invalid golden fixtures", async () => {
  for (const schemaName of SHIPPED_SCHEMA_NAMES) {
    const schema = await readSchema(schemaName);
    const valid = JSON.parse(await readFile(path.join(fixtureRoot, schemaName, "valid.json"), "utf8"));
    const invalid = JSON.parse(await readFile(path.join(fixtureRoot, schemaName, "invalid.json"), "utf8"));
    assert.doesNotThrow(() => assertSchema(valid, schema, `${schemaName} valid fixture`));
    assert.throws(() => assertSchema(invalid, schema, `${schemaName} invalid fixture`));
  }
});
