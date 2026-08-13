import { unlink } from "node:fs/promises";

import { assertSafePath, fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
import {
  createManifest,
  PACKAGE_NAME,
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";
import { LAYOUT_VERSION } from "../core/target-layout.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";

async function migrateLegacyLayout({ target, dryRun, packageRoot, packageVersion, currentManifest, entries }) {
  const nextManifest = createManifest(packageVersion);
  const actions = [];
  const conflicts = [];

  for (const entry of entries) {
    await assertSafePath(target, entry.relativePath);
    if (entry.legacyRelativePath !== entry.relativePath) await assertSafePath(target, entry.legacyRelativePath);
  }

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    const legacyDestination = ensureWithin(target, entry.legacyRelativePath);
    const sourceHash = sha256(entry.bytes);
    const destinationExists = await fileExists(destination);
    const legacyExists = entry.legacyRelativePath !== entry.relativePath && await fileExists(legacyDestination);
    const legacyRecord = currentManifest.files[entry.legacyRelativePath];
    const destinationRecord = currentManifest.files[entry.relativePath];

    if (destinationExists) {
      const actualBytes = await readBytes(destination);
      const actualHash = sha256(actualBytes);
      if (!destinationRecord && actualHash !== sourceHash && entry.sourcePath !== PROFILE_PATH) {
        conflicts.push({
          path: entry.relativePath,
          message: "Existing hidden kit file is unmanaged and was not overwritten.",
        });
        actions.push({ action: "conflict", path: entry.relativePath });
      } else {
        actions.push({ action: "skip", path: entry.relativePath, reason: "already-present" });
      }
      nextManifest.files[entry.relativePath] = {
        sha256: entry.sourcePath === PROFILE_PATH ? actualHash : (actualHash === sourceHash ? sourceHash : actualHash),
        preserve: entry.sourcePath === PROFILE_PATH
          || !destinationRecord
          || Boolean(destinationRecord.preserve),
      };
      continue;
    }

    if (!legacyExists) {
      actions.push({ action: dryRun ? "would-create" : "created", path: entry.relativePath });
      await writeFileAtomic(destination, entry.bytes, { dryRun });
      nextManifest.files[entry.relativePath] = {
        sha256: sourceHash,
        preserve: entry.sourcePath === PROFILE_PATH,
      };
      continue;
    }

    const legacyBytes = await readBytes(legacyDestination);
    const legacyHash = sha256(legacyBytes);
    const unchangedManaged = Boolean(legacyRecord)
      && !legacyRecord.preserve
      && legacyHash === legacyRecord.sha256;
    const preserved = Boolean(legacyRecord?.preserve) || entry.sourcePath === PROFILE_PATH;
    if (preserved) {
      actions.push({ action: dryRun ? "would-preserve-legacy" : "preserved-legacy", path: entry.legacyRelativePath });
      await writeFileAtomic(destination, legacyBytes, { dryRun });
      nextManifest.files[entry.relativePath] = { sha256: legacyHash, preserve: true };
      continue;
    }

    if (!legacyRecord || !unchangedManaged) {
      conflicts.push({
        path: entry.legacyRelativePath,
        message: legacyRecord
          ? "Local changes detected in the legacy root file; it was preserved while the canonical hidden file was installed."
          : "Unmanaged legacy root file was preserved while the canonical hidden file was installed.",
      });
      actions.push({ action: "conflict", path: entry.legacyRelativePath });
      await writeFileAtomic(destination, entry.bytes, { dryRun });
      nextManifest.files[entry.relativePath] = { sha256: sourceHash, preserve: false };
      continue;
    }

    actions.push({ action: dryRun ? "would-migrate" : "migrated", path: entry.legacyRelativePath, to: entry.relativePath });
    await writeFileAtomic(destination, entry.bytes, { dryRun });
    if (!dryRun) await unlink(legacyDestination);
    nextManifest.files[entry.relativePath] = { sha256: sourceHash, preserve: false };
  }

  await writeManifest(target, nextManifest, { dryRun });
  return { actions, conflicts, manifest: nextManifest };
}

export async function runUpdate({ target, dryRun, packageRoot, packageVersion }) {
  const currentManifest = await readManifest(target);
  if (!currentManifest) {
    throw new Error("No .forgeloop/manifest.json found; run forgeloop init first.");
  }

  const entries = await readTemplateEntries(packageRoot);
  if ((currentManifest.layoutVersion ?? 1) < LAYOUT_VERSION) {
    return migrateLegacyLayout({ target, dryRun, packageRoot, packageVersion, currentManifest, entries });
  }
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
          preserve: entry.sourcePath === PROFILE_PATH,
        },
      });
      continue;
    }

    if (!record) {
      actions.push({ action: "skip", path: entry.relativePath, reason: "unmanaged" });
      continue;
    }

    if (record.preserve || entry.sourcePath === PROFILE_PATH) {
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

  nextManifest.packageName = PACKAGE_NAME;
  nextManifest.packageVersion = packageVersion;
  await writeManifest(target, nextManifest, { dryRun });
  return { actions, conflicts, manifest: nextManifest };
}
