import { diagnosticEventsForTask } from "./diagnostic-projection.js";
import { normalizeDiagnosticSnapshot, computeInformationGain } from "./information-gain.js";
import { computeFailureSignature } from "./failure-signature.js";

function snapshotFor(event) {
  const details = event.details ?? {};
  if (event.event === "DIAGNOSTIC_CASE_RECORDED") {
    return normalizeDiagnosticSnapshot({ ...details, legacy: false });
  }
  return normalizeDiagnosticSnapshot({ ...details, legacy: true });
}

const sameSortedSet = (a, b) =>
  JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

// Cycle interval rule (documented contract):
//   For diagnostic event D[n], the analysis interval is
//   (D[n-1].sequence, D[n].sequence] — previous diagnostic sequence exclusive,
//   current diagnostic sequence inclusive.
// Events inside an interval belong to the *current* cycle's knowledge state;
// they are never attributed retroactively to the earlier diagnosis.
function intervalEvents(taskEvents, fromExclusive, toInclusive) {
  return taskEvents.filter((event) =>
    event.seq > fromExclusive && event.seq <= toInclusive);
}

function failureStateByCycle(taskEvents) {
  const surfaces = new Map();
  const signatures = new Map();
  const record = (cycle, details) => {
    if (!Number.isInteger(cycle)) cycle = Number(cycle) || 1;
    if (!surfaces.has(cycle)) surfaces.set(cycle, new Set());
    if (!signatures.has(cycle)) signatures.set(cycle, new Set());
    const requirement = details.requirement ?? details.id ?? details.checkId;
    if (!requirement) return;
    if (details.status === "failed" || details.status === "blocked") {
      surfaces.get(cycle).add(requirement);
      signatures.get(cycle).add(computeFailureSignature({
        requirement,
        status: details.status,
        exitCode: Number.isInteger(details.exitCode) ? details.exitCode : null,
        failureToken: typeof details.failureToken === "string" ? details.failureToken : (typeof details.details?.failureToken === "string" ? details.details.failureToken : null),
      }));
    }
  };
  for (const event of taskEvents) {
    if (event.event === "VERIFICATION_STARTED") {
      const cycle = event.details?.verificationCycle;
      if (Number.isInteger(cycle)) {
        if (!surfaces.has(cycle)) surfaces.set(cycle, new Set());
        if (!signatures.has(cycle)) signatures.set(cycle, new Set());
      }
    }
    if (event.event === "VERIFICATION_RECORDED") {
      record(event.details?.verificationCycle ?? 1, event.details ?? {});
    }
  }
  return { surfaces, signatures };
}

function interventionFingerprintsBySeq(taskEvents) {
  return taskEvents
    .filter((event) => event.event === "INTERVENTION_RECORDED")
    .map((event) => ({
      seq: event.seq,
      cycle: event.details?.verificationCycle,
      fingerprint: event.details?.interventionSemanticFingerprint
        ?? `${event.details?.intervention?.statement ?? ""}`.trim().toLowerCase(),
    }))
    .filter((entry) => entry.fingerprint);
}

function strategyFingerprintFor(diagnosticEvent, interventionsUpTo) {
  const details = diagnosticEvent?.details ?? {};
  const components = {
    hypotheses: (details.hypotheses ?? []).map((hypothesis) => `${hypothesis.statement}`.trim().toLowerCase()),
    contributors: (details.contributors ?? []).map((contributor) => `${contributor.statement}`.trim().toLowerCase()),
    legacyHypothesis: diagnosticEvent?.event === "DIAGNOSIS_RECORDED"
      ? [`${details.hypothesis ?? ""}`.trim().toLowerCase()]
      : [],
    interventions: interventionsUpTo.map((entry) => entry.fingerprint),
  };
  return JSON.stringify([
    [...components.hypotheses, ...components.legacyHypothesis].sort(),
    components.contributors.sort(),
    components.interventions.sort(),
  ]);
}

export function buildInformationGainProjection(events, taskId) {
  const taskEvents = (events ?? [])
    .filter((event) => !taskId || !event.taskId || event.taskId === taskId)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const diagnosticEvents = diagnosticEventsForTask(taskEvents, taskId)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  if (diagnosticEvents.length === 0) return [];

  const failure = failureStateByCycle(taskEvents);
  const interventionsBySeq = interventionFingerprintsBySeq(taskEvents);

  // Build final per-cycle entries first; effectiveGain is computed once at the
  // end from fully final dimensions (no post-mutation anywhere).
  const built = [];
  let previousDiagnostic = null;
  for (const diagnostic of diagnosticEvents) {
    const intervalStart = previousDiagnostic ? previousDiagnostic.seq : -Infinity;
    const interval = intervalEvents(taskEvents, intervalStart, diagnostic.seq);

    const hypothesisDispositionChanged =
      interval.some((event) => event.event === "HYPOTHESIS_DISPOSITION_RECORDED");

    const cumulativeInterventionsUpTo = (seq) =>
      interventionsBySeq.filter((entry) => entry.seq <= seq);
    const currentInterventions = cumulativeInterventionsUpTo(diagnostic.seq)
      .filter((entry) => !previousDiagnostic || entry.seq > intervalStart);
    void currentInterventions;
    const interventionSetAt = (seq) => new Set(
      cumulativeInterventionsUpTo(seq).map((entry) => entry.fingerprint),
    );
    const interventionChanged = previousDiagnostic
      ? !sameSortedSet(
          [...interventionSetAt(diagnostic.seq)],
          [...interventionSetAt(previousDiagnostic.seq)],
        )
      : false;

    const cycle = diagnostic.details?.verificationCycle ?? 1;
    const previousCycle = previousDiagnostic?.details?.verificationCycle ?? null;
    const surface = [...(failure.surfaces.get(cycle) ?? new Set())].sort();
    const signatures = [...(failure.signatures.get(cycle) ?? new Set())].sort();
    const previousSurface = previousCycle != null
      ? [...(failure.surfaces.get(previousCycle) ?? new Set())].sort()
      : null;
    const previousSignatures = previousCycle != null
      ? [...(failure.signatures.get(previousCycle) ?? new Set())].sort()
      : null;
    const hasPreviousFailureState = previousSurface !== null;
    const failureSurfaceChanged = hasPreviousFailureState
      ? !sameSortedSet(surface, previousSurface)
      : false;
    const failureSignatureChanged = hasPreviousFailureState
      ? !sameSortedSet(signatures, previousSignatures)
      : false;

    const strategyFingerprint = strategyFingerprintFor(diagnostic,
      cumulativeInterventionsUpTo(diagnostic.seq));
    const previousStrategyFingerprint = previousDiagnostic
      ? strategyFingerprintFor(previousDiagnostic,
          cumulativeInterventionsUpTo(previousDiagnostic.seq))
      : null;
    const strategyChanged = Boolean(previousStrategyFingerprint
      && strategyFingerprint !== previousStrategyFingerprint);

    const snapshot = snapshotFor(diagnostic);

    built.push({
      verificationCycle: cycle,
      sequence: diagnostic.seq ?? null,
      diagnosticSequence: diagnostic.seq ?? null,
      sourceModel: diagnostic.event === "DIAGNOSTIC_CASE_RECORDED"
        ? "STRUCTURED_DIAGNOSTIC_CASE_V1"
        : "LEGACY_DIAGNOSIS_V1",
      snapshot,
      dimensionsInput: {
        hypothesisDispositionChanged,
        failureSignatureChanged,
        failureSurfaceChanged,
        interventionChanged,
        strategyChanged,
        hypothesisEliminated: false,
      },
      evidence: {
        semanticRefs: [...(snapshot.evidenceRefs ?? [])].sort(),
        surface, signatures, strategyFingerprint,
      },
    });

    previousDiagnostic = diagnostic;
  }

  // Hypothesis elimination: an id disappearing only counts as elimination when
  // no surviving hypothesis carries the same normalized statement — ID-only
  // churn is artificial novelty and must never create gain.
  for (let i = 1; i < built.length; i++) {
    if (built[i].sourceModel !== "STRUCTURED_DIAGNOSTIC_CASE_V1"
      || built[i - 1].sourceModel !== "STRUCTURED_DIAGNOSTIC_CASE_V1") continue;
    const previousHypotheses = diagnosticEvents[i - 1]?.details?.hypotheses ?? [];
    const currentHypotheses = diagnosticEvents[i]?.details?.hypotheses ?? [];
    const currentStatements = new Set(currentHypotheses.map(
      (hypothesis) => `${hypothesis.statement}`.trim().toLowerCase()));
    built[i].dimensionsInput.hypothesisEliminated = previousHypotheses.some((hypothesis) => {
      const survivedById = currentHypotheses.some((candidate) => candidate.id === hypothesis.id);
      return !survivedById
        && !currentStatements.has(`${hypothesis.statement}`.trim().toLowerCase());
    });
  }

  // Final classification + single-point effectiveGain computation.
  const entries = computeInformationGain(built.map((entry) => ({
    verificationCycle: entry.verificationCycle,
    sequence: entry.sequence,
    snapshot: entry.snapshot,
    context: entry.dimensionsInput,
  })));

  return built.map((entry, index) => {
    const { dimensions, classification, effectiveGain } = entries[index];
    return Object.freeze({
      verificationCycle: entry.verificationCycle,
      sequence: entry.sequence,
      diagnosticSequence: entry.diagnosticSequence,
      sourceModel: entry.sourceModel,
      evidence: Object.freeze({
        semanticRefs: Object.freeze(entry.evidence.semanticRefs),
        failureSurface: Object.freeze(entry.evidence.surface),
        failureSignatures: Object.freeze(entry.evidence.signatures),
        strategyFingerprint: entry.evidence.strategyFingerprint,
      }),
      dimensions: Object.freeze({ ...dimensions }),
      classification,
      effectiveGain,
    });
  });
}

export function computeCycleInformationGain(events, taskId, verificationCycle) {
  const projection = buildInformationGainProjection(events, taskId);
  const matching = projection.filter((entry) => entry.verificationCycle === verificationCycle);
  return matching.at(-1) ?? null;
}
