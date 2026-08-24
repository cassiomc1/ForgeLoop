import { buildTaskTrace } from "./trace.js";
import { readEvents } from "./events.js";
import { projectHypothesisStates } from "./hypothesis-projection.js";
import { buildInformationGainProjection } from "./information-gain-projection.js";
import {
  computeStrategyFingerprints as computeStrategyFingerprintsImpl,
  detectOscillation as detectOscillationImpl,
  evaluateInterventionEffectiveness as evaluateInterventionEffectivenessImpl,
} from "./strategy-analysis.js";

export const REFLECTION_STATUS = Object.freeze({
  ADVANCING: "ADVANCING",
  WATCH: "WATCH",
  STALLED: "STALLED",
});

function informationGainDimensions(previousCase, currentCase, context = {}) {
  const dimensions = {
    newObservation: !(previousCase && (currentCase.observations ?? []).every((o) =>
      (previousCase.observations ?? []).some((p) => JSON.stringify(p.statement ?? "") === JSON.stringify(o.statement ?? "")))),
    newContributor: !(previousCase && (currentCase.contributors ?? []).every((c) =>
      (previousCase.contributors ?? []).some((p) => p.statement === c.statement))),
    newHypothesis: !(previousCase && (currentCase.hypotheses ?? []).every((h) =>
      (previousCase.hypotheses ?? []).some((p) => p.statement === h.statement))),
    hypothesisDispositionChanged: Boolean(context.hypothesisDispositionChanged),
    failureSignatureChanged: Boolean(context.failureSignatureChanged),
    failureSurfaceChanged: Boolean(context.failureSurfaceChanged),
    interventionChanged: Boolean(context.interventionChanged),
  };
  return dimensions;
}

export function summarizeHypotheses(trace) {
  const summary = { created: 0, supported: 0, weakened: 0, falsified: 0, superseded: 0, unresolved: 0, open: 0 };

  const pseudoEvents = [
    ...trace.diagnostics.cases.map((diagnosticCase) => ({
      seq: diagnosticCase.sequence,
      event: "DIAGNOSTIC_CASE_RECORDED",
      details: diagnosticCase,
    })),
    ...trace.diagnostics.legacyDiagnoses.map((legacy) => ({
      seq: legacy.sequence,
      event: "DIAGNOSIS_RECORDED",
      details: legacy,
    })),
    ...trace.diagnostics.dispositions.map((disposition) => ({
      seq: disposition.sequence,
      event: "HYPOTHESIS_DISPOSITION_RECORDED",
      details: disposition,
    })),
  ];
  const projection = projectHypothesisStates(pseudoEvents);

  for (const hypothesis of projection.hypotheses) {
    if (hypothesis.id === "h-legacy" && hypothesis.sourceEventSeq !== null) {
      summary.created += 1;
    } else if (hypothesis.id !== "h-legacy") {
      summary.created += 1;
    }
    const status = hypothesis.currentStatus.toLowerCase();
    if (summary[status] !== undefined) summary[status] += 1;
  }
  summary.open = projection.openHypotheses.length;
  return summary;
}

export function detectOscillation(strategies) {
  return detectOscillationImpl(strategies);
}

export function evaluateInterventionEffectiveness(trace, surfacesByCycle) {
  return evaluateInterventionEffectivenessImpl(trace, surfacesByCycle);
}

function failedRequirementSurfacesFromEvents(events = [], state = null) {
  const byCycle = new Map();
  const record = (cycle, requirement) => {
    if (!requirement) return;
    if (!byCycle.has(cycle)) byCycle.set(cycle, new Set());
    byCycle.get(cycle).add(requirement);
  };
  for (const event of events) {
    if (event.event !== "VERIFICATION_RECORDED") continue;
    const d = event.details ?? {};
    if (d.status === "failed" || d.status === "blocked") {
      record(d.verificationCycle ?? 1, d.requirement ?? d.id ?? d.checkId);
    }
  }
  for (const check of state?.checks ?? []) {
    if (check.status !== "failed" && check.status !== "blocked") continue;
    record(check.details?.verificationCycle ?? state?.verificationCycle ?? 1, check.requirement ?? check.id ?? check.checkId);
  }
  return byCycle;
}

function signatureSetsByCycle(trace) {
  const byCycle = new Map();
  for (const entry of trace.failureSignatures) {
    for (const cycle of entry.cycles ?? []) {
      if (!byCycle.has(cycle)) byCycle.set(cycle, new Set());
      byCycle.get(cycle).add(entry.signature);
    }
  }
  return byCycle;
}

export function deriveDiagnosticContext(events = [], state = null) {
  const cycle = state?.verificationCycle ?? null;
  const taskEvents = events.filter((event) => !state?.taskId || event.taskId === state.taskId);

  const activeFailureSignatures = [...new Set(
    taskEvents
      .filter((event) => event.event === "VERIFICATION_RECORDED"
        && ["failed", "blocked"].includes(event.details?.status)
        && (cycle === null || event.details?.verificationCycle === cycle))
      .map((event) => event.details?.requirement ?? event.details?.id ?? event.details?.checkId)
      .filter(Boolean),
  )].sort();

  const projection = projectHypothesisStates(taskEvents);
  const openHypotheses = [...projection.openHypotheses].sort();

  const interventions = taskEvents.filter((event) => event.event === "INTERVENTION_RECORDED");
  const latestIntervention = interventions.at(-1)?.details?.intervention?.id ?? null;

  // doNotRepeat requires semantic repetition AND at least two completed
  // post-intervention verification cycles AND unchanged failure surface.
  const surfacesByCycle = failedRequirementSurfacesFromEvents(taskEvents, state);
  const completedCycles = [...new Set(
    taskEvents.filter((event) => event.event === "VERIFICATION_STARTED")
      .map((event) => event.details?.verificationCycle)
      .filter(Number.isInteger),
  )].sort((a, b) => a - b);

  const fingerprintGroups = new Map();
  for (const event of interventions) {
    const fingerprint = event.details?.interventionSemanticFingerprint;
    if (!fingerprint) continue;
    if (!fingerprintGroups.has(fingerprint)) fingerprintGroups.set(fingerprint, []);
    fingerprintGroups.get(fingerprint).push(event);
  }

  const doNotRepeat = [];
  for (const [fingerprint, group] of fingerprintGroups.entries()) {
    if (group.length < 2) continue;
    const lastInterventionCycle = Math.max(...group.map((event) => event.details?.verificationCycle ?? 1));
    const postCycles = completedCycles.filter((completed) => completed > lastInterventionCycle);
    if (postCycles.length < 2) continue;
    const firstSurface = [...(surfacesByCycle.get(lastInterventionCycle) ?? [])].sort();
    const latestSurface = [...(surfacesByCycle.get(postCycles.at(-1)) ?? [])].sort();
    if (JSON.stringify(firstSurface) === JSON.stringify(latestSurface)) {
      doNotRepeat.push(fingerprint);
    }
  }
  doNotRepeat.sort();

  return {
    activeFailureSignatures,
    openHypotheses,
    latestIntervention,
    nextExperiment: null,
    doNotRepeat,
  };
}

export async function buildTaskReflection({ target, packageRoot, taskId = null } = {}) {
  const trace = await buildTaskTrace({ target, packageRoot, taskId });
  const rawEvents = await readEvents(target, packageRoot, { taskId });

  // Authoritative surfaces come from the canonical trace projection.
  const surfaceEntries = {};
  for (const entry of trace.failureSurfaces) {
    surfaceEntries[entry.verificationCycle] = { surface: entry.surface, signatures: [] };
  }
  const signatureSets = signatureSetsByCycle(trace);
  for (const [cycle, signatures] of signatureSets.entries()) {
    if (!surfaceEntries[cycle]) surfaceEntries[cycle] = { surface: [], signatures: [] };
    surfaceEntries[cycle].signatures = [...signatures].sort();
  }

  const cycles = [...new Set([
    ...trace.failureSurfaces.map((entry) => entry.verificationCycle),
    ...trace.diagnostics.cases.map((diagnosticCase) => diagnosticCase.verificationCycle),
  ])].sort((a, b) => a - b);

  const strategies = computeStrategyFingerprintsImpl(trace);
  const oscillation = detectOscillation(strategies);

  const signals = [];
  let status = REFLECTION_STATUS.ADVANCING;

  const evaluatedInterventions = evaluateInterventionEffectiveness(trace, surfaceEntries);
  const repeatedNonInformative = evaluatedInterventions
    .filter((intervention) => intervention.effectiveness === "NON_INFORMATIVE");
  if (oscillation.detected) {
    signals.push("OSCILLATING_STRATEGY");
    status = REFLECTION_STATUS.WATCH;
  }
  if (repeatedNonInformative.length >= 2) {
    signals.push("REPEATED_INTERVENTION");
    status = REFLECTION_STATUS.WATCH;
  }

  const lastTwoSameStrategy = strategies.length >= 2
    && strategies.at(-1).strategyFingerprint === strategies.at(-2).strategyFingerprint
    && JSON.stringify(surfaceEntries[strategies.at(-1)?.verificationCycle]?.signatures ?? [])
      === JSON.stringify(surfaceEntries[strategies.at(-2)?.verificationCycle]?.signatures ?? []);
  if (lastTwoSameStrategy && !signals.includes("OSCILLATING_STRATEGY")) {
    status = status === REFLECTION_STATUS.ADVANCING ? REFLECTION_STATUS.WATCH : status;
  }

  // Information Gain v2: one authoritative per-cycle gain projection.
  const gainProjection = buildInformationGainProjection(rawEvents, taskId ?? null);
  for (let i = 1; i < gainProjection.length; i++) {
    const currentCycle = gainProjection[i].verificationCycle;
    const previousCycle = gainProjection[i - 1].verificationCycle;
    gainProjection[i].dimensions.interventionChanged = Boolean(
      gainProjection[i].dimensions.interventionChanged
      || trace.diagnostics.interventions.some((intervention) => intervention.verificationCycle === currentCycle),
    );
    gainProjection[i].dimensions.failureSurfaceChanged = Boolean(
      gainProjection[i].dimensions.failureSurfaceChanged
      || JSON.stringify(surfaceEntries[currentCycle]?.surface ?? [])
        !== JSON.stringify(surfaceEntries[previousCycle]?.surface ?? []),
    );
    gainProjection[i].dimensions.failureSignatureChanged = Boolean(
      gainProjection[i].dimensions.failureSignatureChanged
      || JSON.stringify(surfaceEntries[currentCycle]?.signatures ?? [])
        !== JSON.stringify(surfaceEntries[previousCycle]?.signatures ?? []),
    );
    const currentStrategy = strategies.find((strategy) => strategy.verificationCycle === currentCycle);
    const previousStrategy = strategies.find((strategy) => strategy.verificationCycle === previousCycle);
    if (currentStrategy && previousStrategy) {
      gainProjection[i].dimensions.strategyChanged = currentStrategy.strategyFingerprint !== previousStrategy.strategyFingerprint;
    }
  }
  const cyclesWithoutEffectiveGain = gainProjection
    .filter((entry) => !entry.effectiveGain)
    .map((entry) => entry.verificationCycle);

  const lastTwoIneffective = gainProjection.length >= 2
    && !gainProjection.at(-1).effectiveGain
    && !gainProjection.at(-2).effectiveGain
    && strategies.length >= 2
    && strategies.at(-1).strategyFingerprint === strategies.at(-2).strategyFingerprint;
  if (lastTwoIneffective) {
    status = REFLECTION_STATUS.STALLED;
    if (!signals.includes("NO_EFFECTIVE_INFORMATION_GAIN")) signals.push("NO_EFFECTIVE_INFORMATION_GAIN");
  }

  const recommendedProtocolAction = oscillation.detected
    ? "INTRODUCE_NEW_OBSERVATION"
    : (status === REFLECTION_STATUS.STALLED ? "REQUIRE_NEW_DIAGNOSTIC_INFORMATION" : "CONTINUE");

  return {
    schemaVersion: 1,
    command: "reflect",
    taskId: trace.task.id,
    taskPhase: trace.task.phase,
    integrityValid: trace.integrity.valid,
    snapshotConsistent: trace.snapshot.consistent,
    status,
    verificationCycles: cycles.length,
    failureSurfaces: trace.failureSurfaces,
    hypotheses: summarizeHypotheses(trace),
    interventions: (() => {
      const evaluated = evaluatedInterventions;
      return {
        count: evaluated.length,
        informative: evaluated.filter((intervention) => ["INFORMATIVE", "IMPROVED"].includes(intervention.effectiveness)).length,
        nonInformative: evaluated.filter((intervention) => intervention.effectiveness === "NON_INFORMATIVE").length,
        details: evaluated,
      };
    })(),
    informationGain: {
      cyclesWithCases: trace.diagnostics.cases.map((diagnosticCase) => diagnosticCase.verificationCycle),
      cyclesWithoutEffectiveGain,
      cycles: gainProjection.map(({ dimensions, ...rest }) => ({ ...rest, dimensions })),
    },
    strategies,
    oscillation,
    signals,
    recommendedProtocolAction,
  };
}

export { informationGainDimensions, computeStrategyFingerprintsImpl as computeStrategyFingerprints };
