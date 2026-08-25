import { readAction, transitionAuthorizedAction } from "./actions.js";
import { loadPolicyIdentity } from "./policy-engine.js";
import { evaluateActionCapability } from "./capability-policy.js";
import {
  E_ACTION_AUTHORIZATION_INVALID,
  E_ACTION_INVALID,
  E_ACTION_STATE_MISMATCH,
} from "./error-codes.js";

function actionAuthorizationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Canonical durable-action authorization.
 *
 * AUTHORIZED can only be produced here, after:
 * - the action is PROPOSED with a known identity;
 * - the capability policy, policy lock, and task policy snapshot agree
 *   (loadPolicyIdentity);
 * - the capability decision is satisfied (ALLOW / trusted host authority /
 *   fresh HOST_ATTESTED approval);
 * - complete policy-bound evidence is appended to the ledger event
 *   (INV-AUTH-01, INV-AUTH-02).
 *
 * `authorityContext` must be supplied out-of-band by a trusted host boundary;
 * actor-controlled input can never mint it.
 */
export async function authorizeAction({
  target,
  packageRoot,
  taskId,
  actionId,
  approvalId,
  authorityContext,
}) {
  const action = await readAction(target, { packageRoot, taskId, actionId });

  if (action.state !== "PROPOSED") {
    throw actionAuthorizationError(
      E_ACTION_STATE_MISMATCH,
      `action ${actionId} must be PROPOSED before authorization`,
    );
  }

  const policyIdentity = await loadPolicyIdentity(target, packageRoot, taskId);

  if (policyIdentity.status !== "VALID") {
    throw actionAuthorizationError(
      policyIdentity.code ?? E_ACTION_AUTHORIZATION_INVALID,
      "current capability policy is not bound to a valid task policy epoch",
    );
  }

  const capability = await evaluateActionCapability({
    target,
    packageRoot,
    action,
    authorityContext,
    approval: approvalId ? { approvalId } : undefined,
  });

  if (!capability.allowed) {
    throw actionAuthorizationError(
      capability.reasonCode ?? E_ACTION_INVALID,
      `capability ${action.capability} is not authorized: ${capability.decision}`,
    );
  }

  const authorization = {
    capabilityDecision: capability.decision,
    capabilityPolicyFingerprint: capability.policyFingerprint,
    policyLockDigest: policyIdentity.lockDigest,
    taskPolicyDigest: policyIdentity.taskPolicyDigest,
  };

  // Decision-specific mandatory evidence (INV-AUTH-02).
  if (capability.approval) {
    authorization.approvalId = capability.approval.approvalId;
    authorization.approvalFingerprint = capability.approval.approvalFingerprint;
    authorization.authorityKind = capability.approval.authorityKind;
    authorization.authorityRef = capability.approval.authorityRef;
  } else if (capability.authority) {
    authorization.authorityKind = capability.authority.authorityKind;
    authorization.authorityRef = capability.authority.authorityRef;
  }

  const next = await transitionAuthorizedAction(target, {
    packageRoot,
    taskId,
    actionId: action.actionId,
    expectedRevision: action.revision,
    expectedFingerprint: action.actionFingerprint,
    details: {
      ...authorization,
      actionFingerprint: action.actionFingerprint,
    },
  });

  return {
    action: next,
    authorization,
  };
}
