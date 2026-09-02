import { E_ADVISORY_CONTEXT_REQUEST_INVALID } from "../error-codes.js";

export const ADVISORY_CONTEXT_LIMITS = Object.freeze({
  defaultItems: 6,
  maxItems: 20,
  defaultMaxItemChars: 1200,
  maxItemChars: 4000,
  defaultMaxTotalChars: 6000,
  maxTotalChars: 16000,
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 30000,
  maxProviderReturnedItems: 100,
  maxQueryChars: 1000,
  maxSourceRefChars: 2048,
  maxTitleChars: 300,
});

function normalizeIntegerOption(value, {
  name,
  defaultValue,
  minimum,
  maximum,
} = {}) {
  if (value === undefined) return defaultValue;
  if (!Number.isSafeInteger(value) || value < minimum) {
    const error = new Error(`${name} must be a finite integer greater than or equal to ${minimum}`);
    error.name = "AdvisoryContextRequestError";
    error.code = E_ADVISORY_CONTEXT_REQUEST_INVALID;
    throw error;
  }
  return Math.min(value, maximum);
}

export function normalizeAdvisoryRecallOptions({
  limit,
  maxItemChars,
  maxTotalChars,
  timeoutMs,
} = {}) {
  return Object.freeze({
    limit: normalizeIntegerOption(limit, {
      name: "limit",
      defaultValue: ADVISORY_CONTEXT_LIMITS.defaultItems,
      minimum: 1,
      maximum: ADVISORY_CONTEXT_LIMITS.maxItems,
    }),
    maxItemChars: normalizeIntegerOption(maxItemChars, {
      name: "maxItemChars",
      defaultValue: ADVISORY_CONTEXT_LIMITS.defaultMaxItemChars,
      minimum: 100,
      maximum: ADVISORY_CONTEXT_LIMITS.maxItemChars,
    }),
    maxTotalChars: normalizeIntegerOption(maxTotalChars, {
      name: "maxTotalChars",
      defaultValue: ADVISORY_CONTEXT_LIMITS.defaultMaxTotalChars,
      minimum: 500,
      maximum: ADVISORY_CONTEXT_LIMITS.maxTotalChars,
    }),
    timeoutMs: normalizeIntegerOption(timeoutMs, {
      name: "timeoutMs",
      defaultValue: ADVISORY_CONTEXT_LIMITS.defaultTimeoutMs,
      minimum: 1,
      maximum: ADVISORY_CONTEXT_LIMITS.maxTimeoutMs,
    }),
  });
}

export const ADVISORY_CONTEXT_TRUST = Object.freeze({
  authority: "ADVISORY",
  evidenceAuthority: "NONE",
  actionability: "NON_EXECUTABLE",
  trustRole: "NON_EVIDENCE_ADVISORY_CONTEXT",
  persisted: false,
});
