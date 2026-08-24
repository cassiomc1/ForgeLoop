export const GAIN_DIMENSIONS = Object.freeze([
  "newObservation",
  "newContributor",
  "newHypothesis",
  "hypothesisDispositionChanged",
  "failureSignatureChanged",
  "failureSurfaceChanged",
  "interventionChanged",
  "strategyChanged",
  "newEvidence",
  "hypothesisEliminated",
]);

function statementSet(values) {
  return new Set((values ?? []).map((value) => `${value}`.trim().toLowerCase()).filter(Boolean));
}

export function normalizeDiagnosticSnapshot(input) {
  // Idempotent: already-normalized snapshots pass through unchanged so
  // repeated normalization never fabricates empty semantic sets.
  if (input
    && input.observationStatements instanceof Set
    && input.contributorStatements instanceof Set
    && input.hypothesisStatements instanceof Set
    && input.evidenceRefs instanceof Set) {
    return input;
  }
  if (!input) {
    return {
      observationStatements: new Set(),
      contributorStatements: new Set(),
      hypothesisStatements: new Set(),
      evidenceRefs: new Set(),
    };
  }
  const legacyHypothesis = input.legacy
    ? [input.hypothesis ?? ""]
    : (input.hypotheses ?? []).map((hypothesis) => hypothesis.statement ?? "");
  const evidenceRefs = input.legacy
    ? (input.evidenceRefs ?? [])
    : [
        ...(input.hypotheses ?? []).flatMap((hypothesis) => hypothesis.evidenceRefs ?? []),
        ...(input.observations ?? []).map((observation) => observation.evidenceRef).filter(Boolean),
      ];
  return {
    observationStatements: statementSet(input.legacy ? [] : (input.observations ?? []).map((observation) => observation.statement)),
    contributorStatements: statementSet(input.legacy ? [] : (input.contributors ?? []).map((contributor) => contributor.statement)),
    hypothesisStatements: statementSet(legacyHypothesis),
    evidenceRefs: statementSet(evidenceRefs),
    hypothesisIds: new Set(input.legacy ? [] : (input.hypotheses ?? []).map((hypothesis) => hypothesis.id)),
  };
}

function hasNewValue(previousSet, currentSet) {
  for (const value of currentSet) {
    if (!previousSet.has(value)) return true;
  }
  return false;
}

export function compareDiagnosticCycles(previousInput, currentInput, context = {}) {
  const previous = previousInput instanceof Set || Array.isArray(previousInput)
    ? normalizeDiagnosticSnapshot(null)
    : normalizeDiagnosticSnapshot(previousInput);
  const current = normalizeDiagnosticSnapshot(currentInput);

  const dimensions = {
    newObservation: hasNewValue(previous.observationStatements, current.observationStatements),
    newContributor: hasNewValue(previous.contributorStatements, current.contributorStatements),
    newHypothesis: hasNewValue(previous.hypothesisStatements, current.hypothesisStatements),
    hypothesisDispositionChanged: Boolean(context.hypothesisDispositionChanged),
    failureSignatureChanged: Boolean(context.failureSignatureChanged),
    failureSurfaceChanged: Boolean(context.failureSurfaceChanged),
    interventionChanged: Boolean(context.interventionChanged),
    strategyChanged: Boolean(context.strategyChanged),
    newEvidence: hasNewValue(previous.evidenceRefs, current.evidenceRefs),
    // Elimination is decided semantically by the cycle analysis projection:
    // an id disappearing while its statement survives is ID-only churn, not gain.
    hypothesisEliminated: Boolean(context.hypothesisEliminated),
  };
  return dimensions;
}

const CLASSIFICATION = Object.freeze({
  FIRST_DIAGNOSIS: "FIRST_DIAGNOSIS",
  NEW_HYPOTHESIS: "NEW_HYPOTHESIS",
  NEW_EVIDENCE: "NEW_EVIDENCE",
  NEW_HYPOTHESIS_AND_EVIDENCE: "NEW_HYPOTHESIS_AND_EVIDENCE",
  NONE: "NONE",
});

export function classifyGain(dimensions, { first = false } = {}) {
  if (first) return CLASSIFICATION.FIRST_DIAGNOSIS;
  const hypothesis = dimensions.newHypothesis;
  const evidence = dimensions.newEvidence;
  if (hypothesis && evidence) return CLASSIFICATION.NEW_HYPOTHESIS_AND_EVIDENCE;
  if (hypothesis) return CLASSIFICATION.NEW_HYPOTHESIS;
  if (evidence) return CLASSIFICATION.NEW_EVIDENCE;
  return CLASSIFICATION.NONE;
}

export function isEffectiveGain(dimensions, classification) {
  if (classification !== CLASSIFICATION.NONE) return true;

  // Every meaningful semantic dimension counts as effective gain.
  // newHypothesis and newEvidence remain covered by the compatibility
  // classification above; the remaining dimensions are checked explicitly.
  return Boolean(
    dimensions.newObservation
    || dimensions.newContributor
    || dimensions.hypothesisDispositionChanged
    || dimensions.failureSignatureChanged
    || dimensions.failureSurfaceChanged
    || dimensions.interventionChanged
    || dimensions.strategyChanged
    || dimensions.hypothesisEliminated
  );
}

export function computeInformationGain(entries) {
  const results = [];
  let previous = null;
  let seenFirst = false;
  for (const entry of entries) {
    const dimensions = compareDiagnosticCycles(previous?.snapshot ?? null, entry.snapshot, entry.context ?? {});
    const classification = classifyGain(dimensions, { first: !seenFirst });
    seenFirst = true;
    results.push({
      verificationCycle: entry.verificationCycle,
      sequence: entry.sequence ?? null,
      effectiveGain: isEffectiveGain(dimensions, classification),
      classification,
      dimensions,
    });
    previous = entry;
  }
  return results;
}
