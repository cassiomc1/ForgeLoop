import { fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
import {
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";

export async function runUpdate({ target, dryRun, packageRoot, packageVersion }) {
  const currentManifest = await readManifest(target);
  if (!currentManifest) {
    throw new Error("No .mdfiles/manifest.json found; run mdfiles init first.");
  }

  const entries = await readTemplateEntries(packageRoot);
  const nextManifest = structuredClone(currentManifest);
  nextManifest.packageVersion = packageVersion;
  const actions = [];
  const conflicts = [];

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    const sourceHash = sha256(entry.bytes);
    const record = currentManifest.files[entry.relativePath];
    const exists = await fileExists(destination);

    if (!exists) {
      actions.push({ action: dryRun ? "would-create" : "created", path: entry.relativePath });
      await writeFileAtomic(destination, entry.bytes, { dryRun });
      nextManifest.files[entry.relativePath] = {
        sha256: sourceHash,
        preserve: entry.relativePath === PROFILE_PATH,
      };
      continue;
    }

    if (!record) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "unmanaged" });
      continue;
    }

    if (record.preserve || entry.relativePath === PROFILE_PATH) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "preserved" });
      continue;
    }

    const currentBytes = await readBytes(destination);
    const currentHash = sha256(currentBytes);
    if (currentHash !== record.sha256) {
      conflicts.push({
        path: entry.relativePath,
        message: "Local changes detected; file was not overwritten.",
      });
      actions.push({ action: "conflict", path: entry.relativePath });
      continue;
    }

    if (currentHash === sourceHash) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "current" });
      nextManifest.files[entry.relativePath] = { ...record, sha256: sourceHash };
      continue;
    }

    actions.push({ action: dryRun ? "would-update" : "updated", path: entry.relativePath });
    await writeFileAtomic(destination, entry.bytes, { dryRun });
    nextManifest.files[entry.relativePath] = { ...record, sha256: sourceHash };
  }

  await writeManifest(target, nextManifest, { dryRun });
  return { actions, conflicts, manifest: nextManifest };
}
