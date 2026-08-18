import { diagnosisEventsForTask } from "./diagnosis-model.js";

export const PROGRESS_STATUS = Object.freeze({
  ADVANCING: "ADVANCING",
  WATCH: "WATCH",
  STALLED: "STALLED",
});

export const PROGRESS_SIGNAL = Object.freeze({
  NO_DIAGNOSTIC_INFORMATION_GAIN: "NO_DIAGNOSTIC_INFORMATION_GAIN",
  REPEATED_FAILED_REQUIREMENT: "REPEATED_FAILED_REQUIREMENT",
  REPEATED_FAILURE_WITH_SAME_DIAGNOSIS: "REPEATED_FAILURE_WITH_SAME_DIAGNOSIS",
  HIGH_CORRECTION_CYCLE_COUNT: "HIGH_CORRECTION_CYCLE_COUNT",
});

export function diagnosisRequirements(diagnosis, checksById) {
  if (!diagnosis) return [];
  return [...new Set(
    (diagnosis.evidenceRefs ?? [])
      .map((id) => checksById.get(id)?.requirement)
      .filter(Boolean),
  )].sort();
}

export function evaluateProgress({ state, events = [] } = {}) {
  const signals = [];
  let status = PROGRESS_STATUS.ADVANCING;

  if (!state) {
    return { status, signals };
  }

  const taskEvents = Array.isArray(events) ? events.filter((e) => !state.taskId || e.taskId === state.taskId) : [];
  const diagEvents = diagnosisEventsForTask(taskEvents, state.taskId);
  const latestDiag = diagEvents.at(-1)?.details ?? null;

  // Build checksById index for resolving requirement from check IDs
  const checksById = new Map();
  for (const check of state.checks ?? []) {
    if (check.id) checksById.set(check.id, check);
    if (check.checkId) checksById.set(check.checkId, check);
  }
  for (const event of taskEvents) {
    if (event.event === "VERIFICATION_RECORDED" && event.details) {
      if (event.details.id) checksById.set(event.details.id, event.details);
      if (event.details.checkId) checksById.set(event.details.checkId, event.details);
    }
  }

  // 1. Check if latest diagnosis has NO information gain (global stall)
  if (latestDiag && latestDiag.informationGain === "NONE") {
    status = PROGRESS_STATUS.STALLED;
    signals.push({
      code: PROGRESS_SIGNAL.NO_DIAGNOSTIC_INFORMATION_GAIN,
      severity: "BLOCKING_FOR_RETRY",
      message: "Latest diagnosis repeats the prior hypothesis with the same evidence.",
      verificationCycles: [latestDiag.verificationCycle],
    });
  }

  // 2. Track failed requirements across distinct verification cycles
  const reqCycles = new Map();
  const checks = state.checks ?? [];
  for (const check of checks) {
    if (check.status === "failed" || check.status === "blocked") {
      const cycle = check.details?.verificationCycle ?? state.verificationCycle ?? 1;
      const req = check.requirement ?? "default";
      if (!reqCycles.has(req)) reqCycles.set(req, new Set());
      reqCycles.get(req).add(cycle);
    }
  }

  // Also extract from VERIFICATION_RECORDED events
  for (const event of taskEvents) {
    if (event.event === "VERIFICATION_RECORDED") {
      const details = event.details ?? {};
      if (details.status === "failed" || details.status === "blocked") {
        const cycle = details.verificationCycle ?? 1;
        const req = details.requirement ?? "default";
        if (!reqCycles.has(req)) reqCycles.set(req, new Set());
        reqCycles.get(req).add(cycle);
      }
    }
  }

  const latestDiagReqs = diagnosisRequirements(latestDiag, checksById);

  for (const [req, cyclesSet] of [...reqCycles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (cyclesSet.size >= 3) {
      const sortedCycles = [...cyclesSet].sort((a, b) => a - b);
      const isLatestStalledForThisReq = latestDiag && latestDiag.informationGain === "NONE" && latestDiagReqs.includes(req);
      if (isLatestStalledForThisReq) {
        if (!signals.some((s) => s.code === PROGRESS_SIGNAL.REPEATED_FAILURE_WITH_SAME_DIAGNOSIS && s.requirement === req)) {
          signals.push({
            code: PROGRESS_SIGNAL.REPEATED_FAILURE_WITH_SAME_DIAGNOSIS,
            severity: "BLOCKING_FOR_RETRY",
            message: `Requirement "${req}" failed in ${cyclesSet.size} cycles and the latest diagnoses contain no new information.`,
            verificationCycles: sortedCycles,
            requirement: req,
          });
        }
        status = PROGRESS_STATUS.STALLED;
      } else {
        if (!signals.some((s) => s.code === PROGRESS_SIGNAL.REPEATED_FAILED_REQUIREMENT && s.requirement === req)) {
          signals.push({
            code: PROGRESS_SIGNAL.REPEATED_FAILED_REQUIREMENT,
            severity: "ADVISORY",
            message: `Requirement "${req}" failed across ${cyclesSet.size} distinct verification cycles.`,
            verificationCycles: sortedCycles,
            requirement: req,
          });
        }
        if (status !== PROGRESS_STATUS.STALLED) {
          status = PROGRESS_STATUS.WATCH;
        }
      }
    }
  }

  // 3. High cycle count
  const currentCycle = state.verificationCycle ?? 1;
  if (currentCycle >= 4) {
    signals.push({
      code: PROGRESS_SIGNAL.HIGH_CORRECTION_CYCLE_COUNT,
      severity: "ADVISORY",
      message: `Task has reached verification cycle ${currentCycle}.`,
      verificationCycles: Array.from({ length: currentCycle }, (_, i) => i + 1),
    });
    if (status !== PROGRESS_STATUS.STALLED) {
      status = PROGRESS_STATUS.WATCH;
    }
  }

  // Sort signals deterministically
  signals.sort((left, right) =>
    left.code.localeCompare(right.code) || (left.requirement || "").localeCompare(right.requirement || "")
  );

  return {
    status,
    signals,
  };
}
