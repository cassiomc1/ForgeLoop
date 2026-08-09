import { fileExists, ensureWithin, writeFileAtomic } from "../core/filesystem.js";
import {
  createManifest,
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";

export async function runInit({ target, dryRun, packageRoot, packageVersion }) {
  const entries = await readTemplateEntries(packageRoot);
  const manifest = (await readManifest(target)) ?? createManifest(packageVersion);
  manifest.packageVersion = packageVersion;
  const actions = [];

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    if (await fileExists(destination)) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "exists" });
      continue;
    }

    actions.push({
      action: dryRun ? "would-create" : "created",
      path: entry.relativePath,
    });
    await writeFileAtomic(destination, entry.bytes, { dryRun });
    manifest.files[entry.relativePath] = {
      sha256: sha256(entry.bytes),
      preserve: entry.relativePath === PROFILE_PATH,
    };
  }

  await writeManifest(target, manifest, { dryRun });
  return { actions, manifest };
}
