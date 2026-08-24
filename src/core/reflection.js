import { buildTaskTrace } from "./trace.js";
import { compareFailureSurface } from "./failure-surface.js";

export const REFLECTION_STATUS = Object.freeze({
  ADVANCING: "ADVANCING",
  WATCH: "WATCH",
  STALLED: "STALLED",
});

function informationGainDimensions(previousCase, currentCase) {
  const dimensions = {
    newObservation: !(previousCase && (currentCase.observations ?? []).every((o) =>
      (previousCase.observations ?? []).some((p) => JSON.stringify(p.statement ?? "") === JSON.stringify(o.statement ?? "")))),
    newContributor: !(previousCase && (currentCase.contributors ?? []).every((c) =>
      (previousCase.contributors ?? []).some((p) => p.statement === c.statement))),
    newHypothesis: !(previousCase && (currentCase.hypotheses ?? []).every((h) =>
      (previousCase.hypotheses ?? []).some((p) => p.statement === h.statement))),
    hypothesisDispositionChanged: false,
    failureSignatureChanged: false,
    failureSurfaceChanged: false,
    interventionChanged: false,
  };
  return dimensions;
}

function strategyFingerprints(trace) {
  const byCycle = new Map();
  const add = (cycle, component, fingerprint) => {
    if (!byCycle.has(cycle)) byCycle.set(cycle, { hypotheses: new Set(), contributors: new Set(), interventions: new Set() });
    byCycle.get(cycle)[component].add(fingerprint);
  };
  for (const diagnosticCase of trace.diagnostics.cases) {
    for (const hypothesis of diagnosticCase.hypotheses ?? []) {
      add(diagnosticCase.verificationCycle, "hypotheses", `${hypothesis.statement}`.trim().toLowerCase());
    }
    for (const contributor of diagnosticCase.contributors ?? []) {
      add(diagnosticCase.verificationCycle, "contributors", `${contributor.statement}`.trim().toLowerCase());
    }
  }
  for (const legacy of trace.diagnostics.legacyDiagnoses) {
    add(legacy.verificationCycle, "hypotheses", `${legacy.hypothesis}`.trim().toLowerCase());
  }
  for (const intervention of trace.diagnostics.interventions) {
    add(intervention.verificationCycle, "interventions", intervention.interventionSemanticFingerprint ?? `${intervention.intervention?.statement ?? ""}`.trim().toLowerCase());
  }

  return [...byCycle.entries()]
    .sort(([a], [b]) => a - b)
    .map(([cycle, components]) => ({
      verificationCycle: cycle,
      strategyFingerprint: JSON.stringify([
        [...components.hypotheses].sort(),
        [...components.contributors].sort(),
        [...components.interventions].sort(),
      ]),
      components: {
        hypotheses: [...components.hypotheses].sort(),
        contributors: [...components.contributors].sort(),
        interventions: [...components.interventions].sort(),
      },
    }));
}

export function detectOscillation(strategies) {
  const fingerprints = strategies.map((strategy) => strategy.strategyFingerprint);
  const patterns = [];
  for (let i = 2; i < fingerprints.length; i++) {
    if (fingerprints[i] === fingerprints[i - 2] && fingerprints[i] !== fingerprints[i - 1]) {
      patterns.push({ kind: "A_B_A", cycles: [strategies[i - 2].verificationCycle, strategies[i - 1].verificationCycle, strategies[i].verificationCycle] });
    }
  }
  for (let i = 3; i < fingerprints.length; i++) {
    if (fingerprints[i] === fingerprints[i - 2]
      && fingerprints[i - 1] === fingerprints[i - 3]
      && fingerprints[i] !== fingerprints[i - 1]) {
      patterns.push({ kind: "A_B_A_B", cycles: [strategies[i - 3].verificationCycle, strategies[i - 2].verificationCycle, strategies[i - 1].verificationCycle, strategies[i].verificationCycle] });
    }
  }
  const detected = patterns.length > 0;
  return { detected, patterns };
}

export function summarizeHypotheses(trace) {
  const summary = { created: 0, supported: 0, weakened: 0, falsified: 0, superseded: 0, unresolved: 0, open: 0 };
  const seen = new Set();
  for (const diagnosticCase of trace.diagnostics.cases) {
    for (const hypothesis of diagnosticCase.hypotheses ?? []) {
      if (!seen.has(hypothesis.id)) {
        seen.add(hypothesis.id);
        summary.created += 1;
        summary.open += 1;
      }
    }
  }
  if (trace.diagnostics.legacyDiagnoses.length > 0) {
    summary.created += trace.diagnostics.legacyDiagnoses.length;
    summary.open += trace.diagnostics.legacyDiagnoses.length;
  }
  for (const disposition of trace.diagnostics.dispositions) {
    const key = disposition.hypothesisRef;
    if (!seen.has(key)) continue;
    if (summary[disposition.status.toLowerCase()] !== undefined) {
      if (summary.open > 0) summary.open -= 1;
      summary[disposition.status.toLowerCase()] += 1;
    }
  }
  return summary;
}

export function evaluateInterventionEffectiveness(trace, surfacesByCycle) {
  const interventions = [];
  const list = trace.diagnostics.interventions;
  for (const [index, entry] of list.entries()) {
    const cycle = entry.verificationCycle;
    const subsequent = list.slice(index + 1).find((candidate) => candidate.verificationCycle >= cycle);
    const laterVerificationCycles = Object.keys(surfacesByCycle).map(Number).filter((value) => value > cycle);
    const nextCycle = laterVerificationCycles.length > 0 ? Math.min(...laterVerificationCycles) : null;

    let effectiveness = "PENDING";
    if (nextCycle !== null) {
      const previousSurface = surfacesByCycle[cycle]?.surface ?? [];
      const currentSurface = surfacesByCycle[nextCycle]?.surface ?? [];
      const comparison = compareFailureSurface(previousSurface, currentSurface);
      const signatureChanged = JSON.stringify(surfacesByCycle[cycle]?.signatures ?? []) !== JSON.stringify(surfacesByCycle[nextCycle]?.signatures ?? []);
      if (comparison.direction === "REDUCED") effectiveness = "IMPROVED";
      else if (comparison.direction === "EXPANDED") effectiveness = "REGRESSED";
      else if (signatureChanged || comparison.changed) effectiveness = "INFORMATIVE";
      else effectiveness = "NON_INFORMATIVE";
    }
    void subsequent;
    interventions.push({
      id: entry.intervention?.id ?? null,
      sequence: entry.sequence,
      verificationCycle: cycle,
      kind: entry.intervention?.kind ?? null,
      reversible: entry.intervention?.reversible ?? null,
      effectiveness,
    });
  }
  return interventions;
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

  const latestCase = taskEvents.findLast((event) => event.event === "DIAGNOSTIC_CASE_RECORDED");
  const dispositionedRefs = new Set(
    taskEvents.filter((event) => event.event === "HYPOTHESIS_DISPOSITION_RECORDED")
      .map((event) => event.details?.hypothesisRef),
  );
  const openHypotheses = (latestCase?.details?.hypotheses ?? [])
    .filter((hypothesis) => !dispositionedRefs.has(hypothesis.id))
    .map((hypothesis) => hypothesis.id);

  const interventions = taskEvents.filter((event) => event.event === "INTERVENTION_RECORDED");
  const latestIntervention = interventions.at(-1)?.details?.intervention?.id ?? null;

  const fingerprintCounts = new Map();
  for (const event of interventions) {
    const fingerprint = event.details?.interventionSemanticFingerprint;
    if (!fingerprint) continue;
    fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) ?? 0) + 1);
  }
  const doNotRepeat = [...fingerprintCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([fingerprint]) => fingerprint)
    .sort();

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

  const failureSurfaces = [];
  const surfaceEntries = {};
  const cycles = [...new Set([
    ...trace.checks.flatMap((check) => check.attempts.map((attempt) => attempt.verificationCycle).filter(Boolean)),
    ...trace.diagnostics.cases.map((diagnosticCase) => diagnosticCase.verificationCycle),
  ])].sort((a, b) => a - b);

  for (const cycle of cycles) {
    const failedRequirements = new Set();
    for (const check of trace.checks) {
      for (const attempt of check.attempts) {
        if ((attempt.status === "failed" || attempt.status === "blocked") && attempt.verificationCycle === cycle) {
          failedRequirements.add(check.requirement ?? check.id);
        }
      }
    }
    const surface = [...failedRequirements].sort();
    const cycleSignatures = [];
    failureSurfaces.push({ verificationCycle: cycle, surface, size: surface.length });
    surfaceEntries[cycle] = { surface, signatures: cycleSignatures };
  }

  const strategies = strategyFingerprints(trace);
  const oscillation = detectOscillation(strategies);

  const signals = [];
  let status = REFLECTION_STATUS.ADVANCING;

  const repeatedNonInformative = evaluateInterventionEffectiveness(trace, surfaceEntries)
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
    failureSurfaces,
    hypotheses: summarizeHypotheses(trace),
    interventions: (() => {
      const evaluated = evaluateInterventionEffectiveness(trace, surfaceEntries);
      return {
        count: evaluated.length,
        informative: evaluated.filter((intervention) => ["INFORMATIVE", "IMPROVED"].includes(intervention.effectiveness)).length,
        nonInformative: evaluated.filter((intervention) => intervention.effectiveness === "NON_INFORMATIVE").length,
        details: evaluated,
      };
    })(),
    informationGain: {
      cyclesWithCases: trace.diagnostics.cases.map((diagnosticCase) => diagnosticCase.verificationCycle),
      cyclesWithoutEffectiveGain: [],
    },
    strategies,
    oscillation,
    signals,
    recommendedProtocolAction,
  };
}

export { informationGainDimensions, strategyFingerprints as computeStrategyFingerprints };
