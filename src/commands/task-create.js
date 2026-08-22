import { readFile } from "node:fs/promises";
import { assertTaskId } from "../core/task-identity.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../core/task-descriptor.js";
import { normalizeWriteClaims, assertNoScopeConflicts, assertScopeClean } from "../core/task-scope.js";
import { inspectTaskConflictState } from "../core/task-conflict-inspection.js";
import { discoverTasks, findTaskById } from "../core/task-discovery.js";
import { withProjectClaimsLock } from "../core/task-lock.js";
import { withTaskTransaction } from "../core/transaction.js";
import { taskDirectory } from "../core/task-paths.js";
import { ensureWithin, fileExists } from "../core/filesystem.js";
import { validateContract, writeContract } from "../core/contract.js";
import { appendProtocolEvent } from "../core/events.js";
import { E_TASK_REQUIRED, E_TASK_ALREADY_EXISTS, E_TASK_DESCRIPTOR_INVALID } from "../core/error-codes.js";
import { recoveryGuidanceForClassification } from "../core/next-action-model.js";

function taskError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export async function assertNoScopeConflictsWithInspection(claims, existingTasks, currentTaskId, { target, packageRoot } = {}) {
  try {
    assertNoScopeConflicts(claims, existingTasks, currentTaskId);
  } catch (error) {
    if (error.code !== "E_TASK_SCOPE_CONFLICT") throw error;
    const inspected = [];
    for (const conflict of error.conflicts ?? []) {
      let inspection = null;
      try {
        inspection = await inspectTaskConflictState(target, { taskId: conflict.taskId, packageRoot });
      } catch (inspectionError) {
        inspection = {
          taskId: conflict.taskId,
          classification: "INCONSISTENT",
          reasonCodes: [inspectionError.code ?? "E_TASK_NOT_FOUND"],
          recoverable: false,
        };
      }
      const guidance = recoveryGuidanceForClassification(inspection.classification, conflict.taskId);
      inspected.push({
        ...conflict,
        classification: inspection.classification,
        reasonCodes: inspection.reasonCodes,
        nextAction: guidance.nextAction,
        commandSpecs: guidance.commandSpecs,
        inspection,
      });
    }
    error.conflicts = inspected;
    error.message = `${error.message}; conflicting task classifications: ${inspected
      .map((item) => `${item.taskId}=${item.inspection.classification}`)
      .join(", ")}`;
    throw error;
  }
}

export async function runTaskCreate({ target, packageRoot, taskId, claims = [], contractFile = null } = {}) {
  if (!taskId) {
    throw taskError(E_TASK_REQUIRED, "--task is required for task-create");
  }
  assertTaskId(taskId);

  const existing = await findTaskById(target, taskId, packageRoot);
  if (existing) {
    throw taskError(E_TASK_ALREADY_EXISTS, `Task already exists: ${taskId}`);
  }

  const normalizedClaims = normalizeWriteClaims(claims ?? []);

  return withProjectClaimsLock(target, async () => {
    const allTasks = await discoverTasks(target, packageRoot);
    await assertNoScopeConflictsWithInspection(normalizedClaims, allTasks, taskId, { target, packageRoot });
    if (normalizedClaims.length > 0) {
      await assertScopeClean(target, normalizedClaims);
    }

    return withTaskTransaction({ target, taskId, operation: "task-create", packageRoot, recordCommitEvent: true }, async () => {
      const descriptor = createTaskDescriptor({
        taskId,
        writeClaims: normalizedClaims,
      });
      const written = await writeTaskDescriptor(target, descriptor, packageRoot);

      let contractCopied = false;
      if (contractFile) {
        const sourcePath = ensureWithin(target, contractFile);
        if (!(await fileExists(sourcePath))) {
          throw taskError("E_CONTRACT_MISSING", `Specified contract file not found: ${contractFile}`);
        }
        const raw = await readFile(sourcePath, "utf8");
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw taskError("E_CONTRACT_INVALID", `Specified contract file is not valid JSON: ${contractFile}`);
        }
        await validateContract(parsed, packageRoot);
        if (parsed.taskId && parsed.taskId !== taskId) {
          throw taskError(
            E_TASK_DESCRIPTOR_INVALID,
            `Contract taskId "${parsed.taskId}" does not match requested taskId "${taskId}"`,
          );
        }
        parsed.taskId = taskId;
        await writeContract(target, parsed, packageRoot, { taskId });
        contractCopied = true;
      }

      await appendProtocolEvent(target, {
        taskId,
        event: "TASK_RECEIVED",
        details: { createdAt: descriptor.createdAt },
      }, packageRoot, { taskId });

      return {
        taskId: descriptor.taskId,
        taskKey: descriptor.taskKey,
        directory: taskDirectory(taskId),
        descriptorPath: written.path,
        writeClaims: descriptor.writeClaims,
        contractCopied,
        createdAt: descriptor.createdAt,
      };
    });
  });
}

export function formatTaskCreateResult(result) {
  const claims = result.writeClaims.length === 0 ? "none" : result.writeClaims.join(", ");
  return `created task: ${result.taskId}\nkey: ${result.taskKey}\ndirectory: ${result.directory}\nclaims: ${claims}\n`;
}
