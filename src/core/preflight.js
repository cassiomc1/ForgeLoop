import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { readGateIfPresent, validateGateArtifacts } from "./gate-artifact.js";
import { requiredGatesForGuides } from "./guide-metadata.js";
import { assertRouteInvariants } from "./router.js";
import { assertSourceProvenance } from "./sources.js";
import { readPersistedRoute } from "./route-artifact.js";
import { appendProtocolEvent } from "./events.js";
import { readWorkState } from "./work-state.js";
import { readConfig } from "./config.js";
import { assertSafePath, ensureWithin, fileExists, readBytes } from "./filesystem.js";
import { sha256 } from "./manifest.js";
import { validateProfileSources } from "./profile.js";

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

export async function runPreflight({ target, packageRoot, strict = false, persist = true } = {}) {
  const result = await evaluatePreflight({ target, packageRoot, strict });
  if (persist) {
    await writeJsonArtifact(target, ARTIFACT_PATHS.preflight, result, "preflight", packageRoot);
    if (result.taskId !== "unknown") {
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
        },
      }, packageRoot);
    }
  }
  return result;
}
