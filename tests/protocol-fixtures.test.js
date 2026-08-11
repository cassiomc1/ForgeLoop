import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { validateTaskArtifactSet } from "../src/core/conformance.js";

const fixtureRoot = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "protocol"));

async function readFixture(folder, name) {
  return JSON.parse(await readFile(path.join(fixtureRoot, folder, name), "utf8"));
}

test("v1 protocol fixtures retain current compatibility markers", async () => {
  for (const name of ["routing-result.json", "work-state.json", "execution-receipt.json"]) {
    const artifact = await readFixture("v1", name);
    assert.equal(artifact.schemaVersion, 1, name);
    assert.equal(artifact.protocolVersion, 1, name);
  }
});

test("invalid protocol fixtures never pass conformance silently", async () => {
  const future = await readFixture("invalid", "future-version.json");
  const old = await readFixture("invalid", "old-version.json");
  const missing = await readFixture("invalid", "missing-version.json");
  const mixed = await readFixture("invalid", "mixed-version.json");

  assert.equal(validateTaskArtifactSet({ route: future }).status, "INVALID");
  assert.equal(validateTaskArtifactSet({ route: old }).status, "INVALID");
  assert.equal(validateTaskArtifactSet({ route: missing }).status, "INVALID");
  assert.equal(validateTaskArtifactSet({ route: { schemaVersion: 1, protocolVersion: 1 }, state: mixed }).status, "INVALID");
});

test("malformed fixture files remain parseable evidence for negative tests", async () => {
  await assert.rejects(
    () => readFile(path.join(fixtureRoot, "invalid", "truncated.json")).then((raw) => JSON.parse(raw)),
    SyntaxError,
  );
  for (const name of ["unknown-fields.json", "missing-arrays.json", "wrong-enum.json", "path-traversal.json", "windows-drive.json", "oversized-value.json", "symlink-target.json"]) {
    await assert.doesNotReject(() => readFixture("invalid", name), name);
  }
});
