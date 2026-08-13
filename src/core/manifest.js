import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { assertSafePath, ensureWithin, fileExists, writeFileAtomic } from "./filesystem.js";
import { assertJsonBytes, assertJsonLimits } from "./json-safety.js";
import { LAYOUT_VERSION, LEGACY_LAYOUT_VERSION } from "./target-layout.js";

export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_PATH = ".forgeloop/manifest.json";
export const PACKAGE_NAME = "@cassiomc1/forgeloop";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createManifest(packageVersion) {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    layoutVersion: LAYOUT_VERSION,
    packageName: PACKAGE_NAME,
    packageVersion,
    files: {},
  };
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Manifest must contain a JSON object");
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported manifest schema: ${manifest.schemaVersion}`);
  }
  if (manifest.layoutVersion !== undefined
    && ![LEGACY_LAYOUT_VERSION, LAYOUT_VERSION].includes(manifest.layoutVersion)) {
    throw new Error(`Unsupported manifest layout: ${manifest.layoutVersion}`);
  }
  if (typeof manifest.packageVersion !== "string" || !manifest.packageVersion) {
    throw new Error("Manifest packageVersion is required");
  }
  if (!manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    throw new Error("Manifest files must be an object");
  }

  for (const [relativePath, record] of Object.entries(manifest.files)) {
    ensureWithin("/manifest-root", relativePath);
    if (!record || typeof record.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`Invalid manifest hash for ${relativePath}`);
    }
    if (typeof record.preserve !== "boolean") {
      throw new Error(`Invalid manifest preserve flag for ${relativePath}`);
    }
  }
  return manifest;
}

export async function readManifest(target) {
  await assertSafePath(target, MANIFEST_PATH);
  const manifestPath = ensureWithin(target, MANIFEST_PATH);
  if (!(await fileExists(manifestPath))) return null;
  let raw;
  try {
    const bytes = await readFile(manifestPath);
    assertJsonBytes(bytes, MANIFEST_PATH);
    raw = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(raw, MANIFEST_PATH);
  } catch (error) {
    throw new Error(`Unable to parse ${MANIFEST_PATH}: ${error.message}`);
  }
  return validateManifest(raw);
}

export async function writeManifest(target, manifest, { dryRun = false } = {}) {
  validateManifest(manifest);
  await assertSafePath(target, MANIFEST_PATH);
  const manifestPath = ensureWithin(target, MANIFEST_PATH);
  await writeFileAtomic(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { dryRun },
  );
}
