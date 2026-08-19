export const POLICY_DIFF_CLASSIFICATIONS = Object.freeze({
  TIGHTEN: "TIGHTEN",
  NEUTRAL: "NEUTRAL",
  WEAKEN: "WEAKEN",
  UNKNOWN: "UNKNOWN",
});

export function diffPolicies(beforePolicy = {}, afterPolicy = {}) {
  const changes = [];
  const beforeRules = new Map((beforePolicy?.rules ?? []).map((r) => [r.id, r]));
  const afterRules = new Map((afterPolicy?.rules ?? []).map((r) => [r.id, r]));

  // Check removed rules
  for (const [id, beforeRule] of beforeRules.entries()) {
    if (!afterRules.has(id)) {
      const isWeakening = beforeRule.blocking || beforeRule.severity === "HIGH";
      changes.push({
        path: `rules.${id}`,
        type: isWeakening ? "WEAKEN" : "NEUTRAL",
        before: beforeRule,
        after: null,
        description: `Rule ${id} was removed`,
      });
    }
  }

  // Check added rules
  for (const [id, afterRule] of afterRules.entries()) {
    if (!beforeRules.has(id)) {
      const isTightening = afterRule.blocking || afterRule.severity === "HIGH";
      changes.push({
        path: `rules.${id}`,
        type: isTightening ? "TIGHTEN" : "NEUTRAL",
        before: null,
        after: afterRule,
        description: `Rule ${id} was added`,
      });
    }
  }

  // Check modified rules
  for (const [id, beforeRule] of beforeRules.entries()) {
    const afterRule = afterRules.get(id);
    if (!afterRule) continue;

    // Check blocking change
    if (beforeRule.blocking !== afterRule.blocking) {
      const isWeakening = beforeRule.blocking && !afterRule.blocking;
      changes.push({
        path: `rules.${id}.blocking`,
        type: isWeakening ? "WEAKEN" : "TIGHTEN",
        before: beforeRule.blocking,
        after: afterRule.blocking,
        description: isWeakening ? `Rule ${id} was changed from blocking to advisory` : `Rule ${id} was changed to blocking`,
      });
    }

    // Check threshold change
    const beforeThreshold = beforeRule.check?.threshold ?? beforeRule.parameters?.threshold;
    const afterThreshold = afterRule.check?.threshold ?? afterRule.parameters?.threshold;
    if (beforeThreshold !== undefined && afterThreshold !== undefined && beforeThreshold !== afterThreshold) {
      const isWeakening = afterThreshold > beforeThreshold;
      changes.push({
        path: `rules.${id}.threshold`,
        type: isWeakening ? "WEAKEN" : "TIGHTEN",
        before: beforeThreshold,
        after: afterThreshold,
        description: `Threshold for ${id} changed from ${beforeThreshold} to ${afterThreshold}`,
      });
    }
  }

  // Check baseline changes
  const beforeBaseline = new Map((beforePolicy?.baseline?.entries ?? []).map((e) => [e.ruleId, new Set(e.fingerprints)]));
  const afterBaseline = new Map((afterPolicy?.baseline?.entries ?? []).map((e) => [e.ruleId, new Set(e.fingerprints)]));

  for (const [ruleId, afterFpSet] of afterBaseline.entries()) {
    const beforeFpSet = beforeBaseline.get(ruleId) ?? new Set();
    const addedFps = [...afterFpSet].filter((fp) => !beforeFpSet.has(fp));
    if (addedFps.length > 0) {
      changes.push({
        path: `baseline.${ruleId}`,
        type: "WEAKEN",
        before: beforeFpSet.size,
        after: afterFpSet.size,
        description: `Added ${addedFps.length} new violations to baseline for rule ${ruleId}`,
      });
    }
  }

  for (const [ruleId, beforeFpSet] of beforeBaseline.entries()) {
    const afterFpSet = afterBaseline.get(ruleId) ?? new Set();
    const removedFps = [...beforeFpSet].filter((fp) => !afterFpSet.has(fp));
    if (removedFps.length > 0) {
      changes.push({
        path: `baseline.${ruleId}`,
        type: "TIGHTEN",
        before: beforeFpSet.size,
        after: afterFpSet.size,
        description: `Resolved and removed ${removedFps.length} baseline violations for rule ${ruleId}`,
      });
    }
  }

  let classification = POLICY_DIFF_CLASSIFICATIONS.NEUTRAL;
  if (changes.some((c) => c.type === "WEAKEN")) {
    classification = POLICY_DIFF_CLASSIFICATIONS.WEAKEN;
  } else if (changes.some((c) => c.type === "TIGHTEN")) {
    classification = POLICY_DIFF_CLASSIFICATIONS.TIGHTEN;
  }

  return {
    classification,
    changes,
  };
}
