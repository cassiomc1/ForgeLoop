import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getActiveTaskTransaction, withTaskTransaction } from "./transaction.js";
import { appendProtocolEvent } from "./events.js";
import {
  assertApprovalIdFormat,
  assertApprovalEventDetails,
  validateApprovalArtifact,
} from "./action-model.js";
import {
  E_ACTION_AUTHORITY_REQUIRED,
  E_ACTION_NOT_FOUND,
  E_APPROVAL_ALREADY_RESOLVED,
  E_APPROVAL_INVALID,
  E_APPROVAL_STALE,
} from "./error-codes.js";
import { assertSafePath, ensureWithin } from "./filesystem.js";
import { isTrustedHostAuthorityContext } from "./capability-policy.js";
import { taskApprovalPath, taskDirectory, TASK_ARTIFACT_FILES } from "./task-paths.js";
import { readAction } from "./actions.js";
import { readWorkState } from "./work-state.js";

function approvalError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readApprovalFile(target, taskId, approvalId) {
  const relPath = taskApprovalPath(taskId, approvalId);
  await assertSafePath(target, relPath);
  let text;
  try {
    text = await readFile(ensureWithin(target, relPath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw approvalError(E_APPROVAL_INVALID, `approval artifact is not valid JSON: ${relPath}`);
  }
}

async function writeApprovalFile(target, taskId, approval) {
  const relPath = taskApprovalPath(taskId, approval.approvalId);
  await assertSafePath(target, relPath);
  const serialized = `${JSON.stringify(approval, null, 2)}\n`;
  const activeTransaction = getActiveTaskTransaction();
  if (activeTransaction) {
    await activeTransaction.stageText(relPath, serialized);
  } else {
    const absolute = ensureWithin(target, relPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, serialized, "utf8");
  }
}

async function listApprovalFiles(target, taskId) {
  const relDir = `${taskDirectory(taskId)}/${TASK_ARTIFACT_FILES.approvals}`;
  await assertSafePath(target, relDir);
  const absoluteDir = ensureWithin(target, relDir);
  let entries;
  try {
    entries = await readdir(absoluteDir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const approvals = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const parsed = await readApprovalFile(target, taskId, entry.replace(/\.json$/, ""));
    if (parsed) approvals.push(parsed);
  }
  approvals.sort((left, right) => String(left.requestedAt).localeCompare(String(right.requestedAt)));
  return approvals;
}

function approvalBindingFields(approval) {
  return {
    taskId: approval.taskId,
    actionId: approval.actionId,
    actionFingerprint: approval.actionFingerprint,
    contractFingerprint: approval.contractFingerprint,
    taskRevision: approval.taskRevision,
    capability: approval.capability,
  };
}

export function assertApprovalFresh(approval, expectedBinding) {
  if (!expectedBinding || typeof expectedBinding !== "object") {
    throw approvalError(E_APPROVAL_INVALID, "expected binding must be an object");
  }
  for (const [key, value] of Object.entries(approvalBindingFields(approval))) {
    if (expectedBinding[key] !== value) {
      throw approvalError(
        E_APPROVAL_STALE,
        `approval ${approval.approvalId} is stale: bound ${key} does not match the current task/action state`,
      );
    }
  }
  if (approval.status !== "APPROVED") {
    throw approvalError(E_APPROVAL_INVALID, `approval ${approval.approvalId} is not APPROVED`);
  }
  return true;
}

function assertRequestInput(input) {
  if (!input || typeof input !== "object") {
    throw approvalError(E_APPROVAL_INVALID, "approval input must be an object");
  }
  assertApprovalIdFormat(input.approvalId);
  for (const key of ["actionId", "actionFingerprint", "contractFingerprint"]) {
    if (typeof input[key] !== "string" || !input[key]) {
      throw approvalError(E_APPROVAL_INVALID, `approval input.${key} must be a non-empty string`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(input.actionFingerprint)) {
    throw approvalError(
      E_APPROVAL_INVALID,
      "approval input.actionFingerprint must be a lowercase sha256 hex digest",
    );
  }
  if (!/^[a-f0-9]{64}$/.test(input.contractFingerprint)) {
    throw approvalError(
      E_APPROVAL_INVALID,
      "approval input.contractFingerprint must be a lowercase sha256 hex digest",
    );
  }
  if (!Number.isInteger(input.taskRevision) || input.taskRevision < 0) {
    throw approvalError(E_APPROVAL_INVALID, "approval input.taskRevision must be a non-negative integer");
  }
  if (input.reason !== undefined && input.reason !== null && (typeof input.reason !== "string" || input.reason.length > 512)) {
    throw approvalError(E_APPROVAL_INVALID, "approval input.reason must be a string of at most 512 characters");
  }
}

export async function requestApproval(target, { packageRoot, taskId, input }) {
  assertRequestInput(input);
  return withTaskTransaction(
    { target, taskId, operation: "request-approval" },
    async () => {
      const existing = await readApprovalFile(target, taskId, input.approvalId);
      if (existing) {
        validateApprovalArtifact(existing);
        const existingBinding = approvalBindingFields(existing);
        const nextBinding = { ...approvalBindingFields({ ...input }), taskId };
        for (const key of Object.keys(existingBinding)) {
          if (existingBinding[key] !== nextBinding[key]) {
            throw approvalError(
              E_APPROVAL_INVALID,
              `approval ${input.approvalId} already exists with a different immutable binding`,
            );
          }
        }
        return { created: false, idempotent: true, approval: existing };
      }

      const now = new Date().toISOString();
      const approval = {
        schemaVersion: 1,
        taskId,
        approvalId: input.approvalId,
        actionId: input.actionId,
        actionFingerprint: input.actionFingerprint,
        contractFingerprint: input.contractFingerprint,
        taskRevision: input.taskRevision,
        capability: input.capability,
        status: "PENDING",
        requestedAt: now,
        reason: input.reason ?? null,
      };
      validateApprovalArtifact(approval);

      await writeApprovalFile(target, taskId, approval);
      await appendProtocolEvent(target, {
        taskId,
        event: "APPROVAL_REQUESTED",
        fingerprint: approval.contractFingerprint,
        details: {
          approvalId: approval.approvalId,
          actionId: approval.actionId,
          actionFingerprint: approval.actionFingerprint,
          contractFingerprint: approval.contractFingerprint,
          taskRevision: approval.taskRevision,
          capability: approval.capability,
        },
      }, packageRoot, { taskId });

      return { created: true, idempotent: false, approval };
    },
  );
}

export async function resolveApproval(target, {
  packageRoot,
  taskId,
  approvalId,
  decision,
  authorityKind,
  hostGrantRef,
  authorityContext,
  reason,
}) {
  assertApprovalIdFormat(approvalId);
  if (!["APPROVED", "REJECTED"].includes(decision)) {
    throw approvalError(E_APPROVAL_INVALID, "decision must be APPROVED or REJECTED");
  }
  if (!["CALLER_ACKNOWLEDGED", "HOST_ATTESTED"].includes(authorityKind)) {
    throw approvalError(E_APPROVAL_INVALID, "authorityKind must be CALLER_ACKNOWLEDGED or HOST_ATTESTED");
  }
  if (authorityKind === "HOST_ATTESTED") {
    if (!isTrustedHostAuthorityContext(authorityContext)) {
      throw approvalError(
        E_ACTION_AUTHORITY_REQUIRED,
        "HOST_ATTESTED approval resolution requires a trusted host-boundary authority context",
      );
    }
    if (typeof hostGrantRef !== "string" || !hostGrantRef || hostGrantRef.length > 256) {
      throw approvalError(
        E_APPROVAL_INVALID,
        "HOST_ATTESTED resolution requires a bounded non-empty hostGrantRef supplied by the host boundary",
      );
    }
    if (typeof authorityContext?.grantRef === "string" && authorityContext.grantRef !== hostGrantRef) {
      throw approvalError(E_ACTION_AUTHORITY_REQUIRED, "hostGrantRef does not match the trusted host authority context");
    }
  } else if (hostGrantRef !== undefined && hostGrantRef !== null) {
    throw approvalError(
      E_APPROVAL_INVALID,
      "CALLER_ACKNOWLEDGED resolutions cannot carry a hostGrantRef",
    );
  }
  if (reason !== undefined && reason !== null && (typeof reason !== "string" || reason.length > 512)) {
    throw approvalError(E_APPROVAL_INVALID, "reason must be a string of at most 512 characters");
  }

  return withTaskTransaction(
    { target, taskId, operation: "resolve-approval" },
    async () => {
      const current = await readApprovalFile(target, taskId, approvalId);
      if (!current) {
        throw approvalError(E_ACTION_NOT_FOUND, `approval ${approvalId} does not exist for task ${taskId}`);
      }
      validateApprovalArtifact(current);
      if (current.status !== "PENDING") {
        throw approvalError(
          E_APPROVAL_ALREADY_RESOLVED,
          `approval ${approvalId} is already ${current.status}`,
        );
      }

      const resolved = {
        ...current,
        status: decision,
        decision,
        resolvedAt: new Date().toISOString(),
        authorityKind,
        hostGrantRef: authorityKind === "HOST_ATTESTED" ? hostGrantRef : null,
        reason: reason ?? current.reason ?? null,
      };
      validateApprovalArtifact(resolved);
      await writeApprovalFile(target, taskId, resolved);

      const details = {
        approvalId: resolved.approvalId,
        actionId: resolved.actionId,
        actionFingerprint: resolved.actionFingerprint,
        decision,
        authorityKind,
      };
      if (authorityKind === "HOST_ATTESTED") details.hostGrantRef = hostGrantRef;
      assertApprovalEventDetails({ event: "APPROVAL_RESOLVED", details });
      await appendProtocolEvent(target, {
        taskId,
        event: "APPROVAL_RESOLVED",
        fingerprint: resolved.contractFingerprint,
        details,
      }, packageRoot, { taskId });

      return resolved;
    },
  );
}

export async function readApproval(target, { packageRoot, taskId, approvalId }) {
  const approval = await readApprovalFile(target, taskId, approvalId);
  if (!approval) {
    throw approvalError(E_ACTION_NOT_FOUND, `approval ${approvalId} does not exist for task ${taskId}`);
  }
  return validateApprovalArtifact(approval);
}

export async function listApprovals(target, { packageRoot, taskId }) {
  const approvals = await listApprovalFiles(target, taskId);
  return approvals.map((approval) => validateApprovalArtifact(approval));
}

export async function validateApprovalForAction(target, {
  packageRoot,
  taskId,
  action,
  actionId,
  approvalId,
}) {
  const currentAction = action ?? await readAction(target, { packageRoot, taskId, actionId });
  if (currentAction.taskId !== taskId) {
    throw approvalError(E_APPROVAL_STALE, `action ${currentAction.actionId} belongs to a different task`);
  }
  const state = await readWorkState(target, { packageRoot, taskId });
  if (!state) {
    throw approvalError(E_APPROVAL_INVALID, `task ${taskId} has no canonical work state`);
  }
  const approval = await readApproval(target, { packageRoot, taskId, approvalId });
  assertApprovalFresh(approval, {
    taskId,
    actionId: currentAction.actionId,
    actionFingerprint: currentAction.actionFingerprint,
    contractFingerprint: state.contractFingerprint,
    taskRevision: state.revision ?? 0,
    capability: currentAction.capability,
  });
  return approval;
}
