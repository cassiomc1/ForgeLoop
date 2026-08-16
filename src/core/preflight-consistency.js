import { ARTIFACT_PATHS } from "./artifacts.js";
import { readContract } from "./contract.js";
import { readPersistedRoute } from "./route-artifact.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { readWorkState } from "./work-state.js";
import { assertStateIdentity } from "./completion-relationships.js";
import { ensureResumableState, synchronizePreflightState } from "./resumability.js";
import {
  issue,
  PREFLIGHT_IDENTITY_BARRIER_CODES,
  preflightError,
  sameStringSet,
  sortIssues,
  validatePersistedPreflight,
} from "./preflight-model.js";

async function readOptionalIdentityArtifact(readArtifact, invalidCode, artifactPath) {
  try {
    return await readArtifact();
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    throw preflightError(invalidCode, error.message, [artifactPath]);
  }
}

export async function assertPreflightPersistenceSafety(target, packageRoot, taskId) {
  let state;
  try {
    state = await readWorkState(target, packageRoot);
  } catch (error) {
    throw preflightError("E_STATE_INVALID", error.message, [ARTIFACT_PATHS.state]);
  }
  const contract = await readOptionalIdentityArtifact(
    () => readContract(target, packageRoot),
    "E_CONTRACT_INVALID",
    ARTIFACT_PATHS.contract,
  );
  const route = await readOptionalIdentityArtifact(
    () => readPersistedRoute(target, packageRoot),
    "E_ROUTE_INVALID",
    ARTIFACT_PATHS.route,
  );
  if (state && (contract || route)) assertStateIdentity({ contract, route, state });

  if (taskId === "unknown") return null;
  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    const first = ledger.errors[0];
    throw preflightError(first.code, first.message, [ARTIFACT_PATHS.events]);
  }
  if (ledger.events.some((event) => event.taskId !== taskId)) {
    throw preflightError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "Preflight cannot append events to a ledger owned by a different task",
      [ARTIFACT_PATHS.events, ARTIFACT_PATHS.contract],
    );
  }
  return ledger;
}

export function assertPreflightResultPersistenceSafety(result) {
  const identityError = result.errors.find((error) => PREFLIGHT_IDENTITY_BARRIER_CODES.has(error.code));
  if (identityError) throw preflightError(identityError.code, identityError.message, identityError.artifacts);
}

function sameReadyPreflightEvent(event, result) {
  return event.fingerprint === result.fingerprints.contract
    && event.details?.routingFingerprint === result.fingerprints.routing
    && sameStringSet(event.details?.requiredGates, result.requiredGates)
    && sameStringSet(event.details?.satisfiedGates, result.satisfiedGates);
}

export async function validateReadyProtocolConsistency({
  target,
  packageRoot,
  persisted,
  current = null,
  evaluateCurrentPreflight,
} = {}) {
  if (persisted?.status !== "READY") return [];
  const result = current ?? await evaluateCurrentPreflight({ target, packageRoot });
  const errors = [...validatePersistedPreflight(persisted, result)];

  let state = null;
  try {
    state = await readWorkState(target, packageRoot);
  } catch (error) {
    errors.push(issue("E_STATE_INVALID", error.message, [ARTIFACT_PATHS.state]));
  }
  if (!state) {
    errors.push(issue(
      "E_STATE_MISSING_AFTER_PREFLIGHT_READY",
      "A persisted READY preflight must have a resumable work-state checkpoint",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.state],
    ));
  } else {
    if (state.taskId !== persisted.taskId) {
      errors.push(issue("E_STATE_TASK_MISMATCH", "The resumable checkpoint does not belong to the READY preflight task", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.preflight]));
    }
    if (state.contractFingerprint !== result.fingerprints.contract) {
      errors.push(issue("E_CONTRACT_STALE", "The resumable checkpoint does not match the READY contract fingerprint", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract]));
    }
    if (state.routeFingerprint !== result.fingerprints.routing) {
      errors.push(issue("E_ROUTE_STALE", "The resumable checkpoint does not match the READY routing fingerprint", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route]));
    }
    if (JSON.stringify(state.selectedGuides) !== JSON.stringify(result.routing.guides)) {
      errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "The resumable checkpoint guides do not match the READY routing result", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route]));
    }
    if (!sameStringSet(state.requiredGates ?? [], persisted.requiredGates)
      || !sameStringSet(state.satisfiedGates ?? [], persisted.satisfiedGates)) {
      errors.push(issue("E_PREFLIGHT_GATES_STALE", "The resumable checkpoint gate sets do not match the READY preflight", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.gates]));
    }
  }

  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    errors.push(...ledger.errors.map((error) => issue(error.code ?? "E_EVENT_INVALID", error.message, [ARTIFACT_PATHS.events])));
  }
  const events = ledger.events ?? [];
  for (const requiredEvent of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED"]) {
    if (!events.some((event) => event.event === requiredEvent && event.taskId === persisted.taskId)) {
      errors.push(issue("E_PREFLIGHT_EVENT_MISSING", `READY preflight is missing lifecycle event: ${requiredEvent}`, [ARTIFACT_PATHS.events, ARTIFACT_PATHS.preflight]));
    }
  }
  for (const gate of persisted.satisfiedGates ?? []) {
    if (!events.some((event) => event.event === "GATE_SATISFIED"
      && event.taskId === persisted.taskId
      && event.details?.gate === gate)) {
      errors.push(issue("E_PREFLIGHT_GATE_EVENT_MISSING", `READY preflight is missing lifecycle gate event: ${gate}`, [ARTIFACT_PATHS.events, `${ARTIFACT_PATHS.gates}/${gate}.json`]));
    }
  }
  const readyEvents = events.filter((event) => event.event === "PREFLIGHT_READY" && event.taskId === persisted.taskId);
  if (readyEvents.length === 0) {
    errors.push(issue("E_PREFLIGHT_READY_EVENT_MISSING", "Persisted READY preflight is missing the matching PREFLIGHT_READY lifecycle event", [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events]));
  } else if (!readyEvents.some((event) => sameReadyPreflightEvent(event, result))) {
    errors.push(issue("E_PREFLIGHT_READY_EVENT_MISMATCH", "PREFLIGHT_READY lifecycle details do not match the persisted READY preflight", [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events]));
  }
  return sortIssues(errors);
}

function sameBlockedPreflightEvent(event, result) {
  return event.event === "PREFLIGHT_BLOCKED"
    && event.taskId === result.taskId
    && event.fingerprint === (result.fingerprints.contract ?? undefined)
    && sameStringSet(event.details?.requiredGates, result.requiredGates)
    && sameStringSet(event.details?.satisfiedGates, result.satisfiedGates)
    && event.details?.routingFingerprint === result.fingerprints.routing;
}

export function assertExistingReadyLifecycleCompatibility(ledger, result) {
  if (result.status !== "READY") return;
  const existingReady = ledger?.events?.find((event) => event.event === "PREFLIGHT_READY" && event.taskId === result.taskId);
  if (existingReady && !sameReadyPreflightEvent(existingReady, result)) {
    throw preflightError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "PREFLIGHT_READY already exists with different READY preflight details; repair the contract, route, or gate lifecycle before refreshing preflight",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events, ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route, ARTIFACT_PATHS.gates],
    );
  }
}

export async function appendActivationEvents(target, packageRoot, ledger, result) {
  const events = [...(ledger?.events ?? [])];
  const hasEvent = (eventName) => events.some((event) => event.event === eventName && event.taskId === result.taskId);
  const append = async (input) => {
    const event = await appendProtocolEvent(target, input, packageRoot);
    events.push(event);
  };

  if (events.length === 0) await append({ taskId: result.taskId, event: "TASK_RECEIVED" });
  if (result.contract.status === "valid" && !hasEvent("CONTRACT_VALIDATED")) {
    await append({ taskId: result.taskId, event: "CONTRACT_VALIDATED", fingerprint: result.fingerprints.contract });
  }
  if (result.routing.status === "valid" && !hasEvent("ROUTE_VALIDATED")) {
    await append({ taskId: result.taskId, event: "ROUTE_VALIDATED", fingerprint: result.fingerprints.routing });
  }
  for (const gate of result.satisfiedGates) {
    if (!events.some((event) => event.event === "GATE_SATISFIED"
      && event.taskId === result.taskId
      && event.details?.gate === gate)) {
      await append({ taskId: result.taskId, event: "GATE_SATISFIED", details: { gate } });
    }
  }

  const existingReady = events.find((event) => event.event === "PREFLIGHT_READY" && event.taskId === result.taskId);
  if (result.status === "READY") {
    if (existingReady && !sameReadyPreflightEvent(existingReady, result)) {
      throw preflightError(
        "E_PHASE_CHRONOLOGY_INVALID",
        "PREFLIGHT_READY already exists with different READY preflight details; repair the contract, route, or gate lifecycle before refreshing preflight",
        [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events, ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route, ARTIFACT_PATHS.gates],
      );
    }
    if (!existingReady) {
      await append({
        taskId: result.taskId,
        event: "PREFLIGHT_READY",
        fingerprint: result.fingerprints.contract ?? undefined,
        details: {
          requiredGates: result.requiredGates,
          satisfiedGates: result.satisfiedGates,
          routingFingerprint: result.fingerprints.routing,
        },
      });
    }
  } else if (!events.some((event) => sameBlockedPreflightEvent(event, result))) {
    await append({
      taskId: result.taskId,
      event: "PREFLIGHT_BLOCKED",
      fingerprint: result.fingerprints.contract ?? undefined,
      details: {
        requiredGates: result.requiredGates,
        satisfiedGates: result.satisfiedGates,
        routingFingerprint: result.fingerprints.routing,
      },
    });
  }
  return events;
}

export { ensureResumableState, synchronizePreflightState };
