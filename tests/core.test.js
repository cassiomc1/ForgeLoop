import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveTarget, ensureWithin } from "../src/core/filesystem.js";
import {
  createManifest,
  readManifest,
  writeManifest,
} from "../src/core/manifest.js";
import { readTemplateEntries } from "../src/core/templates.js";

test("rejects a target path that escapes the requested root", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-core-"));
  try {
    await assert.rejects(resolveTarget(target, "../outside"), /inside|directory|not found/i);
    assert.throws(() => ensureWithin(target, "../outside"), /outside|escape/i);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("round-trips a versioned manifest", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-core-"));
  try {
    const manifest = createManifest("0.1.0");
    manifest.files["AGENTS.md"] = { sha256: "a".repeat(64), preserve: false };
    await writeManifest(target, manifest);
    assert.deepEqual(await readManifest(target), manifest);
    assert.match(await readFile(path.join(target, ".mdfiles", "manifest.json"), "utf8"), /schemaVersion/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("template entries use safe relative paths", async () => {
  const entries = await readTemplateEntries();
  assert.ok(entries.length >= 12);
  for (const entry of entries) {
    assert.equal(path.isAbsolute(entry.relativePath), false);
    assert.equal(entry.relativePath.startsWith(".."), false);
    assert.ok(entry.bytes.length > 0);
  }
});
