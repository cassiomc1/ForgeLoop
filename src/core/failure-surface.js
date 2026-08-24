export function projectFailureSurfaces({ state = null, events = [] } = {}) {
  const failedRequirementsByCycle = new Map();
  const record = (cycle, requirement) => {
    if (!requirement) return;
    if (!failedRequirementsByCycle.has(cycle)) failedRequirementsByCycle.set(cycle, new Set());
    failedRequirementsByCycle.get(cycle).add(requirement);
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
