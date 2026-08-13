export const BLOCKING_REASON_CODES = Object.freeze([
  "REAL_BUSINESS_FACT_REQUIRED",
  "SENSITIVE_VALUE_REQUIRED",
  "EXTERNAL_AUTHORITY_REQUIRED",
  "IRREVERSIBLE_DECISION_REQUIRED",
  "REGULATED_CLAIM_REQUIRED",
  "DESTRUCTIVE_ACTION_REQUIRED",
]);

const BLOCKING_RULES = Object.freeze([
  ["realBusinessFact", "REAL_BUSINESS_FACT_REQUIRED"],
  ["sensitive", "SENSITIVE_VALUE_REQUIRED"],
  ["authoritative", "EXTERNAL_AUTHORITY_REQUIRED"],
  ["external", "EXTERNAL_AUTHORITY_REQUIRED"],
  ["irreversible", "IRREVERSIBLE_DECISION_REQUIRED"],
  ["regulatedClaim", "REGULATED_CLAIM_REQUIRED"],
  ["destructive", "DESTRUCTIVE_ACTION_REQUIRED"],
]);

function blockingDecision(reasonCode) {
  return {
    classification: "BLOCKING",
    reasonCode,
    blockingReason: reasonCode,
  };
}

export function classifyDecision(flags = {}) {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    return { classification: "NON_BLOCKING", reasonCode: "SAFE_REVERSIBLE_LOCAL_DEFAULT", blockingReason: null };
  }

  for (const [flag, reasonCode] of BLOCKING_RULES) {
    if (flags[flag] === true) return blockingDecision(reasonCode);
  }
  if (flags.reversible === false || flags.local === false) {
    return blockingDecision(
      flags.reversible === false
        ? "IRREVERSIBLE_DECISION_REQUIRED"
        : "REAL_BUSINESS_FACT_REQUIRED",
    );
  }

  return {
    classification: "NON_BLOCKING",
    reasonCode: "SAFE_REVERSIBLE_LOCAL_DEFAULT",
    blockingReason: null,
  };
}

export function canAskUser(decision) {
  return decision?.classification === "BLOCKING"
    && BLOCKING_REASON_CODES.includes(decision.reasonCode)
    && decision.blockingReason === decision.reasonCode;
}
