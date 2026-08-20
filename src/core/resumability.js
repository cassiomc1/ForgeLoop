import { currentRepositoryFingerprint } from "./repository.js";
import { createWorkState, initializeWorkState, readWorkState, mutateWorkState } from "./work-state.js";

const DEFAULT_PENDING_STEPS = ["planning", "implementation", "verification"];

export async function ensureResumableState({ target, packageRoot, contract, route, taskId, statePath }) {
  if (!contract || !route) return null;
  const existing = await readWorkState(target, { packageRoot, taskId, statePath });
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
  return initializeWorkState(target, state, { packageRoot, taskId, statePath });
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
  statePath,
  taskId,
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
  return mutateWorkState(target, {
    expectedRevision: state.revision ?? 0,
    packageRoot,
    taskId,
    statePath,
  }, () => ({ ...candidate, lastUpdated: new Date().toISOString() }));
}
