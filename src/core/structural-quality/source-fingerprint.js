import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { canonicalFingerprint } from "../artifacts.js";
import { ensureWithin, readBytes } from "../filesystem.js";
import { sha256 } from "../manifest.js";
import { repositoryHead, repositoryStatusEntries } from "../repository.js";
import { E_STRUCTURAL_QUALITY_SOURCE_FINGERPRINT_UNAVAILABLE } from "../error-codes.js";

// Provider-owned configuration is bound by the provider scope resolver, not
// treated as project source. This keeps custom providers independent of
// Sentrux's optional rules file.
const IGNORED_DIRECTORIES = new Set([".forgeloop", ".git", ".sentrux", "node_modules"]);

function fingerprintError(message, cause = null) {
  const error = new Error(message);
  error.code = E_STRUCTURAL_QUALITY_SOURCE_FINGERPRINT_UNAVAILABLE;
  if (cause) error.cause = cause;
  return error;
}

async function readMaterialFile(root, relativePath) {
  const fullPath = ensureWithin(root, relativePath);
  let info;
  try {
    info = await lstat(fullPath);
  } catch (error) {
    throw fingerprintError(`Unable to inspect structural-quality source material: ${relativePath}`, error);
  }
  if (info.isSymbolicLink()) {
    throw fingerprintError(`Structural-quality source material uses an unsafe symlink: ${relativePath}`);
  }
  if (!info.isFile()) {
    throw fingerprintError(`Structural-quality source material is not a regular file: ${relativePath}`);
  }
  try {
    return sha256(await readBytes(fullPath));
  } catch (error) {
    throw fingerprintError(`Unable to read structural-quality source material: ${relativePath}`, error);
  }
}

async function crawlDirectory(root, current = "") {
  const dirPath = current ? path.join(root, current) : root;
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    throw fingerprintError(`Unable to enumerate structural-quality source material: ${current || "."}`, error);
  }
  const files = [];
  for (const entry of entries) {
    const rel = current ? path.join(current, entry.name).replaceAll("\\", "/") : entry.name;
    if (entry.isSymbolicLink()) {
      throw fingerprintError(`Structural-quality source material uses an unsafe symlink: ${rel}`);
    }
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || rel.startsWith(".forgeloop/")) continue;
      files.push(...(await crawlDirectory(root, rel)));
    } else if (entry.isFile()) {
      if (rel.startsWith(".forgeloop/")) continue;
      files.push({ path: rel, sha256: await readMaterialFile(root, rel) });
    } else {
      throw fingerprintError(`Unsupported structural-quality source material: ${rel}`);
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function computeMaterialSourceFingerprint(target) {
  try {
    const head = await repositoryHead(target);
    const statusEntries = await repositoryStatusEntries(target);
    const filtered = statusEntries
      .filter((entry) => !entry.path.startsWith(".forgeloop/")
        && !entry.path.startsWith(".git/")
        && !entry.path.startsWith(".sentrux/"));
    const enriched = [];
    for (const entry of filtered) {
      let digest = "DELETED";
      let exists = false;
      try {
        await lstat(ensureWithin(target, entry.path));
        exists = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw fingerprintError(`Unable to inspect structural-quality source material: ${entry.path}`, error);
      }
      if (exists) {
        digest = await readMaterialFile(target, entry.path);
      }
      enriched.push({
        path: entry.path,
        sourcePath: entry.sourcePath ?? null,
        status: entry.status,
        digest,
      });
    }
    enriched.sort((left, right) => left.path.localeCompare(right.path));
    return canonicalFingerprint({
      kind: "GIT_WORKTREE",
      head,
      statusEntries: enriched,
    });
  } catch (error) {
    if (error?.code === E_STRUCTURAL_QUALITY_SOURCE_FINGERPRINT_UNAVAILABLE) throw error;
    const files = await crawlDirectory(target);
    return canonicalFingerprint({
      kind: "DIRECTORY",
      files,
    });
  }
}
