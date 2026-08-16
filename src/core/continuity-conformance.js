import { classifyContinuity } from "./continuity-reconciliation.js";

function error(code, message) {
  return { code, message, artifacts: ["continuity", "state"] };
}

export function evaluateContinuityConformance(input = {}) {
  if (!input.continuity) {
    return {
      required: false,
      status: "NOT_APPLICABLE",
      classification: "ABSENT",
      errors: [],
      reasonCodes: [],
      reasons: ["CONTINUITY_ABSENT"],
      authority: "OPERATIONAL_CONTEXT_ONLY",
      evidenceAuthority: "NONE",
    };
  }

  const classification = classifyContinuity(input);
  const result = {
    required: false,
    status: classification.classification === "FRESH"
      ? "VALID"
      : classification.classification === "RECONCILIATION_REQUIRED"
        ? "STALE"
        : classification.classification === "NOT_APPLICABLE"
          ? "NOT_APPLICABLE"
          : classification.classification,
    classification: classification.classification,
    errors: [],
    reasonCodes: [...classification.reasonCodes],
    reasons: [...classification.reasons],
    authority: "OPERATIONAL_CONTEXT_ONLY",
    evidenceAuthority: "NONE",
  };

  if (["INVALID", "INCONSISTENT"].includes(classification.classification)) {
    result.errors = classification.reasonCodes.map((code, index) => error(
      code,
      classification.reasons[index] ?? `Continuity is ${classification.classification.toLowerCase()}`,
    ));
  }
  return result;
}
