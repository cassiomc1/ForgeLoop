import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getActiveTaskTransaction, withTaskTransaction } from "./transaction.js";
import { appendProtocolEvent, readEvents } from "./events.js";
import {
  canonicalActionFingerprint,
  actionRequiresIdempotency,
  assertActionTransition,
  assertActionAuthorizationDetails,
  assertActionVerificationDetails,
  validateActionArtifact,
} from "./action-model.js";
import { ACTION_STATES } from "./action-constants.js";
import {
  E_ACTION_AUTHORIZATION_INVALID,
  E_ACTION_EVIDENCE_INVALID,
  E_ACTION_IDEMPOTENCY_CONFLICT,
  E_ACTION_IDEMPOTENCY_REQUIRED,
  E_ACTION_INVALID,
  E_ACTION_NOT_FOUND,
  E_ACTION_STATE_MISMATCH,
  E_ACTION_VERIFICATION_REQUIRED,
} from "./error-codes.js";
import { assertSafePath, ensureWithin } from "./filesystem.js";
import { taskActionPath, taskDirectory, TASK_ARTIFACT_FILES } from "./task-paths.js";

const STATE_EVENT_NAMES = Object.freeze({
  AUTHORIZED: "ACTION_AUTHORIZED",
  STARTED: "ACTION_STARTED",
  COMMITTED: "ACTION_COMMIT_RECORDED",
  VERIFIED: "ACTION_VERIFIED",
  FAILED: "ACTION_FAILED",
  COMMIT_UNKNOWN: "ACTION_COMMIT_UNKNOWN",
  CANCELLED: "ACTION_CANCELLED",
});

function actionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readActionFile(target, packageRoot, taskId, actionId) {
  const relPath = taskActionPath(taskId, actionId);
  await assertSafePath(target, relPath);
  const absolute = ensureWithin(target, relPath);
  let text;
  try {
    text = await readFile(absolute, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw actionError(E_ACTION_INVALID, `durable action artifact is not valid JSON: ${relPath}`);
  }
}

async function writeActionFile(target, packageRoot, taskId, action) {
  const relPath = taskActionPath(taskId, action.actionId);
  await assertSafePath(target, relPath);
  const serialized = `${JSON.stringify(action, null, 2)}\n`;
  const activeTransaction = getActiveTaskTransaction();
  if (activeTransaction) {
    await activeTransaction.stageText(relPath, serialized);
  } else {
    const absolute = ensureWithin(target, relPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, serialized, "utf8");
  }
}

function taskActionsDirectory(taskId) {
  return `${taskDirectory(taskId)}/${TASK_ARTIFACT_FILES.actions}`;
}

async function listActionFiles(target, packageRoot, taskId) {
  const relDir = taskActionsDirectory(taskId);
  await assertSafePath(target, relDir);
  const absoluteDir = ensureWithin(target, relDir);
  let entries;
  try {
    entries = await readdir(absoluteDir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const actions = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const parsed = await readActionFile(target, packageRoot, taskId, entry.replace(/\.json$/, ""));
    if (parsed) actions.push(parsed);
  }
  actions.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  return actions;
}

function assertProposeInput(input) {
  if (!input || typeof input !== "object") {
    throw actionError(E_ACTION_INVALID, "action input must be an object");
  }
  if (typeof input.actionId !== "string" || !/^action-[A-Za-z0-9_-]+$/.test(input.actionId)) {
    throw actionError(E_ACTION_INVALID, "actionId must match action-[A-Za-z0-9_-]+");
  }
  for (const key of ["effectClass", "capability", "operation", "target", "provenance"]) {
    if (typeof input[key] !== "string" || !input[key]) {
      throw actionError(E_ACTION_INVALID, `action input.${key} must be a non-empty string`);
    }
  }
  if (actionRequiresIdempotency(input.effectClass)) {
    if (typeof input.idempotencyKey !== "string" || !input.idempotencyKey) {
      throw actionError(
        E_ACTION_IDEMPOTENCY_REQUIRED,
        `effectClass ${input.effectClass} requires an idempotency key`,
      );
    }
  }
}

export async function proposeAction(target, { packageRoot, taskId, input }) {
  assertProposeInput(input);
  return withTaskTransaction(
    { target, taskId, operation: "propose-action" },
    async () => {
      const existingByKey = input.idempotencyKey
        ? await findActionByIdempotencyKey(target, { packageRoot, taskId, idempotencyKey: input.idempotencyKey })
        : null;

      const identityFingerprint = canonicalActionFingerprint({ taskId, ...input });
      if (existingByKey) {
        if (existingByKey.actionFingerprint === identityFingerprint) {
          return { created: false, idempotent: true, action: existingByKey };
        }
        throw actionError(
          E_ACTION_IDEMPOTENCY_CONFLICT,
          `idempotency key ${JSON.stringify(input.idempotencyKey)} already binds to action ${existingByKey.actionId}`,
        );
      }

      const existingById = await readActionFile(target, packageRoot, taskId, input.actionId);
      if (existingById) {
        if (existingById.actionFingerprint === identityFingerprint) {
          validateActionArtifact(existingById);
          return { created: false, idempotent: true, action: existingById };
        }
        throw actionError(
          E_ACTION_INVALID,
          `action ${input.actionId} already exists with a different immutable identity`,
        );
      }

      const now = new Date().toISOString();
      const action = {
        schemaVersion: 1,
        taskId,
        actionId: input.actionId,
        actionFingerprint: identityFingerprint,
        effectClass: input.effectClass,
        capability: input.capability,
        operation: input.operation,
        target: input.target,
        idempotencyKey: input.idempotencyKey ?? null,
        requiredForCompletion: Boolean(input.requiredForCompletion),
        requirement: input.requirement ?? null,
        provenance: input.provenance,
        state: "PROPOSED",
        revision: 0,
        createdAt: now,
        updatedAt: now,
      };
      validateActionArtifact(action);

      await writeActionFile(target, packageRoot, taskId, action);
      await appendProtocolEvent(target, {
        taskId,
        event: "ACTION_PROPOSED",
        fingerprint: action.actionFingerprint,
        details: {
          actionId: action.actionId,
          actionFingerprint: action.actionFingerprint,
          effectClass: action.effectClass,
          capability: action.capability,
          idempotencyKey: action.idempotencyKey,
          requiredForCompletion: action.requiredForCompletion,
          requirement: action.requirement,
          provenance: action.provenance,
        },
      }, packageRoot, { taskId });

      return { created: true, idempotent: false, action };
    },
  );
}

export async function readAction(target, { packageRoot, taskId, actionId }) {
  const action = await readActionFile(target, packageRoot, taskId, actionId);
  if (!action) {
    throw actionError(E_ACTION_NOT_FOUND, `durable action ${actionId} does not exist for task ${taskId}`);
  }
  return validateActionArtifact(action);
}

export async function listActions(target, { packageRoot, taskId }) {
  const actions = await listActionFiles(target, packageRoot, taskId);
  return actions.map((action) => validateActionArtifact(action));
}

export async function findActionByIdempotencyKey(target, { packageRoot, taskId, idempotencyKey }) {
  if (typeof idempotencyKey !== "string" || !idempotencyKey) {
    throw actionError(E_ACTION_INVALID, "idempotencyKey must be a non-empty string");
  }
  const actions = await listActionFiles(target, packageRoot, taskId);
  const found = actions.find((action) => action.idempotencyKey === idempotencyKey);
  return found ? validateActionArtifact(found) : null;
}

// Security-sensitive states can never be minted through the generic
// caller-reachable transition primitive; dedicated services below own them.
const GENERIC_TRANSITION_FORBIDDEN_STATES = Object.freeze(["AUTHORIZED", "VERIFIED"]);

async function applyTransition(target, {
  packageRoot,
  taskId,
  actionId,
  to,
  details = {},
  expectedRevision,
  expectedFingerprint,
}) {
  if (!ACTION_STATES.includes(to)) {
    throw actionError(E_ACTION_INVALID, `unknown action state ${to}`);
  }
  if (typeof details !== "object" || details === null || Array.isArray(details)) {
    throw actionError(E_ACTION_EVIDENCE_INVALID, "transition details must be an object");
  }
  if (details.evidenceRefs !== undefined) {
    if (!Array.isArray(details.evidenceRefs) || details.evidenceRefs.some((ref) => typeof ref !== "string" || !ref || ref.length > 256)) {
      throw actionError(E_ACTION_EVIDENCE_INVALID, "evidenceRefs must be bounded non-empty strings");
    }
  }

  return withTaskTransaction(
    { target, taskId, operation: "transition-action" },
    async () => {
      const current = await readAction(target, { packageRoot, taskId, actionId });
      assertActionTransition(current.state, to);

      if (Number.isInteger(expectedRevision) && current.revision !== expectedRevision) {
        throw actionError(
          E_ACTION_STATE_MISMATCH,
          `action revision ${current.revision} does not match expected ${expectedRevision}`,
        );
      }
      if (typeof expectedFingerprint === "string" && current.actionFingerprint !== expectedFingerprint) {
        throw actionError(E_ACTION_INVALID, "action fingerprint does not match the expected fingerprint");
      }

      const next = {
        ...current,
        state: to,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      if (details.evidenceRef !== undefined) {
        if (typeof details.evidenceRef !== "string" || !details.evidenceRef || details.evidenceRef.length > 256) {
          throw actionError(E_ACTION_EVIDENCE_INVALID, "evidenceRef must be a bounded non-empty string");
        }
        next.lastEvidenceRef = details.evidenceRef;
      }
      if (details.reconciliationAt !== undefined) {
        next.lastReconciliationAt = details.reconciliationAt;
      }
      if (details.commitResultCode !== undefined) {
        next.commitResultCode = details.commitResultCode;
      }
      validateActionArtifact(next);
      await writeActionFile(target, packageRoot, taskId, next);

      const baseDetails = {
        actionId: next.actionId,
        actionFingerprint: next.actionFingerprint,
        fromState: current.state,
        toState: to,
        revision: next.revision,
      };
      const boundedDetails = { ...baseDetails };
      for (const key of [
        "evidenceRef",
        "evidenceKind",
        "evidenceRefs",
        "reason",
        "reconciliationOutcome",
        "observedAt",
        "commitResultCode",
        "capabilityDecision",
        "capabilityPolicyFingerprint",
        "policyLockDigest",
        "taskPolicyDigest",
        "approvalId",
        "approvalFingerprint",
        "authorityKind",
        "authorityRef",
        "reportedProvenance",
      ]) {
        if (details[key] !== undefined && details[key] !== null) boundedDetails[key] = details[key];
      }
      if (to === "VERIFIED") boundedDetails.verifiedAt = next.updatedAt;

      const reconciliationDriven = current.state === "COMMIT_UNKNOWN";
      if (reconciliationDriven) {
        await appendProtocolEvent(target, {
          taskId,
          event: "ACTION_RECONCILED",
          fingerprint: next.actionFingerprint,
          details: { ...boundedDetails, outcome: details.reconciliationOutcome ?? "UNKNOWN" },
        }, packageRoot, { taskId });
        if (to === "COMMITTED") {
          await appendProtocolEvent(target, {
            taskId,
            event: "ACTION_COMMIT_RECORDED",
            fingerprint: next.actionFingerprint,
            details: { ...boundedDetails, reconciled: true },
          }, packageRoot, { taskId });
        }
      } else {
        await appendProtocolEvent(target, {
          taskId,
          event: STATE_EVENT_NAMES[to],
          fingerprint: next.actionFingerprint,
          details: boundedDetails,
        }, packageRoot, { taskId });
      }

      return next;
    },
  );
}

/**
 * Generic observation transition. Refuses security-sensitive states: callers
 * can observe execution outcomes but can never authorize or verify.
 */
export async function transitionAction(target, {
  packageRoot,
  taskId,
  actionId,
  to,
  details = {},
  expectedRevision,
  expectedFingerprint,
}) {
  if (GENERIC_TRANSITION_FORBIDDEN_STATES.includes(to)) {
    throw actionError(
      to === "AUTHORIZED" ? E_ACTION_AUTHORIZATION_INVALID : E_ACTION_VERIFICATION_REQUIRED,
      `state ${to} is owned by a canonical ForgeLoop service and cannot be recorded by a generic caller surface`,
    );
  }
  return applyTransition(target, {
    packageRoot, taskId, actionId, to, details, expectedRevision, expectedFingerprint,
  });
}

/**
 * Canonical authorization transition. Only the authorization service may call
 * it and only with complete policy-bound evidence (INV-AUTH-02).
 */
export async function transitionAuthorizedAction(target, {
  packageRoot,
  taskId,
  actionId,
  details = {},
  expectedRevision,
  expectedFingerprint,
}) {
  assertActionAuthorizationDetails(details, { legacyAllowed: false });
  const next = await applyTransition(target, {
    packageRoot, taskId, actionId, to: "AUTHORIZED", details, expectedRevision, expectedFingerprint,
  });
  return next;
}

/**
 * Canonical verification transition. Only the verification service may call
 * it and only with canonical independent postcondition evidence.
 */
export async function transitionVerifiedAction(target, {
  packageRoot,
  taskId,
  actionId,
  details = {},
  expectedRevision,
  expectedFingerprint,
}) {
  assertActionVerificationDetails(details);
  return applyTransition(target, {
    packageRoot, taskId, actionId, to: "VERIFIED", details, expectedRevision, expectedFingerprint,
  });
}

export async function detectOrphanActions(target, { packageRoot, taskId }) {
  const actions = await listActionFiles(target, packageRoot, taskId);
  const events = await readEvents(target, packageRoot, { taskId });
  const proposedFingerprints = new Set(
    events
      .filter((event) => event.event === "ACTION_PROPOSED")
      .map((event) => event.details?.actionFingerprint),
  );
  return actions
    .filter((action) => !proposedFingerprints.has(action.actionFingerprint))
    .map((action) => action.actionId);
}

export async function validateActionLedgerConsistency(target, { packageRoot, taskId }) {
  const actions = await listActionFiles(target, packageRoot, taskId);
  const events = await readEvents(target, packageRoot, { taskId });
  const issues = [];
  for (const action of actions) {
    const related = events.filter((event) => event.details?.actionId === action.actionId);
    if (!related.some((event) => event.event === "ACTION_PROPOSED" && event.details?.actionFingerprint === action.actionFingerprint)) {
      issues.push({ actionId: action.actionId, code: "E_ACTION_EVIDENCE_INVALID", message: `action ${action.actionId} has no matching ACTION_PROPOSED ledger event` });
      continue;
    }
    if (action.state !== "PROPOSED" && !related.some((event) => event.details?.toState === action.state || event.event === `ACTION_${action.state}` || (action.state === "COMMITTED" && event.event === "ACTION_COMMIT_RECORDED"))) {
      issues.push({ actionId: action.actionId, code: "E_ACTION_EVIDENCE_INVALID", message: `action ${action.actionId} state ${action.state} has no matching transition event` });
    }
  }
  return issues;
}
