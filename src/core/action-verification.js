import { readAction, transitionVerifiedAction } from "./actions.js";
import { readExecutionArtifact } from "./execution.js";
import {
  E_ACTION_STATE_MISMATCH,
  E_ACTION_VERIFICATION_INVALID,
} from "./error-codes.js";

function verificationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Resolve canonical verification evidence for an action. For the first
 * hardened release only ForgeLoop-validated execution artifacts qualify:
 * an independent passed command execution bound to this task. Arbitrary
 * strings and actor-reported observations fail closed (INV-VERIFY-01).
 */
async function resolveActionVerificationEvidence({
  target,
  packageRoot,
  taskId,
  action,
  evidenceRef,
}) {
  if (typeof evidenceRef !== "string" || !evidenceRef || evidenceRef.length > 256) {
    throw verificationError(E_ACTION_VERIFICATION_INVALID, "verification evidenceRef must be a bounded non-empty string");
  }
  let artifact;
  try {
    artifact = await readExecutionArtifact({
      target,
      packageRoot,
      taskId,
      executionRef: evidenceRef,
    });
  } catch (error) {
    throw verificationError(
      E_ACTION_VERIFICATION_INVALID,
      `verification evidence does not resolve to a canonical ForgeLoop execution artifact: ${error.message}`,
    );
  }
  const execution = artifact.value ?? artifact;
  if (execution.status !== "passed") {
    throw verificationError(E_ACTION_VERIFICATION_INVALID, "action verification evidence must be a passed execution");
  }
  if (execution.taskId !== taskId) {
    throw verificationError(E_ACTION_VERIFICATION_INVALID, "verification evidence belongs to a different task");
  }
  // The action's own commit execution proves local completion only; it can
  // never double as independent postcondition verification.
  if (execution.checkId === `action:${action.actionId}`) {
    throw verificationError(
      E_ACTION_VERIFICATION_INVALID,
      "action execution is commit evidence, not independent postcondition verification",
    );
  }
  return { kind: "FORGELOOP_EXECUTION", evidenceRef };
}

/**
 * Canonical action verification (INV-VERIFY-01). VERIFIED is not a
 * caller-reportable status: it requires a validated independent canonical
 * evidence reference produced by e.g. run-check.
 */
export async function verifyAction({
  target,
  packageRoot,
  taskId,
  actionId,
  evidenceRef,
}) {
  const action = await readAction(target, { packageRoot, taskId, actionId });
  if (action.state !== "COMMITTED") {
    throw verificationError(
      E_ACTION_STATE_MISMATCH,
      `action ${actionId} must be COMMITTED before verification; current state is ${action.state}`,
    );
  }
  const evidence = await resolveActionVerificationEvidence({
    target, packageRoot, taskId, action, evidenceRef,
  });
  return transitionVerifiedAction(target, {
    packageRoot,
    taskId,
    actionId: action.actionId,
    expectedRevision: action.revision,
    expectedFingerprint: action.actionFingerprint,
    details: {
      evidenceRef: evidence.evidenceRef,
      evidenceKind: evidence.kind,
      verifiedAt: new Date().toISOString(),
    },
  });
}
