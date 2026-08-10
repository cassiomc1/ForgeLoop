import { assertSafePath, fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
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
  const actions = [];
  const conflicts = [];
  const plans = [];
  const pruneActions = [];
  const shippedPaths = new Set(entries.map((entry) => entry.relativePath));

  for (const relativePath of Object.keys(nextManifest.files)) {
    if (!shippedPaths.has(relativePath)) {
      pruneActions.push({
        action: dryRun ? "would-prune" : "pruned",
        path: relativePath,
        reason: "template-removed",
      });
    }
  }

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    await assertSafePath(target, entry.relativePath);
    const sourceHash = sha256(entry.bytes);
    const record = currentManifest.files[entry.relativePath];
    const exists = await fileExists(destination);

    if (!exists) {
      plans.push({
        action: dryRun ? "would-create" : "created",
        destination,
        entry,
        record: {
          sha256: sourceHash,
          preserve: entry.relativePath === PROFILE_PATH,
        },
      });
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
      continue;
    }

    plans.push({
      action: dryRun ? "would-update" : "updated",
      destination,
      entry,
      record: { ...record, sha256: sourceHash },
    });
  }

  if (conflicts.length > 0) {
    return { actions, conflicts, manifest: currentManifest };
  }

  for (const relativePath of Object.keys(nextManifest.files)) {
    if (!shippedPaths.has(relativePath)) delete nextManifest.files[relativePath];
  }
  actions.push(...pruneActions);

  for (const plan of plans) {
    actions.push({ action: plan.action, path: plan.entry.relativePath });
    await writeFileAtomic(plan.destination, plan.entry.bytes, { dryRun });
    nextManifest.files[plan.entry.relativePath] = plan.record;
  }

  nextManifest.packageVersion = packageVersion;
  await writeManifest(target, nextManifest, { dryRun });
  return { actions, conflicts, manifest: nextManifest };
}
