import { assertSafePath, fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
import {
  createManifest,
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";

export async function runInit({ target, dryRun, packageRoot, packageVersion }) {
  const entries = await readTemplateEntries(packageRoot);
  const existingManifest = await readManifest(target);
  if (existingManifest) {
    throw new Error("Target is already initialized; run forgeloop update instead.");
  }
  const manifest = createManifest(packageVersion);
  const actions = [];

  // Validate every destination before any write so a symlinked kit cannot
  // leave a partially initialized target behind.
  for (const entry of entries) await assertSafePath(target, entry.relativePath);

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    if (await fileExists(destination)) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "exists" });
      if (entry.sourcePath === "PROJECT_PROFILE.md") {
        manifest.files[entry.relativePath] = {
          sha256: sha256(await readBytes(destination)),
          preserve: true,
        };
      }
      continue;
    }

    actions.push({
      action: dryRun ? "would-create" : "created",
      path: entry.relativePath,
    });
    await writeFileAtomic(destination, entry.bytes, { dryRun });
    manifest.files[entry.relativePath] = {
      sha256: sha256(entry.bytes),
      preserve: entry.sourcePath === "PROJECT_PROFILE.md",
    };
  }

  await writeManifest(target, manifest, { dryRun });
  return { actions, manifest };
}
