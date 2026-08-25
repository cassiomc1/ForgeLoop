import { readAction, transitionAction } from "./actions.js";
import { assertReconciliationSettlementAllowed } from "./action-reconciliation-policy.js";
import { E_ACTION_EVIDENCE_INVALID, E_ACTION_STATE_MISMATCH } from "./error-codes.js";

function reconciliationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Reconcile a COMMIT_UNKNOWN action from observed external state.
 *
 * - UNKNOWN is a safe observation: the action remains COMMIT_UNKNOWN
 *   (INV-RECON-01).
 * - COMMITTED settles the ambiguity as externally committed.
 * - NOT_COMMITTED proves the external effect did not happen and returns the
 *   action to PROPOSED so any retry re-evaluates policy, approval, authority,
 *   and the task policy snapshot (INV-RECON-03). Stale authorization can
 *   never be reused.
 *
 * Settling outcomes (COMMITTED / NOT_COMMITTED) require trusted host
 * attestation plus bounded evidence, supplied out-of-band (INV-RECON-02).
 */
export async function reconcileAction({ target, packageRoot, taskId, actionId, outcome,
  evidenceRefs = [], observedAt = new Date().toISOString(), provenance = "EXTERNAL_OBSERVED",
  authorityContext }) {
  if (!["COMMITTED", "NOT_COMMITTED", "UNKNOWN"].includes(outcome)) {
    throw reconciliationError(E_ACTION_EVIDENCE_INVALID,
      "reconciliation outcome must be COMMITTED, NOT_COMMITTED, or UNKNOWN");
  }
  if (provenance !== "EXTERNAL_OBSERVED") {
    throw reconciliationError(E_ACTION_EVIDENCE_INVALID,
      "reconciliation provenance must be EXTERNAL_OBSERVED");
  }
  const settlement = assertReconciliationSettlementAllowed({ outcome, authorityContext, evidenceRefs });

  const action = await readAction(target, { packageRoot, taskId, actionId });
  if (action.state !== "COMMIT_UNKNOWN") {
    throw reconciliationError(E_ACTION_STATE_MISMATCH,
      `action ${actionId} is ${action.state}, not COMMIT_UNKNOWN`);
  }
  if (outcome === "UNKNOWN") {
    const unchanged = await transitionAction(target, { packageRoot, taskId, actionId,
      to: "COMMIT_UNKNOWN", expectedRevision: action.revision,
      details: { reconciliationOutcome: outcome, evidenceRefs, observedAt, reconciliationAt: observedAt } });
    return { action: unchanged, outcome, changed: false };
  }

  // NOT_COMMITTED deliberately returns to PROPOSED (not AUTHORIZED): the next
  // execution must produce fresh authorization under the current policy epoch.
  const to = outcome === "COMMITTED" ? "COMMITTED" : "PROPOSED";
  const next = await transitionAction(target, { packageRoot, taskId, actionId, to,
    expectedRevision: action.revision,
    details: {
      reconciliationOutcome: outcome,
      evidenceRefs,
      observedAt,
      reconciliationAt: observedAt,
      ...(settlement ? {
        authorityKind: settlement.authorityKind,
        authorityRef: settlement.authorityRef,
      } : {}),
    } });
  return { action: next, outcome, changed: true };
}
