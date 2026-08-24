import { canonicalFingerprint } from "./artifacts.js";
import { compareFailureSurface } from "./failure-surface.js";

export function computeStrategyFingerprints(trace) {
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
      semanticFingerprint: entry.interventionSemanticFingerprint ?? null,
      effectiveness,
    });
  }
  return interventions;
}


export function interventionSemanticFingerprintOf(entry) {
  return entry?.interventionSemanticFingerprint
    ?? (entry?.intervention ? canonicalFingerprint(entry.intervention) : null);
}
