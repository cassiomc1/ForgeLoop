import { rmdir, unlink } from "node:fs/promises";

import { assertSafePath, fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
import {
  createManifest,
  PACKAGE_NAME,
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";
import { isNativeAdapterPath, LAYOUT_VERSION } from "../core/target-layout.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";
const LEGACY_CLEANUP_DIRECTORIES = Object.freeze(["ENG", "schemas"]);

function migrationConflict(code, path, message) {
  return { code, path, message };
}

function addAction(actions, dryRun, action, path, details = {}) {
  actions.push({ action: dryRun ? `would-${action}` : action, path, ...details });
}

async function verifyWrite(filePath, expectedBytes) {
  const actualBytes = await readBytes(filePath);
  if (!actualBytes.equals(expectedBytes)) {
    const error = new Error(`Migration write verification failed for ${filePath}`);
    error.code = "E_MIGRATION_WRITE_VERIFY";
    throw error;
  }
}

async function removeEmptyLegacyDirectory(target, relativePath, dryRun) {
  await assertSafePath(target, relativePath);
  if (dryRun) return;
  try {
    await rmdir(ensureWithin(target, relativePath));
  } catch (error) {
    if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) throw error;
  }
}

function addLegacyCleanup(cleanupFiles, cleanupDirectories, relativePath) {
  cleanupFiles.add(relativePath);
  for (const directory of LEGACY_CLEANUP_DIRECTORIES) {
    if (relativePath === directory || relativePath.startsWith(`${directory}/`)) {
      cleanupDirectories.add(directory);
    }
  }
}

async function migrateLegacyLayout({ target, dryRun, packageVersion, currentManifest, entries }) {
  const nextManifest = createManifest(packageVersion);
  const actions = [];
  const conflicts = [];
  const writes = [];
  const cleanupFiles = new Set();
  const cleanupDirectories = new Set();

  // Validate every path before creating the migration plan or touching data.
  for (const entry of entries) {
    await assertSafePath(target, entry.relativePath);
    if (entry.legacyRelativePath !== entry.relativePath) {
      await assertSafePath(target, entry.legacyRelativePath);
    }
  }

  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    const legacyDestination = ensureWithin(target, entry.legacyRelativePath);
    const sourceHash = sha256(entry.bytes);
    const destinationExists = await fileExists(destination);
    const legacyExists = entry.legacyRelativePath !== entry.relativePath
      && await fileExists(legacyDestination);
    const legacyRecord = currentManifest.files[entry.legacyRelativePath];
    const destinationRecord = currentManifest.files[entry.relativePath];

    if (isNativeAdapterPath(entry.relativePath)) {
      if (!destinationExists) {
        addAction(actions, dryRun, "create", entry.relativePath);
        writes.push({ destination, bytes: entry.bytes });
        nextManifest.files[entry.relativePath] = { sha256: sourceHash, preserve: false };
        continue;
      }

      const currentBytes = await readBytes(destination);
      const currentHash = sha256(currentBytes);
      if (legacyRecord && currentHash === legacyRecord.sha256) {
        if (currentHash === sourceHash) {
          actions.push({ action: "skip", path: entry.relativePath, reason: "current-shim" });
        } else {
          addAction(actions, dryRun, "update-adapter", entry.relativePath);
          writes.push({ destination, bytes: entry.bytes });
        }
        nextManifest.files[entry.relativePath] = { sha256: sourceHash, preserve: false };
        continue;
      }

      conflicts.push(migrationConflict(
        "E_NATIVE_ADAPTER_MIGRATION_CONFLICT",
        entry.relativePath,
        legacyRecord
          ? "Managed native adapter was modified; it was preserved and was not silently overwritten."
          : "Native adapter is not owned by the legacy manifest; it was preserved and was not silently adopted.",
      ));
      addAction(actions, dryRun, "preserve-conflict", entry.relativePath, {
        reason: legacyRecord ? "managed-modified" : "unmanaged",
      });
      if (legacyRecord) nextManifest.files[entry.relativePath] = { ...legacyRecord };
      continue;
    }

    if (destinationExists) {
      const currentBytes = await readBytes(destination);
      const currentHash = sha256(currentBytes);
      if (!destinationRecord && currentHash !== sourceHash && entry.sourcePath !== PROFILE_PATH) {
        conflicts.push(migrationConflict(
          "E_HIDDEN_KIT_MIGRATION_CONFLICT",
          entry.relativePath,
          "Existing hidden kit file is unmanaged and was not overwritten.",
        ));
        addAction(actions, dryRun, "preserve-conflict", entry.relativePath, { reason: "hidden-unmanaged" });
      } else {
        actions.push({ action: "skip", path: entry.relativePath, reason: "already-present" });
      }
      nextManifest.files[entry.relativePath] = {
        sha256: currentHash,
        preserve: entry.sourcePath === PROFILE_PATH
          || !destinationRecord
          || Boolean(destinationRecord.preserve),
      };
      continue;
    }

    if (!legacyExists) {
      addAction(actions, dryRun, "create", entry.relativePath);
      writes.push({ destination, bytes: entry.bytes });
      nextManifest.files[entry.relativePath] = {
        sha256: sourceHash,
        preserve: entry.sourcePath === PROFILE_PATH,
      };
      continue;
    }

    const legacyBytes = await readBytes(legacyDestination);
    const legacyHash = sha256(legacyBytes);
    const unchangedManaged = Boolean(legacyRecord) && legacyHash === legacyRecord.sha256;

    if (entry.sourcePath === PROFILE_PATH && legacyRecord) {
      addAction(actions, dryRun, "move-profile", entry.legacyRelativePath, { to: entry.relativePath });
      writes.push({ destination, bytes: legacyBytes });
      if (!dryRun) addLegacyCleanup(cleanupFiles, cleanupDirectories, entry.legacyRelativePath);
      nextManifest.files[entry.relativePath] = { sha256: legacyHash, preserve: true };
      continue;
    }

    if (legacyRecord?.preserve && unchangedManaged) {
      addAction(actions, dryRun, "move-preserved", entry.legacyRelativePath, { to: entry.relativePath });
      writes.push({ destination, bytes: legacyBytes });
      if (!dryRun) addLegacyCleanup(cleanupFiles, cleanupDirectories, entry.legacyRelativePath);
      nextManifest.files[entry.relativePath] = { sha256: legacyHash, preserve: true };
      continue;
    }

    if (unchangedManaged) {
      addAction(actions, dryRun, "migrate", entry.legacyRelativePath, { to: entry.relativePath });
      writes.push({ destination, bytes: entry.bytes });
      if (!dryRun) addLegacyCleanup(cleanupFiles, cleanupDirectories, entry.legacyRelativePath);
      nextManifest.files[entry.relativePath] = { sha256: sourceHash, preserve: false };
      continue;
    }

    const conflict = entry.sourcePath === PROFILE_PATH
      ? migrationConflict(
        "E_PROFILE_MIGRATION_CONFLICT",
        entry.legacyRelativePath,
        "Project profile is not owned by the legacy manifest; it was preserved and was not overwritten or deleted.",
      )
      : migrationConflict(
        "E_LEGACY_FILE_MIGRATION_CONFLICT",
        entry.legacyRelativePath,
        legacyRecord
          ? "Managed legacy file was modified; it was preserved while the hidden canonical file was installed."
          : "Unmanaged legacy file was preserved while the hidden canonical file was installed.",
      );
    conflicts.push(conflict);
    addAction(actions, dryRun, "preserve-conflict", entry.legacyRelativePath, {
      to: entry.relativePath,
      reason: legacyRecord ? "managed-modified" : "unmanaged",
    });
    writes.push({ destination, bytes: entry.bytes });
    nextManifest.files[entry.relativePath] = {
      sha256: sourceHash,
      preserve: entry.sourcePath === PROFILE_PATH,
    };
  }

  // Apply all hidden writes and verify their bytes before removing any legacy file.
  for (const plan of writes) {
    await writeFileAtomic(plan.destination, plan.bytes, { dryRun });
    if (!dryRun) await verifyWrite(plan.destination, plan.bytes);
  }

  for (const relativePath of cleanupFiles) {
    await assertSafePath(target, relativePath);
    const legacyPath = ensureWithin(target, relativePath);
    if (!dryRun && await fileExists(legacyPath)) await unlink(legacyPath);
  }

  for (const relativePath of cleanupDirectories) {
    await removeEmptyLegacyDirectory(target, relativePath, dryRun);
  }

  // The manifest is written last so layoutVersion 2 is never authoritative before
  // hidden destinations and adapter decisions have been applied.
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
    return migrateLegacyLayout({ target, dryRun, packageVersion, currentManifest, entries });
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
