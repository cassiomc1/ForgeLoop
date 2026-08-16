const HEALTHY = new Set(["ABSENT", "FRESH", "NOT_APPLICABLE"]);

export function continuityIsHealthy(result) {
  return HEALTHY.has(result?.classification ?? "ABSENT");
}

export function continuityFinding(result) {
  if (continuityIsHealthy(result)) return null;
  const classification = result?.classification ?? "INVALID";
  const severity = classification === "RECONCILIATION_REQUIRED" ? "warning" : "error";
  return {
    code: `continuity-${classification.toLowerCase().replaceAll("_", "-")}`,
    severity,
    path: result?.path ?? ".forgeloop/continuity.json",
    message: result?.reasons?.join(", ") || `Continuity is ${classification}`,
    remediation: classification === "RECONCILIATION_REQUIRED"
      ? "Run forgeloop reconcile-continuity, inspect the current checkout, then record corrected continuity before advancing verification."
      : "Repair or clear continuity after reviewing the current work state and checkout.",
  };
}
