import { canonicalFingerprint } from "./artifacts.js";

export function computeFailureSignature({ requirement, checkKind = null, status, exitCode = null, failureToken = null }) {
  if (!requirement || typeof requirement !== "string") {
    const error = new Error("failure signature requires a requirement");
    error.code = "E_FAILURE_SIGNATURE_INVALID";
    throw error;
  }
  if (!status || typeof status !== "string") {
    const error = new Error("failure signature requires a status");
    error.code = "E_FAILURE_SIGNATURE_INVALID";
    throw error;
  }
  return canonicalFingerprint({
    requirement,
    ...(checkKind ? { checkKind } : {}),
    status,
    ...(Number.isInteger(exitCode) ? { exitCode } : {}),
    ...(failureToken ? { failureToken: String(failureToken) } : {}),
  });
}

function failureTokenOf(details) {
  if (typeof details?.failureToken === "string" && details.failureToken) return details.failureToken;
  if (typeof details?.details?.failureToken === "string" && details.details.failureToken) return details.details.failureToken;
  return null;
}

export function projectFailureSignatures({ state = null, events = [] } = {}) {
  const byCycle = new Map();
  const record = (cycle, details) => {
    if (details.status !== "failed" && details.status !== "blocked") return;
    const requirement = details.requirement ?? details.id ?? details.checkId;
    if (!requirement) return;
    const signature = computeFailureSignature({
      requirement,
      status: details.status,
      exitCode: Number.isInteger(details.exitCode) ? details.exitCode : null,
      failureToken: failureTokenOf(details),
    });
    if (!byCycle.has(cycle)) byCycle.set(cycle, new Map());
    const cycleMap = byCycle.get(cycle);
    if (!cycleMap.has(signature)) cycleMap.set(signature, { signature, requirements: new Set(), cycles: new Set() });
    cycleMap.get(signature).requirements.add(requirement);
    cycleMap.get(signature).cycles.add(cycle);
  };

  for (const event of events) {
    if (event.event !== "VERIFICATION_RECORDED") continue;
    record(event.details?.verificationCycle ?? 1, event.details ?? {});
  }
  for (const check of state?.checks ?? []) {
    if (check.status !== "failed" && check.status !== "blocked") continue;
    record(check.details?.verificationCycle ?? state?.verificationCycle ?? 1, check);
  }

  const signaturesByIdentity = new Map();
  for (const [, cycleMap] of [...byCycle.entries()].sort(([a], [b]) => a - b)) {
    for (const [signature, entry] of cycleMap) {
      if (!signaturesByIdentity.has(signature)) signaturesByIdentity.set(signature, { signature, cycles: [], requirements: new Set() });
      const aggregated = signaturesByIdentity.get(signature);
      aggregated.cycles.push(...entry.cycles);
      for (const requirement of entry.requirements) aggregated.requirements.add(requirement);
    }
  }

  return [...signaturesByIdentity.values()]
    .map((entry) => ({ ...entry, cycles: [...new Set(entry.cycles)].sort((a, b) => a - b), requirements: [...entry.requirements].sort() }))
    .sort((a, b) => a.signature.localeCompare(b.signature));
}
