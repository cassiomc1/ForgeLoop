export function diagnosticEventsForTask(events, taskId) {
  return (events ?? []).filter((event) =>
    (event.event === "DIAGNOSTIC_CASE_RECORDED" || event.event === "DIAGNOSIS_RECORDED")
    && (!taskId || event.taskId === taskId));
}

function structuredProjection(event) {
  const details = event.details ?? {};
  return {
    sourceModel: "STRUCTURED_DIAGNOSTIC_CASE_V1",
    event,
    details,
    diagnosticCase: details,
    informationGain: details.informationGain ?? null,
  };
}

function legacyProjection(event) {
  const details = event.details ?? {};
  return {
    sourceModel: "LEGACY_DIAGNOSIS_V1",
    event,
    details,
    diagnosticCase: null,
    informationGain: details.informationGain ?? null,
  };
}

export function resolveCurrentCycleDiagnostic(events, taskId, verificationCycle) {
  const candidates = diagnosticEventsForTask(events, taskId)
    .filter((event) => {
      const cycle = event.details?.verificationCycle;
      return verificationCycle == null || cycle == null || cycle === verificationCycle;
    })
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const structured = [...candidates].reverse().find((event) => event.event === "DIAGNOSTIC_CASE_RECORDED");
  if (structured) return structuredProjection(structured);

  const legacy = [...candidates].reverse().find((event) => event.event === "DIAGNOSIS_RECORDED");
  if (legacy) return legacyProjection(legacy);

  return null;
}

export function projectDiagnosticCases(events, taskId) {
  return diagnosticEventsForTask(events, taskId)
    .filter((event) => event.event === "DIAGNOSTIC_CASE_RECORDED")
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((event) => ({ sequence: event.seq, at: event.at, ...event.details }));
}
