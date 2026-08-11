import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import {
  assertSafePath,
  ensureWithin,
  fileExists,
  readBytes,
  writeFileAtomic,
} from "./filesystem.js";
import { GUIDE_IDS, PROTOCOL_VERSION, assertFailureClass, assertWorkPhase, isValidTransition } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { getPackageRoot } from "./templates.js";
import { currentRepositoryFingerprint } from "./repository.js";
import { createEvidence } from "./evidence.js";
import { assertJsonBytes } from "./json-safety.js";

export const WORK_STATE_PATH = ".forgeloop/work-state.json";

export class WorkStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkStateError";
    this.code = "STALE_STATE_FAILURE";
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function contractFingerprint(contract) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(contract)))
    .digest("hex");
}

function assertFingerprint(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new WorkStateError(`${label} must be a lowercase SHA-256 fingerprint`);
  }
}

function normalizeArtifactPath(value) {
  if (typeof value !== "string" || !value) {
    throw new WorkStateError("requiredArtifacts.path must be a non-empty relative path");
  }
  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable)) {
    throw new WorkStateError(`requiredArtifacts.path must remain relative: ${value}`);
  }
  const normalized = path.posix.normalize(portable);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new WorkStateError(`requiredArtifacts.path escapes the task target: ${value}`);
  }
  return normalized.replace(/^\.\//, "");
}

function normalizeRequiredArtifacts(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new WorkStateError("requiredArtifacts must be an array");
  const artifacts = value.map((artifact) => {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new WorkStateError("requiredArtifacts entries must be objects");
    }
    const normalized = {
      path: normalizeArtifactPath(artifact.path),
      sha256: artifact.sha256,
    };
    assertFingerprint(normalized.sha256, `requiredArtifacts.${normalized.path}.sha256`);
    return normalized;
  });
  if (new Set(artifacts.map((artifact) => artifact.path)).size !== artifacts.length) {
    throw new WorkStateError("requiredArtifacts must not contain duplicate paths");
  }
  return artifacts.sort((left, right) => left.path.localeCompare(right.path));
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new WorkStateError(`${label} must be an array of non-empty strings`);
  }
}

export function assertWorkStateSemantics(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new WorkStateError("Work state must be a JSON object");
  }
  if (state.schemaVersion !== 1 || state.protocolVersion !== PROTOCOL_VERSION) {
    throw new WorkStateError("Unsupported work-state protocol version");
  }
  if (typeof state.taskId !== "string" || !state.taskId) {
    throw new WorkStateError("Work state taskId is required");
  }
  assertFingerprint(state.contractFingerprint, "contractFingerprint");
  if (!state.repositoryFingerprint || typeof state.repositoryFingerprint !== "object" || Array.isArray(state.repositoryFingerprint)) {
    throw new WorkStateError("repositoryFingerprint is required");
  }
  for (const key of ["branch", "head"]) {
    if (state.repositoryFingerprint[key] !== null && typeof state.repositoryFingerprint[key] !== "string") {
      throw new WorkStateError(`repositoryFingerprint.${key} must be a string or null`);
    }
  }
  assertWorkPhase(state.phase);
  assertStringArray(state.selectedGuides, "selectedGuides");
  if (state.selectedGuides.some((guide) => !GUIDE_IDS.includes(guide))) {
    throw new WorkStateError("Work state contains an unknown guide");
  }
  if (new Set(state.selectedGuides).size !== state.selectedGuides.length) {
    throw new WorkStateError("selectedGuides must not contain duplicates");
  }
  assertStringArray(state.completedSteps, "completedSteps");
  assertStringArray(state.pendingSteps, "pendingSteps");
  normalizeRequiredArtifacts(state.requiredArtifacts);
  for (const key of ["checks", "failures", "blockers", "verificationEvidence"]) {
    if (!Array.isArray(state[key])) throw new WorkStateError(`${key} must be an array`);
  }
  if (state.phase === "COMPLETE" && state.verificationEvidence.length === 0) {
    throw new WorkStateError("COMPLETE requires verification evidence");
  }
  if (state.phase === "BLOCKED" && state.blockers.length === 0) {
    throw new WorkStateError("BLOCKED requires a blocker");
  }
  if (state.phase === "CORRECTING" && (typeof state.diagnosedHypothesis !== "string" || !state.diagnosedHypothesis)) {
    throw new WorkStateError("CORRECTING requires a diagnosed hypothesis");
  }
  if (state.previousPhase !== undefined) {
    if (!isValidTransition(state.previousPhase, state.phase)) {
      throw new WorkStateError(`Invalid work-state transition: ${state.previousPhase} -> ${state.phase}`);
    }
  }
  for (const failure of state.failures) {
    if (failure?.failureClass !== undefined) assertFailureClass(failure.failureClass);
  }
  assertSecretFree(state);
  return state;
}

export function createWorkState(input) {
  assertSecretFree(input);
  const state = {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    contractFingerprint: input.contractFingerprint,
    repositoryFingerprint: input.repositoryFingerprint ?? { branch: null, head: null },
    phase: input.phase,
    selectedGuides: [...(input.selectedGuides ?? [])],
    completedSteps: [...(input.completedSteps ?? [])],
    pendingSteps: [...(input.pendingSteps ?? [])],
    requiredArtifacts: normalizeRequiredArtifacts(input.requiredArtifacts),
    checks: [...(input.checks ?? [])],
    failures: [...(input.failures ?? [])],
    blockers: [...(input.blockers ?? [])],
    verificationEvidence: [...(input.verificationEvidence ?? [])],
    lastUpdated: input.lastUpdated ?? new Date().toISOString(),
  };
  if (input.previousPhase !== undefined) state.previousPhase = input.previousPhase;
  if (input.diagnosedHypothesis !== undefined) state.diagnosedHypothesis = input.diagnosedHypothesis;
  return assertWorkStateSemantics(state);
}

async function validateStoredState(state, packageRoot = getPackageRoot()) {
  const schema = await readSchema("work-state", packageRoot);
  assertSchema(state, schema, "work state");
  return assertWorkStateSemantics(state);
}

export async function readWorkState(target, packageRoot = getPackageRoot()) {
  await assertSafePath(target, WORK_STATE_PATH);
  const statePath = ensureWithin(target, WORK_STATE_PATH);
  if (!(await fileExists(statePath))) return null;
  let state;
  try {
    const bytes = await readBytes(statePath);
    assertJsonBytes(bytes, WORK_STATE_PATH);
    state = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new WorkStateError(`Unable to parse ${WORK_STATE_PATH}: ${error.message}`);
  }
  try {
    return await validateStoredState(state, packageRoot);
  } catch (error) {
    if (error instanceof WorkStateError) throw error;
    throw new WorkStateError(error.message);
  }
}

export async function readContractFingerprint(target, contractFile) {
  await assertSafePath(target, contractFile);
  const contractPath = ensureWithin(target, contractFile);
  let contract;
  try {
    const bytes = await readBytes(contractPath);
    assertJsonBytes(bytes, contractFile);
    contract = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new WorkStateError(`Unable to parse contract ${contractFile}: ${error.message}`);
  }
  return { path: contractFile, fingerprint: contractFingerprint(contract) };
}

export async function writeWorkState(target, state, { dryRun = false, packageRoot = getPackageRoot() } = {}) {
  await validateStoredState(state, packageRoot);
  await assertSafePath(target, WORK_STATE_PATH);
  const statePath = ensureWithin(target, WORK_STATE_PATH);
  await writeFileAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`, { dryRun });
  return state;
}

export async function clearWorkState(target) {
  await assertSafePath(target, WORK_STATE_PATH);
  const statePath = ensureWithin(target, WORK_STATE_PATH);
  if (!(await fileExists(statePath))) return { removed: false, path: WORK_STATE_PATH };
  await unlink(statePath);
  return { removed: true, path: WORK_STATE_PATH };
}

export async function readRequiredArtifactFingerprints(target, artifacts) {
  const normalized = normalizeRequiredArtifacts(artifacts);
  const current = [];
  for (const artifact of normalized) {
    await assertSafePath(target, artifact.path);
    const artifactPath = ensureWithin(target, artifact.path);
    if (!(await fileExists(artifactPath))) {
      current.push({ path: artifact.path, sha256: null, status: "missing" });
      continue;
    }
    current.push({
      path: artifact.path,
      sha256: createHash("sha256").update(await readBytes(artifactPath)).digest("hex"),
      status: "present",
    });
  }
  return current;
}

function normalizeClassificationInput(currentInput = {}) {
  if (!currentInput || typeof currentInput !== "object" || Array.isArray(currentInput)) {
    return { repositoryFingerprint: { branch: null, head: null } };
  }
  const isOptions = Object.prototype.hasOwnProperty.call(currentInput, "repositoryFingerprint")
    || Object.prototype.hasOwnProperty.call(currentInput, "contractFingerprint")
    || Object.prototype.hasOwnProperty.call(currentInput, "requiredArtifacts")
    || Object.prototype.hasOwnProperty.call(currentInput, "maxAgeMs")
    || Object.prototype.hasOwnProperty.call(currentInput, "now");
  if (isOptions) {
    return {
      repositoryFingerprint: currentInput.repositoryFingerprint ?? { branch: null, head: null },
      contractFingerprint: currentInput.contractFingerprint,
      requiredArtifacts: currentInput.requiredArtifacts,
      maxAgeMs: currentInput.maxAgeMs,
      now: currentInput.now,
    };
  }
  return { repositoryFingerprint: currentInput };
}

export function classifyWorkState(state, currentInput = {}) {
  if (!state) return { status: "ABSENT", reasons: ["NO_CHECKPOINT"] };
  const current = normalizeClassificationInput(currentInput);
  const reasons = [];
  const warnings = [];
  const saved = state.repositoryFingerprint;
  const repositoryFingerprint = current.repositoryFingerprint ?? { branch: null, head: null };
  const repositoryUnavailable = saved.branch === null
    && saved.head === null
    && repositoryFingerprint.branch === null
    && repositoryFingerprint.head === null;
  const repositoryComparison = repositoryUnavailable
    ? "NOT_VERIFIED"
    : saved.branch !== repositoryFingerprint.branch || saved.head !== repositoryFingerprint.head
      ? "MISMATCH"
      : "MATCH";
  if (repositoryComparison === "MISMATCH") {
    reasons.push("REPOSITORY_CHANGED");
  }

  let contractComparison = "NOT_VERIFIED";
  if (typeof current.contractFingerprint === "string") {
    contractComparison = state.contractFingerprint === current.contractFingerprint ? "MATCH" : "MISMATCH";
    if (contractComparison === "MISMATCH") reasons.push("CONTRACT_CHANGED");
  } else {
    reasons.push("CONTRACT_NOT_VERIFIED");
  }

  const savedArtifacts = normalizeRequiredArtifacts(state.requiredArtifacts);
  let artifactComparison = "NOT_APPLICABLE";
  if (savedArtifacts.length > 0) {
    if (!Array.isArray(current.requiredArtifacts)) {
      artifactComparison = "NOT_VERIFIED";
      reasons.push("REQUIRED_ARTIFACTS_NOT_VERIFIED");
    } else {
      const currentArtifacts = new Map(current.requiredArtifacts.map((artifact) => [artifact.path, artifact]));
      const missing = savedArtifacts.some((artifact) => !currentArtifacts.has(artifact.path)
        || currentArtifacts.get(artifact.path)?.sha256 === null
        || currentArtifacts.get(artifact.path)?.status === "missing");
      const changed = savedArtifacts.some((artifact) => currentArtifacts.get(artifact.path)?.sha256 !== artifact.sha256);
      if (missing) {
        artifactComparison = "MISSING";
        reasons.push("REQUIRED_ARTIFACT_MISSING");
      } else if (changed) {
        artifactComparison = "MISMATCH";
        reasons.push("REQUIRED_ARTIFACT_CHANGED");
      } else {
        artifactComparison = "MATCH";
      }
    }
  }

  const now = current.now ?? Date.now();
  const updatedAt = Date.parse(state.lastUpdated);
  let stateAgeMs = null;
  if (Number.isFinite(updatedAt) && Number.isFinite(now) && now >= updatedAt) {
    stateAgeMs = now - updatedAt;
    if (Number.isFinite(current.maxAgeMs) && current.maxAgeMs >= 0 && stateAgeMs > current.maxAgeMs) {
      warnings.push("CHECKPOINT_OLD");
    }
  }
  return {
    status: reasons.length > 0 ? "REVALIDATION_REQUIRED" : "FRESH",
    reasons,
    warnings,
    repositoryComparison,
    contractComparison,
    artifactComparison,
    stateAgeMs,
    state,
  };
}

export async function classifyLoadedWorkState({ target, state, contractFile = null, maxAgeMs } = {}) {
  const repository = await currentRepositoryFingerprint(target);

  let contract = null;
  let contractError = null;
  if (contractFile) {
    try {
      contract = await readContractFingerprint(target, contractFile);
    } catch (error) {
      contractError = error.message;
    }
  }

  let currentArtifacts;
  let artifactError = null;
  if ((state.requiredArtifacts ?? []).length > 0) {
    try {
      currentArtifacts = await readRequiredArtifactFingerprints(target, state.requiredArtifacts);
    } catch (error) {
      artifactError = error.message;
    }
  } else {
    currentArtifacts = [];
  }

  const classification = classifyWorkState(state, {
    repositoryFingerprint: repository,
    contractFingerprint: contract?.fingerprint,
    requiredArtifacts: currentArtifacts,
    maxAgeMs,
  });
  if (contractError) {
    classification.contractComparison = "INVALID";
    classification.reasons = classification.reasons.filter((reason) => reason !== "CONTRACT_NOT_VERIFIED");
    classification.reasons.push("CONTRACT_INVALID");
  }
  if (artifactError) {
    classification.artifactComparison = "NOT_VERIFIED";
    classification.reasons.push("REQUIRED_ARTIFACTS_NOT_VERIFIED");
  }
  classification.reasons = [...new Set(classification.reasons)];
  return {
    ...classification,
    repository,
    error: contractError ?? artifactError,
    contract: {
      path: contractFile,
      status: contractError ? "INVALID" : contract ? "OBSERVED" : "NOT_VERIFIED",
    },
    evidence: [
      createEvidence({
        kind: classification.repositoryComparison === "NOT_VERIFIED" ? "NOT_VERIFIED" : "OBSERVED",
        source: "repository fingerprint",
        result: classification.repositoryComparison,
      }),
      createEvidence({
        kind: classification.contractComparison === "NOT_VERIFIED" ? "NOT_VERIFIED" : "OBSERVED",
        source: contractFile ?? "current contract",
        result: classification.contractComparison,
      }),
      ...(classification.artifactComparison !== "NOT_APPLICABLE"
        ? [createEvidence({
          kind: classification.artifactComparison === "NOT_VERIFIED" ? "NOT_VERIFIED" : "OBSERVED",
          source: "required artifacts",
          result: classification.artifactComparison,
        })]
        : []),
    ],
  };
}

export async function readAndClassifyWorkState({ target, packageRoot = getPackageRoot(), contractFile = null, maxAgeMs } = {}) {
  let state = null;
  try {
    state = await readWorkState(target, packageRoot);
  } catch (error) {
    return {
      path: WORK_STATE_PATH,
      present: true,
      status: "INVALID",
      reasons: ["STATE_INVALID"],
      warnings: [],
      error: error.message,
      state: null,
      phase: null,
      completed: [],
      pending: [],
      repository: await currentRepositoryFingerprint(target),
      contractComparison: "NOT_VERIFIED",
      artifactComparison: "NOT_VERIFIED",
      contract: { path: contractFile, status: "NOT_VERIFIED" },
      evidence: [createEvidence({ kind: "BLOCKED", source: WORK_STATE_PATH, result: error.message })],
    };
  }

  if (!state) {
    const repository = await currentRepositoryFingerprint(target);
    return {
      path: WORK_STATE_PATH,
      present: false,
      status: "ABSENT",
      reasons: ["NO_CHECKPOINT"],
      warnings: [],
      error: null,
      state: null,
      phase: null,
      completed: [],
      pending: [],
      repository,
      contractComparison: "NOT_VERIFIED",
      artifactComparison: "NOT_APPLICABLE",
      contract: { path: contractFile, status: contractFile ? "NOT_USED" : "NOT_VERIFIED" },
      evidence: [createEvidence({
        kind: "NOT_VERIFIED",
        source: WORK_STATE_PATH,
        result: "No work-state checkpoint is present",
      })],
    };
  }

  const classification = await classifyLoadedWorkState({ target, state, contractFile, maxAgeMs });
  return {
    path: WORK_STATE_PATH,
    present: true,
    ...classification,
    phase: state.phase,
    completed: state.completedSteps,
    pending: state.pendingSteps,
  };
}

export { currentRepositoryFingerprint };
