import { currentRepositoryFingerprint } from "./repository.js";
import { createWorkState, readWorkState, writeWorkState } from "./work-state.js";

const DEFAULT_PENDING_STEPS = ["planning", "implementation", "verification"];

export async function ensureResumableState({ target, packageRoot, contract, route }) {
  if (!contract || !route) return null;
  const existing = await readWorkState(target, packageRoot);
  if (existing) return existing;

  const state = createWorkState({
    taskId: contract.value.taskId,
    contractFingerprint: contract.fingerprint,
    routeFingerprint: route.fingerprint,
    repositoryFingerprint: await currentRepositoryFingerprint(target),
    phase: "ROUTED",
    selectedGuides: route.value.guides,
    completedSteps: ["contract", "route"],
    pendingSteps: DEFAULT_PENDING_STEPS,
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  });
  await writeWorkState(target, state, { packageRoot });
  return state;
}

export async function synchronizePreflightState({
  target,
  packageRoot,
  state,
  contract,
  route,
  requiredGates,
  satisfiedGates,
  complianceMode,
}) {
  const candidate = createWorkState({
    ...state,
    taskId: contract.value.taskId,
    contractFingerprint: contract.fingerprint,
    routeFingerprint: route.fingerprint,
    selectedGuides: route.value.guides,
    requiredGates: [...requiredGates],
    satisfiedGates: [...satisfiedGates],
    ...(complianceMode ? { complianceMode } : {}),
    lastUpdated: state.lastUpdated,
  });
  const withoutTimestamp = (value) => {
    const copy = structuredClone(value);
    delete copy.lastUpdated;
    return copy;
  };
  if (JSON.stringify(withoutTimestamp(candidate)) === JSON.stringify(withoutTimestamp(state))) {
    return state;
  }
  const next = { ...candidate, lastUpdated: new Date().toISOString() };
  await writeWorkState(target, next, { packageRoot });
  return next;
}
