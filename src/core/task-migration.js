import { cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { ensureWithin, fileExists } from "./filesystem.js";
import { getPackageRoot } from "./templates.js";
import {
  LEGACY_TASK_ARTIFACT_PATHS,
  TASK_STATE_ROOT,
  taskDirectory,
} from "./task-paths.js";
import { assertTaskId, taskStorageKey } from "./task-identity.js";
import { createTaskDescriptor, readTaskDescriptor, writeTaskDescriptor } from "./task-descriptor.js";
import { readJsonArtifact } from "./artifacts.js";
import {
  E_TASK_MIGRATION_IDENTITY_MISMATCH,
  E_TASK_MIGRATION_INVALID,
} from "./error-codes.js";

export async function detectLegacySingletonLayout(target) {
  const legacyFiles = [];
  for (const [key, relPath] of Object.entries(LEGACY_TASK_ARTIFACT_PATHS)) {
    const fullPath = ensureWithin(target, relPath);
    if (await fileExists(fullPath)) {
      legacyFiles.push({ key, path: relPath });
    }
  }
  return {
    hasLegacy: legacyFiles.length > 0,
    legacyFiles,
  };
}

export async function migrateLegacyLayout(
  target,
  { dryRun = false, packageRoot = getPackageRoot() } = {},
) {
  const detection = await detectLegacySingletonLayout(target);
  if (!detection.hasLegacy) {
    return {
      migrated: false,
      reason: "NO_LEGACY_STATE",
      message: "No legacy ForgeLoop 1.0 singleton artifacts found.",
    };
  }

  let canonicalTaskId = null;
  const artifactIdentities = [];

  // Validate all detected legacy artifacts before proceeding
  for (const item of detection.legacyFiles) {
    if (item.key === "contract") {
      try {
        const contract = await readJsonArtifact(target, item.path, "current-contract", packageRoot);
        if (contract.value?.taskId) {
          if (!canonicalTaskId) canonicalTaskId = contract.value.taskId;
          artifactIdentities.push({ artifact: "contract", taskId: contract.value.taskId });
        }
      } catch (err) {
        const error = new Error(`Legacy contract artifact is invalid: ${err.message}`);
        error.code = E_TASK_MIGRATION_INVALID;
        throw error;
      }
    } else if (item.key === "state") {
      try {
        const state = await readJsonArtifact(target, item.path, "work-state", packageRoot);
        if (state.value?.taskId) {
          if (!canonicalTaskId) canonicalTaskId = state.value.taskId;
          artifactIdentities.push({ artifact: "state", taskId: state.value.taskId });
        }
      } catch (err) {
        const error = new Error(`Legacy state artifact is invalid: ${err.message}`);
        error.code = E_TASK_MIGRATION_INVALID;
        throw error;
      }
    } else if (item.key === "continuity") {
      try {
        const continuity = await readJsonArtifact(target, item.path, "continuity", packageRoot);
        if (continuity.value?.taskId) {
          if (!canonicalTaskId) canonicalTaskId = continuity.value.taskId;
          artifactIdentities.push({ artifact: "continuity", taskId: continuity.value.taskId });
        }
      } catch (err) {
        const error = new Error(`Legacy continuity artifact is invalid: ${err.message}`);
        error.code = E_TASK_MIGRATION_INVALID;
        throw error;
      }
    } else if (item.key === "receipt") {
      try {
        const receipt = await readJsonArtifact(target, item.path, "execution-receipt", packageRoot);
        if (receipt.value?.taskId) {
          if (!canonicalTaskId) canonicalTaskId = receipt.value.taskId;
          artifactIdentities.push({ artifact: "receipt", taskId: receipt.value.taskId });
        }
      } catch (err) {
        const error = new Error(`Legacy receipt artifact is invalid: ${err.message}`);
        error.code = E_TASK_MIGRATION_INVALID;
        throw error;
      }
    }
  }

  if (!canonicalTaskId) {
    const error = new Error("Unable to determine task ID from legacy singleton artifacts");
    error.code = E_TASK_MIGRATION_INVALID;
    throw error;
  }

  assertTaskId(canonicalTaskId);

  // Check for identity mismatches across legacy artifacts
  const mismatches = artifactIdentities.filter((a) => a.taskId !== canonicalTaskId);
  if (mismatches.length > 0) {
    const error = new Error(
      `Task identity mismatch during legacy migration: primary task is "${canonicalTaskId}", but ${mismatches.map((m) => `${m.artifact} has "${m.taskId}"`).join(", ")}`,
    );
    error.code = E_TASK_MIGRATION_IDENTITY_MISMATCH;
    error.mismatches = mismatches;
    throw error;
  }

  const taskKey = taskStorageKey(canonicalTaskId);
  const finalDirRel = taskDirectory(canonicalTaskId);
  const finalDirAbs = ensureWithin(target, finalDirRel);
  const tempDirRel = `${TASK_STATE_ROOT}/.tmp-${taskKey}`;
  const tempDirAbs = ensureWithin(target, tempDirRel);

  if (await fileExists(finalDirAbs)) {
    const error = new Error(`Target task directory already exists: ${finalDirRel}`);
    error.code = E_TASK_MIGRATION_INVALID;
    throw error;
  }

  const migratedArtifacts = [];

  if (dryRun) {
    return {
      migrated: false,
      dryRun: true,
      taskId: canonicalTaskId,
      taskKey,
      targetDirectory: finalDirRel,
      legacyFiles: detection.legacyFiles.map((f) => f.path),
    };
  }

  // Create temporary migration directory
  await mkdir(tempDirAbs, { recursive: true });

  try {
    // 1. Create and write task.json descriptor
    const descriptor = createTaskDescriptor({
      taskId: canonicalTaskId,
      writeClaims: [],
    });
    await writeTaskDescriptor(target, descriptor, packageRoot, {
      relativePathOverride: `${tempDirRel}/task.json`,
    });
    migratedArtifacts.push("task.json");

    // 2. Copy and map files
    const fileMapping = [
      [LEGACY_TASK_ARTIFACT_PATHS.contract, "contract.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.route, "routing-result.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.preflight, "preflight.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.state, "work-state.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.continuity, "continuity.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.receipt, "execution-receipt.json"],
      [LEGACY_TASK_ARTIFACT_PATHS.events, "events.ndjson"],
    ];

    for (const [legacyRel, destName] of fileMapping) {
      const srcAbs = ensureWithin(target, legacyRel);
      if (await fileExists(srcAbs)) {
        const destAbs = path.join(tempDirAbs, destName);
        await cp(srcAbs, destAbs);
        migratedArtifacts.push(destName);
      }
    }

    // 3. Copy directories: gates/ and executions/
    const dirMapping = [
      [LEGACY_TASK_ARTIFACT_PATHS.gates, "gates"],
      [LEGACY_TASK_ARTIFACT_PATHS.executions, "executions"],
    ];

    for (const [legacyRel, destDirName] of dirMapping) {
      const srcAbs = ensureWithin(target, legacyRel);
      if (await fileExists(srcAbs)) {
        const destAbs = path.join(tempDirAbs, destDirName);
        await cp(srcAbs, destAbs, { recursive: true });
        migratedArtifacts.push(`${destDirName}/`);
      }
    }

    // 4. Atomically publish
    await mkdir(ensureWithin(target, TASK_STATE_ROOT), { recursive: true });
    await rename(tempDirAbs, finalDirAbs);

    // 5. Post-publish validation: verify final namespace is readable and healthy
    await readTaskDescriptor(target, canonicalTaskId, packageRoot);

    // 6. Cleanup legacy task files (strictly after successful publish and validation)
    for (const item of detection.legacyFiles) {
      const full = ensureWithin(target, item.path);
      try {
        await rm(full, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return {
      migrated: true,
      taskId: canonicalTaskId,
      taskKey,
      targetDirectory: finalDirRel,
      migratedArtifacts,
    };
  } catch (error) {
    // Cleanup temp dir on failure
    try {
      await rm(tempDirAbs, { recursive: true, force: true });
    } catch {
      // ignore
    }
    throw error;
  }
}
