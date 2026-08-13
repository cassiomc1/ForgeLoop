import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { readGateIfPresent, validateGateArtifacts } from "./gate-artifact.js";
import { requiredGatesForGuides } from "./guide-metadata.js";
import { assertRouteInvariants } from "./router.js";
import { assertSourceProvenance } from "./sources.js";
import { readPersistedRoute } from "./route-artifact.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { readWorkState } from "./work-state.js";
import { readConfig } from "./config.js";
import { assertSafePath, ensureWithin, fileExists, readBytes } from "./filesystem.js";
import { sha256 } from "./manifest.js";
import { findProfilePath, validateProfileSources } from "./profile.js";
import { assertStateIdentity } from "./completion-relationships.js";
import { ensureResumableState, synchronizePreflightState } from "./resumability.js";
import { PROFILE_PATH } from "./target-layout.js";

const PREVIEW_DECISION_LIMIT = 10;
const PREVIEW_DECISION_MAX_LENGTH = 240;

function issue(code, message, artifacts = [], details = {}) {
  return { code, message, artifacts, ...details };
}

function sortIssues(errors) {
  const unique = [...new Map(errors.map((error) => [
    `${error.code}\0${error.artifacts.join("\0")}\0${error.message}`,
    error,
  ])).values()];
  return unique.sort((left, right) => left.code.localeCompare(right.code)
    || left.artifacts.join("\0").localeCompare(right.artifacts.join("\0"))
    || left.message.localeCompare(right.message));
}

function preflightError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === left.length
    && rightSet.size === right.length
    && leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value));
}

export function validatePersistedPreflight(persisted, current) {
  const errors = [];
  if (persisted?.status !== "READY") {
    errors.push(issue("E_PREFLIGHT_NOT_READY", "A persisted READY preflight is required", [ARTIFACT_PATHS.preflight]));
    return errors;
  }
  if (current?.status !== "READY") {
    errors.push(issue("E_PREFLIGHT_NOT_READY", "The current preflight evaluation is not READY", [ARTIFACT_PATHS.preflight]));
  }
  if (persisted.taskId !== current?.taskId) {
    errors.push(issue(
      "E_PREFLIGHT_TASK_MISMATCH",
      "Persisted preflight does not belong to the current task",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.contract],
    ));
  }
  if (persisted.fingerprints?.contract !== current?.fingerprints?.contract
    || persisted.contract?.fingerprint !== current?.contract?.fingerprint) {
    errors.push(issue(
      "E_PREFLIGHT_CONTRACT_STALE",
      "Persisted preflight does not match the current contract fingerprint",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.contract],
    ));
  }
  if (persisted.fingerprints?.routing !== current?.fingerprints?.routing
    || persisted.routing?.fingerprint !== current?.routing?.fingerprint) {
    errors.push(issue(
      "E_PREFLIGHT_ROUTE_STALE",
      "Persisted preflight does not match the current routing fingerprint",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.route],
    ));
  }
  if (!sameStringSet(persisted.requiredGates, current?.requiredGates)
    || !sameStringSet(persisted.satisfiedGates, current?.satisfiedGates)) {
    errors.push(issue(
      "E_PREFLIGHT_GATES_STALE",
      "Persisted preflight gate sets do not match the current evaluation",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.gates],
    ));
  }
  return sortIssues(errors);
}

async function readProfile(target) {
  const relativePath = await findProfilePath(target);
  if (!relativePath) return { status: "missing", fingerprint: null };
  const filePath = ensureWithin(target, relativePath);
  const bytes = await readBytes(filePath);
  const text = bytes.toString("utf8");
  const mode = text.match(/^profile-mode:\s*([^\s]+)\s*$/m)?.[1] ?? null;
  const status = text.match(/^profile-status:\s*([^\s]+)\s*$/m)?.[1] ?? null;
  return {
    status: status === "verified" && mode !== "template" ? "verified" : "unverified",
    mode,
    profileStatus: status,
    fingerprint: sha256(bytes),
  };
}

async function optionalConfig(target, packageRoot, errors) {
  try {
    const artifact = await readJsonArtifact(target, ARTIFACT_PATHS.config, "config", packageRoot);
    return artifact.value;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return { schemaVersion: 1, protocolVersion: 1, complianceMode: "standard" };
    errors.push(issue("E_CONFIG_INVALID", error.message, [ARTIFACT_PATHS.config]));
    return { schemaVersion: 1, protocolVersion: 1, complianceMode: "standard" };
  }
}

async function loadContract(target, packageRoot, errors) {
  try {
    return await readContract(target, packageRoot);
  } catch (error) {
    errors.push(issue(error.code === "ARTIFACT_MISSING" ? "E_CONTRACT_MISSING" : "E_CONTRACT_INVALID", error.message, [ARTIFACT_PATHS.contract]));
    return null;
  }
}

async function loadRoute(target, packageRoot, errors) {
  try {
    return await readPersistedRoute(target, packageRoot);
  } catch (error) {
    const code = error.code === "ARTIFACT_MISSING"
      ? "E_ROUTE_MISSING"
      : ["E_ROUTE_REASON_MISSING", "E_ROUTE_INVALID"].includes(error.code) ? error.code : "E_ROUTE_INVALID";
    errors.push(issue(code, error.message, [ARTIFACT_PATHS.route]));
    return null;
  }
}

async function loadSources(target, contract, packageRoot, errors) {
  if (!contract?.value?.sourceRefs?.length) return null;
  let registry;
  try {
    registry = (await readJsonArtifact(target, ARTIFACT_PATHS.sources, "source-registry", packageRoot)).value;
  } catch (error) {
    errors.push(issue(error.code === "ARTIFACT_MISSING" ? "E_PROFILE_SOURCE_MISSING" : "E_PROFILE_SOURCE_UNKNOWN", error.message, [ARTIFACT_PATHS.sources]));
    return null;
  }
  try {
    assertSourceProvenance(registry, contract.value.sourceRefs);
  } catch (error) {
    errors.push(issue(error.code ?? "E_PROFILE_SOURCE_UNKNOWN", error.message, [ARTIFACT_PATHS.sources]));
  }
  return registry;
}

async function inspectGates(target, contract, route, packageRoot, errors, config = {}) {
  if (!route) return { required: [], satisfied: [], records: {} };
  const guideGates = await requiredGatesForGuides(route.value.guides, packageRoot);
  const required = [...new Set([...guideGates, ...(config.requiredGates ?? [])])].sort();
  const satisfied = [];
  const records = {};
  for (const gate of required) {
    let artifact;
    try {
      artifact = await readGateIfPresent(target, gate, packageRoot);
    } catch (error) {
      errors.push(issue(error.code === "ARTIFACT_MISSING" ? "E_GATE_UNVERIFIED" : "E_GATE_INVALID", error.message, [`${ARTIFACT_PATHS.gates}/${gate}.json`], { gate }));
      continue;
    }
    if (!artifact) {
      errors.push(issue("E_GATE_UNVERIFIED", `Required gate is missing or unverified: ${gate}`, [`${ARTIFACT_PATHS.gates}/${gate}.json`], { gate }));
      continue;
    }
    records[gate] = artifact;
    if (artifact.value.taskId !== contract?.value?.taskId) {
      errors.push(issue("E_GATE_TASK_MISMATCH", `Gate ${gate} belongs to a different task`, [artifact.path], { gate }));
      continue;
    }
    if (artifact.value.status !== "satisfied") {
      errors.push(issue("E_GATE_UNVERIFIED", `Required gate is ${artifact.value.status}: ${gate}`, [artifact.path], { gate }));
      continue;
    }
    const stale = await validateGateArtifacts(target, artifact.value, packageRoot);
    if (stale.length > 0) {
      errors.push(issue("E_GATE_STALE", `Gate ${gate} references stale artifacts`, [artifact.path], { gate, stale }));
      continue;
    }
    satisfied.push(gate);
  }
  return { required, satisfied: satisfied.sort(), records };
}

export async function evaluatePreflight({ target, packageRoot, strict = false } = {}) {
  const errors = [];
  const profile = await readProfile(target);
  const profileProvenance = await validateProfileSources(target, packageRoot);
  const provenanceErrors = profileProvenance.errors ?? [];
  errors.push(...provenanceErrors);
  const contract = await loadContract(target, packageRoot, errors);
  const route = await loadRoute(target, packageRoot, errors);
  const config = await optionalConfig(target, packageRoot, errors);
  const effectiveStrict = strict || config.complianceMode === "strict";
  if (effectiveStrict && profile.status !== "verified") {
    errors.push(issue("E_PROFILE_UNVERIFIED", "Strict preflight requires a verified project profile", [PROFILE_PATH]));
  }
  const unresolvedDecisions = contract?.value?.unresolvedDecisions ?? [];
  if (unresolvedDecisions.length > 0) {
    errors.push(issue(
      "E_CONTRACT_UNRESOLVED_DECISION",
      "The current contract contains unresolved blocking decisions.",
      [ARTIFACT_PATHS.contract],
      {
        decisions: unresolvedDecisions
          .slice(0, PREVIEW_DECISION_LIMIT)
          .map((decision) => decision.slice(0, PREVIEW_DECISION_MAX_LENGTH)),
        decisionCount: unresolvedDecisions.length,
        ...(unresolvedDecisions.length > PREVIEW_DECISION_LIMIT ? { decisionsTruncated: true } : {}),
        next: "Resolve the blocking decision with the user or applicable authority, update current-contract.json, then rerun preflight.",
      },
    ));
  }

  if (route && contract) {
    assertRouteInvariants(route.value);
    if (route.value.contractFingerprint !== undefined && route.value.contractFingerprint !== contract.fingerprint) {
      errors.push(issue("E_ROUTE_STALE", "Routing result was created for a different contract", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.contract]));
    }
  }

  const sources = await loadSources(target, contract, packageRoot, errors);
  const gates = await inspectGates(target, contract, route, packageRoot, errors, config);

  let state = null;
  try {
    state = await readWorkState(target, packageRoot);
  } catch (error) {
    errors.push(issue("E_STATE_INVALID", error.message, [ARTIFACT_PATHS.state]));
  }
  if (state && route && JSON.stringify(state.selectedGuides) !== JSON.stringify(route.value.guides)) {
    errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "work-state.selectedGuides must equal routing-result.guides", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.state]));
  }
  if (state && contract && state.contractFingerprint !== contract.fingerprint) {
    errors.push(issue("E_CONTRACT_STALE", "work-state references a different contract", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.state]));
  }

  const sortedErrors = sortIssues(errors);
  const taskId = contract?.value?.taskId ?? state?.taskId ?? "unknown";
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    status: sortedErrors.length === 0 ? "READY" : "BLOCKED",
    profile: { ...profile, provenance: profileProvenance.status },
    contract: contract
      ? { status: "valid", fingerprint: contract.fingerprint }
      : { status: "missing", fingerprint: null },
    routing: route
      ? { status: "valid", fingerprint: route.fingerprint, guides: [...route.value.guides] }
      : { status: "missing", fingerprint: null, guides: [] },
    requiredGates: gates.required,
    satisfiedGates: gates.satisfied,
    errors: sortedErrors,
    fingerprints: {
      contract: contract?.fingerprint ?? null,
      routing: route?.fingerprint ?? null,
      profile: profile.fingerprint,
    },
    ...(config.policy ? {
      policy: {
        name: config.policy,
        complianceMode: config.complianceMode,
        requiredGates: [...(config.requiredGates ?? [])],
        requiredEvidence: [...(config.requiredEvidence ?? [])],
      },
    } : {}),
    ...(sources ? { sources: { status: "valid", fingerprint: null } } : {}),
  };
}

async function readOptionalIdentityArtifact(readArtifact, invalidCode, artifactPath) {
  try {
    return await readArtifact();
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    throw preflightError(invalidCode, error.message, [artifactPath]);
  }
}

async function assertPreflightPersistenceSafety(target, packageRoot, taskId) {
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
  if (state) {
    if (contract || route) assertStateIdentity({ contract, route, state });
  }

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

const PREFLIGHT_IDENTITY_BARRIER_CODES = new Set([
  "E_CONTRACT_STALE",
  "E_GATE_TASK_MISMATCH",
  "E_ROUTE_STALE",
  "E_STATE_TASK_MISMATCH",
  "E_ROUTE_GUIDE_MISMATCH",
]);

function assertPreflightResultPersistenceSafety(result) {
  const identityError = result.errors.find((error) => PREFLIGHT_IDENTITY_BARRIER_CODES.has(error.code));
  if (identityError) {
    throw preflightError(identityError.code, identityError.message, identityError.artifacts);
  }
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
} = {}) {
  if (persisted?.status !== "READY") return [];
  const result = current ?? await evaluatePreflight({ target, packageRoot });
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
      errors.push(issue(
        "E_STATE_TASK_MISMATCH",
        "The resumable checkpoint does not belong to the READY preflight task",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.preflight],
      ));
    }
    if (state.contractFingerprint !== result.fingerprints.contract) {
      errors.push(issue(
        "E_CONTRACT_STALE",
        "The resumable checkpoint does not match the READY contract fingerprint",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract],
      ));
    }
    if (state.routeFingerprint !== result.fingerprints.routing) {
      errors.push(issue(
        "E_ROUTE_STALE",
        "The resumable checkpoint does not match the READY routing fingerprint",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
      ));
    }
    if (JSON.stringify(state.selectedGuides) !== JSON.stringify(result.routing.guides)) {
      errors.push(issue(
        "E_ROUTE_GUIDE_MISMATCH",
        "The resumable checkpoint guides do not match the READY routing result",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
      ));
    }
    if (!sameStringSet(state.requiredGates ?? [], persisted.requiredGates)
      || !sameStringSet(state.satisfiedGates ?? [], persisted.satisfiedGates)) {
      errors.push(issue(
        "E_PREFLIGHT_GATES_STALE",
        "The resumable checkpoint gate sets do not match the READY preflight",
        [ARTIFACT_PATHS.state, ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.gates],
      ));
    }
  }

  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    errors.push(...ledger.errors.map((error) => issue(
      error.code ?? "E_EVENT_INVALID",
      error.message,
      [ARTIFACT_PATHS.events],
    )));
  }
  const events = ledger.events ?? [];
  for (const requiredEvent of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED"]) {
    if (!events.some((event) => event.event === requiredEvent && event.taskId === persisted.taskId)) {
      errors.push(issue(
        "E_PREFLIGHT_EVENT_MISSING",
        `READY preflight is missing lifecycle event: ${requiredEvent}`,
        [ARTIFACT_PATHS.events, ARTIFACT_PATHS.preflight],
      ));
    }
  }
  for (const gate of persisted.satisfiedGates ?? []) {
    if (!events.some((event) => event.event === "GATE_SATISFIED"
      && event.taskId === persisted.taskId
      && event.details?.gate === gate)) {
      errors.push(issue(
        "E_PREFLIGHT_GATE_EVENT_MISSING",
        `READY preflight is missing lifecycle gate event: ${gate}`,
        [ARTIFACT_PATHS.events, `${ARTIFACT_PATHS.gates}/${gate}.json`],
      ));
    }
  }
  const readyEvents = events.filter((event) => event.event === "PREFLIGHT_READY" && event.taskId === persisted.taskId);
  if (readyEvents.length === 0) {
    errors.push(issue(
      "E_PREFLIGHT_READY_EVENT_MISSING",
      "Persisted READY preflight is missing the matching PREFLIGHT_READY lifecycle event",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events],
    ));
  } else if (!readyEvents.some((event) => sameReadyPreflightEvent(event, result))) {
    errors.push(issue(
      "E_PREFLIGHT_READY_EVENT_MISMATCH",
      "PREFLIGHT_READY lifecycle details do not match the persisted READY preflight",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events],
    ));
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

function assertExistingReadyLifecycleCompatibility(ledger, result) {
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

async function appendActivationEvents(target, packageRoot, ledger, result) {
  const events = [...(ledger?.events ?? [])];
  const hasEvent = (eventName) => events.some((event) => event.event === eventName && event.taskId === result.taskId);
  const append = async (input) => {
    const event = await appendProtocolEvent(target, input, packageRoot);
    events.push(event);
  };

  if (events.length === 0) {
    await append({ taskId: result.taskId, event: "TASK_RECEIVED" });
  }
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

export async function runPreflight({ target, packageRoot, strict = false, persist = true } = {}) {
  let result = await evaluatePreflight({ target, packageRoot, strict });
  if (!persist) return result;

  let ledger = await assertPreflightPersistenceSafety(target, packageRoot, result.taskId);
  assertPreflightResultPersistenceSafety(result);
  assertExistingReadyLifecycleCompatibility(ledger, result);

  let contract = null;
  let route = null;
  if (result.contract.status === "valid" && result.routing.status === "valid") {
    contract = await readContract(target, packageRoot);
    route = await readPersistedRoute(target, packageRoot);
    const state = await ensureResumableState({ target, packageRoot, contract, route });
    if (state) {
      await synchronizePreflightState({
        target,
        packageRoot,
        state,
        contract,
        route,
        requiredGates: result.requiredGates,
        satisfiedGates: result.satisfiedGates,
        complianceMode: result.policy?.complianceMode,
      });
      result = await evaluatePreflight({ target, packageRoot, strict });
      assertPreflightResultPersistenceSafety(result);
      assertExistingReadyLifecycleCompatibility(ledger, result);
      ledger = await assertPreflightPersistenceSafety(target, packageRoot, result.taskId);
    }
  }

  if (result.taskId !== "unknown") {
    await appendActivationEvents(target, packageRoot, ledger, result);
    const afterEvents = await validateEventLedger(target, packageRoot);
    if (!afterEvents.valid) {
      const first = afterEvents.errors[0];
      throw preflightError(first.code, first.message, [ARTIFACT_PATHS.events]);
    }
  }
  await writeJsonArtifact(target, ARTIFACT_PATHS.preflight, result, "preflight", packageRoot);
  return result;
}
