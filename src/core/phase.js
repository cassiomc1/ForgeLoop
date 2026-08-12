import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { appendProtocolEvent, LIFECYCLE_MILESTONES, validateEventLedger } from "./events.js";
import { readPersistedRoute } from "./route-artifact.js";
import { assertWorkPhase, isValidTransition } from "./protocol.js";
import { classifyLoadedWorkState, readWorkState, writeWorkState } from "./work-state.js";
import { evaluateCompletion } from "./completion.js";
import { evaluatePreflight, validatePersistedPreflight } from "./preflight.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
import { assertCompletionRelationships } from "./completion-relationships.js";
import { createReceipt, validateReceipt } from "./receipt.js";

function phaseError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

const PHASE_EVENTS = Object.freeze({
  CONTRACT_READY: "CONTRACT_VALIDATED",
  ROUTED: "ROUTE_VALIDATED",
  DESIGNING: "DESIGN_GATE_STARTED",
  PLANNED: "PLAN_RECORDED",
  EXECUTING: "EXECUTION_STARTED",
  VERIFYING: "VERIFICATION_STARTED",
  COMPLETE: "COMPLETION_VALIDATED",
});

function reconcileImplementationStep(state, toPhase) {
  if (state.phase !== "EXECUTING" || toPhase !== "VERIFYING") return state;
  if (!state.pendingSteps.includes("implementation")) return state;
  return {
    ...state,
    completedSteps: state.completedSteps.includes("implementation")
      ? [...state.completedSteps]
      : [...state.completedSteps, "implementation"],
    pendingSteps: state.pendingSteps.filter((step) => step !== "implementation"),
  };
}

async function assertPhasePrerequisites(target, state, toPhase, packageRoot) {
  if (toPhase === "CONTRACT_READY" || toPhase === "ROUTED" || toPhase === "EXECUTING") {
    try {
      await readContract(target, packageRoot);
    } catch (error) {
      throw phaseError("E_PHASE_PREREQUISITE_MISSING", `Phase ${toPhase} requires ${ARTIFACT_PATHS.contract}: ${error.message}`, [ARTIFACT_PATHS.contract]);
    }
  }
  if (toPhase === "ROUTED" || toPhase === "EXECUTING") {
    try {
      await readPersistedRoute(target, packageRoot);
    } catch (error) {
      throw phaseError("E_PHASE_PREREQUISITE_MISSING", `Phase ${toPhase} requires ${ARTIFACT_PATHS.route}: ${error.message}`, [ARTIFACT_PATHS.route]);
    }
  }
  if (toPhase === "EXECUTING") {
    let contract;
    let route;
    try {
      contract = await readContract(target, packageRoot);
      route = await readPersistedRoute(target, packageRoot);
    } catch (error) {
      throw phaseError("E_PHASE_PREREQUISITE_MISSING", `EXECUTING requires validated contract and route: ${error.message}`, [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route]);
    }
    if (state.taskId !== contract.value.taskId) {
      throw phaseError("E_STATE_TASK_MISMATCH", "Work state does not belong to the current contract task", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract]);
    }
    const freshness = await classifyLoadedWorkState({
      target,
      state,
      contractFile: ARTIFACT_PATHS.contract,
    });
    if (freshness.status === "REVALIDATION_REQUIRED") {
      throw phaseError(
        "E_STATE_REVALIDATION_REQUIRED",
        `EXECUTING requires a fresh work-state checkpoint: ${freshness.reasons.join(", ")}`,
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract, ...(state.requiredArtifacts?.map((artifact) => artifact.path) ?? [])],
      );
    }
    if (route.value.contractFingerprint !== contract.fingerprint
      || state.routeFingerprint !== route.fingerprint
      || JSON.stringify(state.selectedGuides) !== JSON.stringify(route.value.guides)) {
      throw phaseError("E_ROUTE_STALE", "EXECUTING requires work state and route to match the current contract", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route, ARTIFACT_PATHS.contract]);
    }
    let preflight;
    try {
      preflight = await readJsonArtifact(target, ARTIFACT_PATHS.preflight, "preflight", packageRoot);
    } catch (error) {
      throw phaseError("E_PHASE_PREREQUISITE_MISSING", `EXECUTING requires READY ${ARTIFACT_PATHS.preflight}: ${error.message}`, [ARTIFACT_PATHS.preflight]);
    }
    const evaluatedPreflight = await evaluatePreflight({ target, packageRoot });
    const preflightErrors = validatePersistedPreflight(preflight.value, evaluatedPreflight);
    if (preflightErrors.length > 0) {
      const first = preflightErrors[0];
      throw phaseError(first.code, first.message, first.artifacts);
    }
    const ledger = await validateEventLedger(target, packageRoot);
    if (!ledger.valid) {
      const first = ledger.errors[0];
      throw phaseError(first.code, first.message, [ARTIFACT_PATHS.events]);
    }
    if (ledger.events.some((event) => event.taskId !== contract.value.taskId)) {
      throw phaseError(
        "E_PHASE_CHRONOLOGY_INVALID",
        "EXECUTING requires protocol prerequisite events to belong to the current task",
        [ARTIFACT_PATHS.events, ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract],
      );
    }
    for (const requiredEvent of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED", "PREFLIGHT_READY"]) {
      if (!ledger.events.some((event) => event.taskId === contract.value.taskId && event.event === requiredEvent)) {
        throw phaseError("E_PHASE_CHRONOLOGY_INVALID", `EXECUTING requires a ${requiredEvent} protocol event`, [ARTIFACT_PATHS.events]);
      }
    }
  }
  if (toPhase === "COMPLETE" && state.verificationEvidence.length === 0) {
    throw phaseError("E_PHASE_EVIDENCE_MISSING", "COMPLETE requires verification evidence");
  }
  if (toPhase === "COMPLETE") {
    const completion = await evaluateCompletion({ target, packageRoot, persist: false });
    if (completion.status !== "VALID") {
      throw phaseError("E_COMPLETION_REJECTED", "COMPLETE requires a valid completion audit", completion.errors.flatMap((error) => error.artifacts ?? []));
    }
  }
}

export async function advanceWorkState(target, toPhase, { packageRoot, now = new Date().toISOString() } = {}) {
  assertWorkPhase(toPhase);
  const state = await readWorkState(target, packageRoot);
  if (!state) throw phaseError("E_PHASE_PREREQUISITE_MISSING", "Cannot advance without work state", [ARTIFACT_PATHS.state]);
  await assertPhasePrerequisites(target, state, toPhase, packageRoot);
  if (!isValidTransition(state.phase, toPhase)) {
    throw phaseError("E_PHASE_TRANSITION_INVALID", `Invalid work-state transition: ${state.phase} -> ${toPhase}`);
  }
  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    const first = ledger.errors[0];
    throw phaseError(first.code, first.message, [ARTIFACT_PATHS.events]);
  }
  const eventType = PHASE_EVENTS[toPhase];
  if (eventType && ledger.events.some((event) => event.taskId === state.taskId && event.event === eventType)) {
    throw phaseError("E_PHASE_CHRONOLOGY_INVALID", `Lifecycle milestone already exists: ${eventType}`, [ARTIFACT_PATHS.events]);
  }
  const milestoneIndex = LIFECYCLE_MILESTONES.indexOf(eventType);
  if (milestoneIndex >= 0) {
    const lastMilestone = ledger.events.reduce((last, event) => Math.max(last, LIFECYCLE_MILESTONES.indexOf(event.event)), -1);
    if (lastMilestone !== milestoneIndex - 1) {
      throw phaseError("E_PHASE_CHRONOLOGY_INVALID", `Phase ${toPhase} cannot append ${eventType} after the current lifecycle ledger`, [ARTIFACT_PATHS.events]);
    }
  }
  const reconciled = reconcileImplementationStep(state, toPhase);
  const next = {
    ...reconciled,
    previousPhase: state.phase,
    phase: toPhase,
    lastUpdated: now,
  };
  let nextReceipt = null;
  try {
    const receipt = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
    const contract = await readContract(target, packageRoot);
    const route = await readPersistedRoute(target, packageRoot);
    const preflight = await evaluatePreflight({ target, packageRoot });
    const requiredEvidence = await requiredEvidenceForTarget({
      target,
      contract,
      route,
      packageRoot,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
    });
    await validateReceipt(receipt.value, packageRoot);
    assertCompletionRelationships({
      contract,
      route,
      state,
      receipt: receipt.value,
      requiredEvidence,
      requireRequiredChecks: false,
    });
    nextReceipt = await createReceipt({
      ...receipt.value,
      stateFingerprint: canonicalFingerprint(next),
    }, packageRoot);
    assertCompletionRelationships({
      contract,
      route,
      state: next,
      receipt: nextReceipt,
      requiredEvidence,
      requireRequiredChecks: false,
    });
  } catch (error) {
    if (error.code !== "ARTIFACT_MISSING") throw error;
  }
  await writeWorkState(target, next, { packageRoot });
  if (nextReceipt) {
    await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, nextReceipt, "execution-receipt", packageRoot);
  }
  if (eventType) await appendProtocolEvent(target, { taskId: state.taskId, event: eventType, at: now }, packageRoot);
  return next;
}
