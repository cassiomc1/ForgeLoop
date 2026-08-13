import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { readGateIfPresent, validateGateArtifacts } from "./gate-artifact.js";
import { requiredGatesForGuides } from "./guide-metadata.js";
import { assertRouteInvariants } from "./router.js";
import { assertSourceProvenance } from "./sources.js";
import { readPersistedRoute } from "./route-artifact.js";
import { appendProtocolEvent, LIFECYCLE_MILESTONES, validateEventLedger } from "./events.js";
import { readWorkState } from "./work-state.js";
import { readConfig } from "./config.js";
import { assertSafePath, ensureWithin, fileExists, readBytes } from "./filesystem.js";
import { sha256 } from "./manifest.js";
import { validateProfileSources } from "./profile.js";
import { assertStateIdentity } from "./completion-relationships.js";

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
  const relativePath = "PROJECT_PROFILE.md";
  await assertSafePath(target, relativePath);
  const filePath = ensureWithin(target, relativePath);
  if (!(await fileExists(filePath))) return { status: "missing", fingerprint: null };
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
    errors.push(issue("E_PROFILE_UNVERIFIED", "Strict preflight requires a verified project profile", ["PROJECT_PROFILE.md"]));
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

function planReadyPreflightLifecycleWrite(ledger, result) {
  if (!ledger) return { appendEvents: false };
  const existing = ledger.events.find((event) => event.event === "PREFLIGHT_READY");
  if (existing) {
    if (sameReadyPreflightEvent(existing, result)) return { appendEvents: false };
    throw preflightError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "PREFLIGHT_READY already exists with different READY preflight details; repair the contract, route, or gate lifecycle before refreshing preflight",
      [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events, ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route, ARTIFACT_PATHS.gates],
    );
  }
  const lastMilestone = ledger.events.reduce(
    (last, event) => Math.max(last, LIFECYCLE_MILESTONES.indexOf(event.event)),
    -1,
  );
  const routeMilestone = LIFECYCLE_MILESTONES.indexOf("ROUTE_VALIDATED");
  const preflightMilestone = LIFECYCLE_MILESTONES.indexOf("PREFLIGHT_READY");
  if (lastMilestone < routeMilestone) return { appendEvents: false };
  if (lastMilestone !== preflightMilestone - 1) {
    throw preflightError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "PREFLIGHT_READY cannot be appended after the current lifecycle ledger",
      [ARTIFACT_PATHS.events],
    );
  }
  return { appendEvents: true };
}

export async function runPreflight({ target, packageRoot, strict = false, persist = true } = {}) {
  const result = await evaluatePreflight({ target, packageRoot, strict });
  if (persist) {
    const ledger = await assertPreflightPersistenceSafety(target, packageRoot, result.taskId);
    assertPreflightResultPersistenceSafety(result);
    const lifecycleWrite = result.status === "READY"
      ? planReadyPreflightLifecycleWrite(ledger, result)
      : { appendEvents: true };
    await writeJsonArtifact(target, ARTIFACT_PATHS.preflight, result, "preflight", packageRoot);
    if (result.taskId !== "unknown" && lifecycleWrite.appendEvents) {
      for (const gate of result.satisfiedGates) {
        await appendProtocolEvent(target, {
          taskId: result.taskId,
          event: "GATE_SATISFIED",
          details: { gate },
        }, packageRoot);
      }
      await appendProtocolEvent(target, {
        taskId: result.taskId,
        event: result.status === "READY" ? "PREFLIGHT_READY" : "PREFLIGHT_BLOCKED",
        fingerprint: result.fingerprints.contract ?? undefined,
        details: {
          requiredGates: result.requiredGates,
          satisfiedGates: result.satisfiedGates,
          routingFingerprint: result.fingerprints.routing,
        },
      }, packageRoot);
    }
  }
  return result;
}
