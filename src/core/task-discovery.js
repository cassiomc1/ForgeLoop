import { readdir } from "node:fs/promises";
import { ensureWithin, fileExists } from "./filesystem.js";
import { getPackageRoot } from "./templates.js";
import { TASK_STATE_ROOT, taskArtifactPath } from "./task-paths.js";
import { readTaskDescriptor } from "./task-descriptor.js";
import { readJsonArtifact } from "./artifacts.js";
import { readLockInfo } from "./task-lock.js";
import { taskStorageKey } from "./task-identity.js";

export async function discoverTasks(target, packageRoot = getPackageRoot()) {
  const rootPath = ensureWithin(target, TASK_STATE_ROOT);
  if (!(await fileExists(rootPath))) {
    return [];
  }

  let entries = [];
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const tasks = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (!/^[a-f0-9]{64}$/.test(entry.name)) continue;

    try {
      const descriptorArtifact = await readTaskDescriptor(target, entry.name, packageRoot);
      const descriptor = descriptorArtifact.value;
      const taskId = descriptor.taskId;

      // P1-1: Verify descriptor taskKey matches the actual directory name
      if (descriptor.taskKey !== entry.name) {
        tasks.push({
          taskId: descriptor.taskId ?? null,
          taskKey: entry.name,
          directory: `${TASK_STATE_ROOT}/${entry.name}`,
          healthy: false,
          error: {
            code: "E_TASK_KEY_MISMATCH",
            message: `Task directory key "${entry.name}" does not match descriptor taskKey "${descriptor.taskKey}"`,
          },
        });
        continue;
      }

      // Check work-state if available
      let state = null;
      let phase = null;
      let lastUpdated = descriptor.updatedAt ?? descriptor.createdAt;
      try {
        const stateArtifact = await readJsonArtifact(
          target,
          taskArtifactPath(taskId, "state"),
          "work-state",
          packageRoot,
        );
        state = stateArtifact.value;
        phase = state.phase ?? null;
        if (state.lastUpdated) {
          lastUpdated = state.lastUpdated;
        }
      } catch {
        // State might not exist yet
      }

      // Check lock status
      const lockInfo = await readLockInfo(target, taskId);

      // Check continuity & receipt presence
      const continuityPath = ensureWithin(target, taskArtifactPath(taskId, "continuity"));
      const hasContinuity = await fileExists(continuityPath);

      const receiptPath = ensureWithin(target, taskArtifactPath(taskId, "receipt"));
      const hasReceipt = await fileExists(receiptPath);

      tasks.push({
        taskId,
        taskKey: descriptor.taskKey,
        healthy: true,
        phase,
        locked: lockInfo !== null,
        lockInfo,
        writeClaims: descriptor.writeClaims ?? [],
        createdAt: descriptor.createdAt,
        updatedAt: descriptor.updatedAt,
        lastUpdated,
        hasContinuity,
        hasReceipt,
        descriptor,
        directory: `${TASK_STATE_ROOT}/${descriptor.taskKey}`,
      });
    } catch (err) {
      // P1-2: Surface corrupt task namespaces instead of silently hiding them
      tasks.push({
        taskId: null,
        taskKey: entry.name,
        directory: `${TASK_STATE_ROOT}/${entry.name}`,
        healthy: false,
        error: {
          code: err.code ?? "E_TASK_DESCRIPTOR_INVALID",
          message: err.message ?? String(err),
        },
      });
    }
  }

  return tasks.sort((a, b) => (a.taskId ?? a.taskKey).localeCompare(b.taskId ?? b.taskKey));
}

export async function findTaskById(target, taskId, packageRoot = getPackageRoot()) {
  const taskKey = taskStorageKey(taskId);
  const tasks = await discoverTasks(target, packageRoot);
  return tasks.find((t) => t.healthy !== false && (t.taskId === taskId || t.taskKey === taskKey)) ?? null;
}
