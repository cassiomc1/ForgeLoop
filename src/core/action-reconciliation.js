import { readAction, transitionAction } from "./actions.js";

export async function reconcileAction({ target, packageRoot, taskId, actionId, outcome,
  evidenceRefs = [], observedAt = new Date().toISOString(), provenance = "EXTERNAL_OBSERVED" }) {
  if (!['COMMITTED', 'NOT_COMMITTED', 'UNKNOWN'].includes(outcome)) {
    const error = new Error("reconciliation outcome must be COMMITTED, NOT_COMMITTED, or UNKNOWN");
    error.code = "E_ACTION_EVIDENCE_INVALID"; throw error;
  }
  if (provenance !== "EXTERNAL_OBSERVED") {
    const error = new Error("reconciliation provenance must be EXTERNAL_OBSERVED");
    error.code = "E_ACTION_EVIDENCE_INVALID"; throw error;
  }
  const action = await readAction(target, { packageRoot, taskId, actionId });
  if (action.state !== "COMMIT_UNKNOWN") {
    const error = new Error(`action ${actionId} is ${action.state}, not COMMIT_UNKNOWN`);
    error.code = "E_ACTION_STATE_MISMATCH"; throw error;
  }
  if (outcome === "UNKNOWN") {
    const unchanged = await transitionAction(target, { packageRoot, taskId, actionId,
      to: "COMMIT_UNKNOWN", expectedRevision: action.revision,
      details: { reconciliationOutcome: outcome, evidenceRefs, observedAt, reconciliationAt: observedAt } });
    return { action: unchanged, outcome, changed: false };
  }
  const to = outcome === "COMMITTED" ? "COMMITTED" : "AUTHORIZED";
  const next = await transitionAction(target, { packageRoot, taskId, actionId, to,
    expectedRevision: action.revision, details: { reconciliationOutcome: outcome,
      evidenceRefs, observedAt, reconciliationAt: observedAt } });
  return { action: next, outcome, changed: true };
}
