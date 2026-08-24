import { diagnosticEventsForTask } from "./diagnostic-projection.js";
import { normalizeDiagnosticSnapshot, computeInformationGain } from "./information-gain.js";

function snapshotFor(event) {
  const details = event.details ?? {};
  if (event.event === "DIAGNOSTIC_CASE_RECORDED") {
    return normalizeDiagnosticSnapshot({ ...details, legacy: false });
  }
  return normalizeDiagnosticSnapshot({ ...details, legacy: true });
}

export function buildInformationGainProjection(events, taskId) {
  const diagnosticEvents = diagnosticEventsForTask(events, taskId)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  let lastDispositionSeq = -1;
  let lastInterventionSeq = -1;
  const contextByIndex = new Map();
  const entries = [];

  for (const [index, event] of diagnosticEvents.entries()) {
    const context = {
      hypothesisDispositionChanged: lastDispositionSeq > (entries.at(-1)?.sequence ?? -1),
      interventionChanged: lastInterventionSeq > (entries.at(-1)?.sequence ?? -1),
    };
    contextByIndex.set(index, context);
    entries.push({
      verificationCycle: event.details?.verificationCycle ?? null,
      sequence: event.seq ?? null,
      snapshot: snapshotFor(event),
      context,
    });
  }

  for (const event of events.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))) {
    if (taskId && event.taskId && event.taskId !== taskId) continue;
    if (event.event === "HYPOTHESIS_DISPOSITION_RECORDED") lastDispositionSeq = event.seq;
    if (event.event === "INTERVENTION_RECORDED") lastInterventionSeq = event.seq;
  }
  if (lastDispositionSeq >= 0 || lastInterventionSeq >= 0) {
    const lastIndex = entries.length - 1;
    if (lastIndex >= 0) {
      entries[lastIndex].context = {
        ...entries[lastIndex].context,
        hypothesisDispositionChanged: entries[lastIndex].context.hypothesisDispositionChanged
          || lastDispositionSeq > entries[lastIndex].sequence,
        interventionChanged: entries[lastIndex].context.interventionChanged
          || lastInterventionSeq > entries[lastIndex].sequence,
      };
    }
  }

  return computeInformationGain(entries);
}

export function computeCycleInformationGain(events, taskId, verificationCycle) {
  const projection = buildInformationGainProjection(events, taskId);
  const matching = projection.filter((entry) => entry.verificationCycle === verificationCycle);
  return matching.at(-1) ?? null;
}
