import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";

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

export const WORK_STATE_PATH = ".mdfiles/work-state.json";

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
  if (!state.repositoryFingerprint || typeof state.repositoryFingerprint !== "object") {
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
    state = JSON.parse((await readBytes(statePath)).toString("utf8"));
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

export function classifyWorkState(state, currentFingerprint) {
  if (!state) return { status: "ABSENT", reasons: ["NO_CHECKPOINT"] };
  const reasons = [];
  const saved = state.repositoryFingerprint;
  if (saved.branch !== currentFingerprint.branch || saved.head !== currentFingerprint.head) {
    reasons.push("REPOSITORY_CHANGED");
  }
  return {
    status: reasons.length > 0 ? "REVALIDATION_REQUIRED" : "FRESH",
    reasons,
    state,
  };
}

export { currentRepositoryFingerprint };
