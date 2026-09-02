export const ADVISORY_CONTEXT_LIMITS = Object.freeze({
  defaultItems: 6,
  maxItems: 20,
  defaultMaxItemChars: 1200,
  maxItemChars: 4000,
  defaultMaxTotalChars: 6000,
  maxTotalChars: 16000,
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 30000,
  maxQueryChars: 1000,
  maxSourceRefChars: 2048,
  maxTitleChars: 300,
});

export const ADVISORY_CONTEXT_TRUST = Object.freeze({
  authority: "ADVISORY",
  evidenceAuthority: "NONE",
  actionability: "NON_EXECUTABLE",
  trustRole: "NON_EVIDENCE_ADVISORY_CONTEXT",
  persisted: false,
});
