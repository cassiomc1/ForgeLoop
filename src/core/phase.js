import { ARTIFACT_PATHS } from "./artifacts.js";
import { readJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { readPersistedRoute } from "./route-artifact.js";
import { assertWorkPhase, isValidTransition } from "./protocol.js";
import { readWorkState, writeWorkState } from "./work-state.js";
import { evaluateCompletion } from "./completion.js";

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
    let preflight;
    try {
      preflight = await readJsonArtifact(target, ARTIFACT_PATHS.preflight, "preflight", packageRoot);
    } catch (error) {
      throw phaseError("E_PHASE_PREREQUISITE_MISSING", `EXECUTING requires READY ${ARTIFACT_PATHS.preflight}: ${error.message}`, [ARTIFACT_PATHS.preflight]);
    }
    if (preflight.value.status !== "READY") {
      throw phaseError("E_PREFLIGHT_NOT_READY", "EXECUTING requires a READY preflight", [ARTIFACT_PATHS.preflight]);
    }
    const ledger = await validateEventLedger(target, packageRoot);
    for (const requiredEvent of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED", "PREFLIGHT_READY"]) {
      if (!ledger.events.some((event) => event.event === requiredEvent)) {
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
  const next = {
    ...state,
    previousPhase: state.phase,
    phase: toPhase,
    lastUpdated: now,
  };
  await writeWorkState(target, next, { packageRoot });
  const eventType = PHASE_EVENTS[toPhase];
  if (eventType) await appendProtocolEvent(target, { taskId: state.taskId, event: eventType, at: now }, packageRoot);
  return next;
}
