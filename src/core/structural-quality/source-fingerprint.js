import { readdir } from "node:fs/promises";
import path from "node:path";

import { canonicalFingerprint } from "../artifacts.js";
import { ensureWithin, fileExists, readBytes } from "../filesystem.js";
import { sha256 } from "../manifest.js";
import { repositoryHead, repositoryStatusEntries } from "../repository.js";

const IGNORED_DIRECTORIES = new Set([".forgeloop", ".git", "node_modules"]);

async function crawlDirectory(root, current = "") {
  const dirPath = current ? path.join(root, current) : root;
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const rel = current ? path.join(current, entry.name).replaceAll("\\", "/") : entry.name;
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || rel.startsWith(".forgeloop/")) continue;
      files.push(...(await crawlDirectory(root, rel)));
    } else if (entry.isFile()) {
      if (rel.startsWith(".forgeloop/")) continue;
      try {
        const bytes = await readBytes(path.join(root, rel));
        files.push({ path: rel, sha256: sha256(bytes) });
      } catch {
        // Unreadable file omitted or skipped
      }
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function computeMaterialSourceFingerprint(target) {
  try {
    const head = await repositoryHead(target);
    const statusEntries = await repositoryStatusEntries(target);
    const filtered = statusEntries
      .filter((entry) => !entry.path.startsWith(".forgeloop/") && !entry.path.startsWith(".git/"));
    const enriched = [];
    for (const entry of filtered) {
      const fullPath = ensureWithin(target, entry.path);
      let digest = "DELETED";
      if (await fileExists(fullPath)) {
        try {
          const bytes = await readBytes(fullPath);
          digest = sha256(bytes);
        } catch {
          digest = "UNREADABLE";
        }
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
  } catch {
    const files = await crawlDirectory(target);
    return canonicalFingerprint({
      kind: "DIRECTORY",
      files,
    });
  }
}
