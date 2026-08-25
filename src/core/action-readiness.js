import { readAction, listActions } from "./actions.js";
import { projectActionLedger } from "./action-ledger-projection.js";

export const ACTION_READINESS_STATUSES = Object.freeze([
  "SATISFIED",
  "PENDING",
  "FAILED",
  "AMBIGUOUS",
  "UNTRUSTED",
]);

function result(actionId, status, reasons, extra = {}) {
  return {
    actionId,
    status,
    reasons,
    ...extra,
  };
}

/**
 * Canonical readiness projection for one durable action. Completion truth is
 * derived here and nowhere else (INV-VERIFY-02): raw `state === "VERIFIED"`
 * labels are never sufficient without trusted authorization and canonical
 * verification evidence replayed from the ledger.
 */
export async function evaluateActionReadiness({
  target,
  packageRoot,
  taskId,
  action,
}) {
  const resolved = action ?? await readAction(target, { packageRoot, taskId, actionId: action?.actionId });
  const ledger = await projectActionLedger({
    target,
    packageRoot,
    taskId,
    actionId: resolved.actionId,
    artifact: resolved,
  });

  if (!ledger.valid) {
    return result(resolved.actionId, "UNTRUSTED", [
      "action ledger chronology is invalid or diverges from the artifact",
      ...ledger.errors.map((error) => error.message),
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  if (resolved.state === "COMMIT_UNKNOWN") {
    return result(resolved.actionId, "AMBIGUOUS", [
      "external commit state is unknown; reconcile through a trusted boundary",
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  if (resolved.state === "FAILED" || resolved.state === "CANCELLED") {
    return result(resolved.actionId, "FAILED", [
      `action is ${resolved.state}`,
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  if (resolved.state !== "VERIFIED") {
    return result(resolved.actionId, "PENDING", [
      `action is ${resolved.state}; verification requires canonical independent evidence`,
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  // A required action without a requirement can never be strongly verified:
  // legacy artifacts stay readable but cannot become trusted-satisfied
  // (INV-FINAL-VERIFY-02).
  if (
    resolved.requiredForCompletion
    && (typeof resolved.requirement !== "string" || resolved.requirement.length === 0)
  ) {
    return result(resolved.actionId, "UNTRUSTED", [
      "required action has no canonical requirement binding",
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  // VERIFIED label present: trust requires modern authorization evidence.
  if (!ledger.authorization.valid) {
    return result(resolved.actionId, "UNTRUSTED", [
      "authorization evidence is invalid or legacy pre-hardening",
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  if (!ledger.verification.valid) {
    return result(resolved.actionId, "UNTRUSTED", [
      "verification evidence is missing or not canonical",
    ], { authorization: ledger.authorization, verification: ledger.verification });
  }

  return result(resolved.actionId, "SATISFIED", [], {
    authorization: ledger.authorization,
    verification: ledger.verification,
  });
}

/**
 * Readiness summary over every required-for-completion action in a task.
 */
export async function evaluateRequiredActionReadiness({
  target,
  packageRoot,
  taskId,
}) {
  const actions = await listActions(target, { packageRoot, taskId });
  const required = actions.filter((action) => action.requiredForCompletion);
  const evaluated = [];
  for (const action of required) {
    evaluated.push(await evaluateActionReadiness({ target, packageRoot, taskId, action }));
  }
  return {
    total: required.length,
    satisfied: evaluated.filter((item) => item.status === "SATISFIED").length,
    unresolved: evaluated.filter((item) => item.status !== "SATISFIED").length,
    ambiguous: evaluated.filter((item) => item.status === "AMBIGUOUS").length,
    failed: evaluated.filter((item) => item.status === "FAILED").length,
    untrusted: evaluated.filter((item) => item.status === "UNTRUSTED").length,
    actions: evaluated,
  };
}
