import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import {
  appendProtocolEvent,
  LIFECYCLE_MILESTONES,
  validateCompletionRecoveryAuthorization,
  validateEventLedger,
  validateStateLedgerCoherence,
} from "./events.js";
import { readPersistedRoute } from "./route-artifact.js";
import { assertWorkPhase, isValidTransition } from "./protocol.js";
import { readWorkState, writeWorkState } from "./work-state.js";
import { evaluateCompletion } from "./completion.js";
import { evaluatePreflight, validatePersistedPreflight } from "./preflight.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
import { assertCompletionRelationships, assertStateIdentity } from "./completion-relationships.js";
import { createReceipt, validateReceipt } from "./receipt.js";
import { assertExecutionPrerequisites, hasExecutionStarted } from "./execution-prerequisites.js";

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
  REVIEWING: "REVIEW_STARTED",
  COMPLETE: "COMPLETION_VALIDATED",
});

const LATE_PHASES = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

async function assertPersistedStateIdentity(target, state, toPhase, packageRoot) {
  const requireContract = LATE_PHASES.has(state.phase)
    || ["CONTRACT_READY", "ROUTED", "EXECUTING"].includes(toPhase);
  const requireRoute = LATE_PHASES.has(state.phase)
    || ["ROUTED", "EXECUTING"].includes(toPhase);
  let contract = null;
  let route = null;
  try {
    contract = await readContract(target, packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING" && !requireContract) {
      contract = null;
    } else {
      throw phaseError(
        requireContract ? "E_PHASE_PREREQUISITE_MISSING" : error.code ?? "E_CONTRACT_INVALID",
        `${requireContract ? `Phase ${toPhase} requires current contract` : "Unable to validate current contract"}: ${error.message}`,
        [ARTIFACT_PATHS.contract],
      );
    }
  }
  try {
    route = await readPersistedRoute(target, packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING" && !requireRoute) {
      route = null;
    } else {
      throw phaseError(
        requireRoute ? "E_PHASE_PREREQUISITE_MISSING" : error.code ?? "E_ROUTE_INVALID",
        `${requireRoute ? `Phase ${toPhase} requires persisted route` : "Unable to validate persisted route"}: ${error.message}`,
        [ARTIFACT_PATHS.route],
      );
    }
  }
  if (!contract && !route) return;
  try {
    assertStateIdentity({ contract, route, state });
  } catch (error) {
    throw phaseError(
      error.code,
      error.message,
      error.artifacts,
    );
  }
}

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

async function assertPhasePrerequisites(target, state, toPhase, packageRoot, authorityContext, runtimeContext) {
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
  if (hasExecutionStarted(toPhase)) {
    try {
      await assertExecutionPrerequisites({ target, state, packageRoot });
    } catch (error) {
      throw phaseError(error.code, error.message, error.artifacts);
    }
  }
  if (toPhase === "COMPLETE" && state.verificationEvidence.length === 0) {
    throw phaseError("E_PHASE_EVIDENCE_MISSING", "COMPLETE requires verification evidence");
  }
  if (toPhase === "COMPLETE") {
    const completion = await evaluateCompletion({ target, packageRoot, persist: false, authorityContext, runtimeContext });
    if (completion.status !== "VALID") {
      throw phaseError("E_COMPLETION_REJECTED", "COMPLETE requires a valid completion audit", completion.errors.flatMap((error) => error.artifacts ?? []));
    }
  }
}

export async function advanceWorkState(target, toPhase, options = {}) {
  const normalizedOptions = typeof options === "string" ? { packageRoot: options } : options;
  const {
    packageRoot,
    now = new Date().toISOString(),
    authorityContext,
    runtimeContext,
  } = normalizedOptions;
  assertWorkPhase(toPhase);
  const state = await readWorkState(target, packageRoot);
  if (!state) throw phaseError("E_PHASE_PREREQUISITE_MISSING", "Cannot advance without work state", [ARTIFACT_PATHS.state]);
  await assertPhasePrerequisites(target, state, toPhase, packageRoot, authorityContext, runtimeContext);
  await assertPersistedStateIdentity(target, state, toPhase, packageRoot);
  if (!isValidTransition(state.phase, toPhase)) {
    throw phaseError("E_PHASE_TRANSITION_INVALID", `Invalid work-state transition: ${state.phase} -> ${toPhase}`);
  }
  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    const first = ledger.errors[0];
    throw phaseError(first.code, first.message, [ARTIFACT_PATHS.events]);
  }
  if (ledger.events.some((event) => event.taskId !== state.taskId)) {
    throw phaseError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "Cannot advance work state with lifecycle events from a different task",
      [ARTIFACT_PATHS.events, ARTIFACT_PATHS.state],
    );
  }
  const coherenceErrors = validateStateLedgerCoherence(state, ledger.events);
  if (coherenceErrors.length > 0) {
    throw phaseError(coherenceErrors[0].code, coherenceErrors[0].message, [ARTIFACT_PATHS.state, ARTIFACT_PATHS.events]);
  }
  const eventType = PHASE_EVENTS[toPhase];
  const reenteringVerification = toPhase === "VERIFYING" && ["CORRECTING", "REVIEWING"].includes(state.phase);
  if (toPhase === "VERIFYING" && state.phase === "REVIEWING") {
    let currentReceipt = null;
    try {
      const receiptArtifact = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
      currentReceipt = receiptArtifact?.value;
    } catch {
      // If receipt is not present, pass null
    }
    const recoveryAuth = validateCompletionRecoveryAuthorization({
      state,
      receipt: currentReceipt,
      events: ledger.events,
    });
    if (!recoveryAuth.authorized) {
      const firstError = recoveryAuth.errors[0] ?? {};
      throw phaseError(
        firstError.code ?? "E_COMPLETION_RECOVERY_UNAUTHORIZED",
        firstError.message ?? "REVIEWING -> VERIFYING requires authorized completion recovery",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.events],
      );
    }
  }
  if (toPhase === "VERIFYING" && state.phase === "CORRECTING") {
    if (typeof state.diagnosedHypothesis !== "string" || !state.diagnosedHypothesis.trim()) {
      throw phaseError(
        "E_PHASE_PREREQUISITE_MISSING",
        "CORRECTING -> VERIFYING requires a diagnosed hypothesis",
        [ARTIFACT_PATHS.state],
      );
    }
  }
  const repeatedReview = state.phase === "VERIFYING" && toPhase === "REVIEWING"
    && ledger.events.some((event) => event.taskId === state.taskId && event.event === "REVIEW_STARTED");
  if (eventType && !reenteringVerification && !repeatedReview
    && ledger.events.some((event) => event.taskId === state.taskId && event.event === eventType)) {
    throw phaseError("E_PHASE_CHRONOLOGY_INVALID", `Lifecycle milestone already exists: ${eventType}`, [ARTIFACT_PATHS.events]);
  }
  const milestoneIndex = reenteringVerification || repeatedReview ? -1 : LIFECYCLE_MILESTONES.indexOf(eventType);
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
  if (toPhase === "VERIFYING") {
    next.verificationCycle = reenteringVerification ? (state.verificationCycle ?? 1) + 1 : (state.verificationCycle ?? 1);
  }
  if (reenteringVerification) delete next.lastCompletionAttempt;
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
    await validateReceipt(receipt.value, packageRoot, {
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    assertCompletionRelationships({
      contract,
      route,
      state,
      receipt: receipt.value,
      requiredEvidence,
      requireRequiredChecks: false,
      requireReceiptStateFingerprint: false,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    nextReceipt = await createReceipt({
      ...receipt.value,
      stateFingerprint: canonicalFingerprint(next),
      verificationCycle: next.verificationCycle ?? receipt.value.verificationCycle ?? 1,
    }, packageRoot, {
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    assertCompletionRelationships({
      contract,
      route,
      state: next,
      receipt: nextReceipt,
      requiredEvidence,
      requireRequiredChecks: false,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
  } catch (error) {
    if (error.code !== "ARTIFACT_MISSING") throw error;
  }
  await writeWorkState(target, next, { packageRoot });
  if (nextReceipt) {
    await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, nextReceipt, "execution-receipt", packageRoot);
  }
  if (eventType) await appendProtocolEvent(target, {
    taskId: state.taskId,
    event: eventType,
    at: now,
    details: eventType === "VERIFICATION_STARTED"
      ? { verificationCycle: next.verificationCycle }
      : eventType === "REVIEW_STARTED"
        ? { verificationCycle: next.verificationCycle ?? 1 }
        : undefined,
  }, packageRoot);
  return next;
}
