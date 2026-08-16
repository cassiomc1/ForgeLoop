import { ARTIFACT_PATHS, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { assertRouteInvariants } from "./router.js";
import { validateProfileSources } from "./profile.js";
import { readWorkState } from "./work-state.js";
import { ensureResumableState, synchronizePreflightState } from "./preflight-consistency.js";
import {
  issue,
  preflightError,
  sortIssues,
  validatePersistedPreflight,
} from "./preflight-model.js";
import {
  loadContract,
  loadRoute,
  loadSources,
  inspectGates,
  optionalConfig,
  readProfile,
} from "./preflight-loaders.js";
import {
  appendActivationEvents,
  assertExistingReadyLifecycleCompatibility,
  assertPreflightPersistenceSafety,
  assertPreflightResultPersistenceSafety,
  validateReadyProtocolConsistency as validateReadyProtocolConsistencyCore,
} from "./preflight-consistency.js";
import { PROFILE_PATH } from "./target-layout.js";
import { readPersistedRoute } from "./route-artifact.js";
import { validateEventLedger } from "./events.js";

const PREVIEW_DECISION_LIMIT = 10;
const PREVIEW_DECISION_MAX_LENGTH = 240;

export { validatePersistedPreflight } from "./preflight-model.js";

export async function evaluatePreflight({ target, packageRoot, strict = false } = {}) {
  const errors = [];
  const profile = await readProfile(target);
  const profileProvenance = await validateProfileSources(target, packageRoot);
  errors.push(...(profileProvenance.errors ?? []));
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

export async function validateReadyProtocolConsistency(options = {}) {
  return validateReadyProtocolConsistencyCore({
    ...options,
    evaluateCurrentPreflight: evaluatePreflight,
  });
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
