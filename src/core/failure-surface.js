export function projectFailureSurfaces({ state = null, events = [] } = {}) {
  const failedRequirementsByCycle = new Map();
  // Track every canonically verified cycle so a successful verification
  // appears explicitly as surface: [] instead of silently disappearing.
  const knownCycles = new Set();
  const record = (cycle, requirement) => {
    if (!Number.isInteger(cycle)) cycle = Number(cycle) || 1;
    knownCycles.add(cycle);
    if (!failedRequirementsByCycle.has(cycle)) failedRequirementsByCycle.set(cycle, new Set());
    if (!requirement) return;
    failedRequirementsByCycle.get(cycle).add(requirement);
  };
  const knowCycle = (cycle) => {
    if (Number.isInteger(cycle)) knownCycles.add(cycle);
  };

  for (const event of events) {
    if (event.event === "VERIFICATION_STARTED") {
      knowCycle(event.details?.verificationCycle);
    }
    if (event.event !== "VERIFICATION_RECORDED") continue;
    const d = event.details ?? {};
    if (d.status === "failed" || d.status === "blocked") {
      record(d.verificationCycle ?? 1, d.requirement ?? d.id ?? d.checkId);
    } else {
      knowCycle(d.verificationCycle);
    }
  }

  for (const check of state?.checks ?? []) {
    knowCycle(check.details?.verificationCycle ?? state?.verificationCycle ?? 1);
    if (check.status !== "failed" && check.status !== "blocked") continue;
    record(check.details?.verificationCycle ?? state?.verificationCycle ?? 1, check.requirement ?? check.id ?? check.checkId);
  }
  for (const cycle of knownCycles) {
    if (!failedRequirementsByCycle.has(cycle)) failedRequirementsByCycle.set(cycle, new Set());
  }

  return [...failedRequirementsByCycle.entries()]
    .sort(([a], [b]) => a - b)
    .map(([verificationCycle, requirements]) => ({
      verificationCycle,
      surface: [...requirements].sort(),
      size: requirements.size,
    }));
}

export function compareFailureSurface(previous, current) {
  if (!previous || !current) return { changed: false, direction: "UNCHANGED" };
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  const removed = [...previousSet].filter((item) => !currentSet.has(item));
  const added = [...currentSet].filter((item) => !previousSet.has(item));
  if (added.length > 0) return { changed: true, direction: "EXPANDED", added, removed };
  if (removed.length > 0) return { changed: true, direction: "REDUCED", added, removed };
  return { changed: false, direction: "UNCHANGED", added, removed };
}
