import {
  ARTIFACT_PATHS,
  canonicalFingerprint,
  readJsonArtifact,
  writeJsonArtifact,
} from "./artifacts.js";
import { readContract } from "./contract.js";
import { appendProtocolEvent } from "./events.js";
import { completionEvidenceForGuides } from "./guide-metadata.js";
import { createCheck } from "./checks.js";
import { createEvidence } from "./evidence.js";
import { coverageForRequirements } from "./coverage.js";
import { evaluatePreflight } from "./preflight.js";
import { currentChangedPaths } from "./repository.js";
import { readPersistedRoute } from "./route-artifact.js";
import { createReceipt, validateReceipt } from "./receipt.js";
import { readWorkState, writeWorkState } from "./work-state.js";

function artifactError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw artifactError("E_CHECK_INVALID", `${label} must be a non-empty string`);
  }
  return value;
}

async function readCurrentReceipt(target, packageRoot) {
  try {
    return await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") {
      throw artifactError(
        "E_RECEIPT_MISSING",
        "Execution receipt is missing; run forgeloop prepare-completion first",
        [ARTIFACT_PATHS.receipt],
      );
    }
    throw error;
  }
}

async function readOptionalConfig(target, packageRoot) {
  try {
    return (await readJsonArtifact(target, ARTIFACT_PATHS.config, "config", packageRoot)).value;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return {};
    throw error;
  }
}

export async function requiredEvidenceForTarget({ target, contract, route, packageRoot, additionalEvidence = [] }) {
  const config = await readOptionalConfig(target, packageRoot);
  const guideEvidence = await completionEvidenceForGuides(route.value.guides, packageRoot);
  return [...new Set([
    ...(contract.value.successCriteria ?? []),
    ...guideEvidence,
    ...(config.requiredEvidence ?? []),
    ...additionalEvidence,
  ])].sort();
}

export async function prepareCompletion({ target, packageRoot }) {
  const contract = await readContract(target, packageRoot);
  const route = await readPersistedRoute(target, packageRoot);
  const state = await readWorkState(target, packageRoot);
  if (!state) {
    throw artifactError("E_STATE_MISSING", "Work state is required before preparing completion", [ARTIFACT_PATHS.state]);
  }

  let existing = null;
  try {
    existing = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
    await validateReceipt(existing.value, packageRoot);
  } catch (error) {
    if (error.code !== "ARTIFACT_MISSING") throw error;
  }

  const preflight = await evaluatePreflight({ target, packageRoot });
  const requiredEvidence = await requiredEvidenceForTarget({
    target,
    contract,
    route,
    packageRoot,
    additionalEvidence: preflight.policy?.requiredEvidence ?? [],
  });
  const existingValue = existing?.value ?? {};
  const changedPaths = existing
    ? [...(existingValue.changedPaths ?? [])]
    : (await currentChangedPaths(target) ?? []);
  const checks = [...(existingValue.checks ?? [])];
  const receipt = await createReceipt({
    ...existingValue,
    taskId: contract.value.taskId,
    contractFingerprint: contract.fingerprint,
    routeFingerprint: route.fingerprint,
    ...(Object.hasOwn(existingValue, "stateFingerprint")
      ? { stateFingerprint: canonicalFingerprint(state) }
      : {}),
    status: existingValue.status ?? "in-progress",
    taskStatus: existingValue.taskStatus ?? "in-progress",
    verificationStatus: existingValue.verificationStatus ?? "not-verified",
    publicationStatus: existingValue.publicationStatus ?? "local-only",
    productionReadiness: existingValue.productionReadiness ?? "not-verified",
    selectedGuides: [...route.value.guides],
    changedPaths,
    checks,
    evidence: [...(existingValue.evidence ?? [])],
    evidenceCoverage: coverageForRequirements(requiredEvidence, checks),
    review: existingValue.review ?? { status: "not-run", independent: false },
    limitations: [...(existingValue.limitations ?? [])],
    publication: existingValue.publication ?? {
      committed: false,
      pushed: false,
      pullRequest: null,
      deployed: false,
    },
  }, packageRoot);
  const written = await writeJsonArtifact(
    target,
    ARTIFACT_PATHS.receipt,
    receipt,
    "execution-receipt",
    packageRoot,
  );
  return {
    path: written.path,
    receipt: written.value,
    requiredEvidence,
    changedPaths,
  };
}

function mergeByCheckId(checks, nextCheck) {
  const next = [...checks];
  const index = next.findIndex((item) => item?.schemaVersion === 1 && item.id === nextCheck.id);
  if (index >= 0) next[index] = nextCheck;
  else next.push(nextCheck);
  return next;
}

function appendUniqueEvidence(evidence, nextEvidence) {
  const exists = evidence.some((item) => item.kind === nextEvidence.kind
    && item.source === nextEvidence.source
    && item.result === nextEvidence.result
    && JSON.stringify(item.details ?? null) === JSON.stringify(nextEvidence.details ?? null));
  return exists ? [...evidence] : [...evidence, nextEvidence];
}

export async function recordCheck({
  target,
  packageRoot,
  id,
  kind = "command",
  requirement,
  status,
  evidenceKind,
  command,
  result,
  exitCode,
  details,
}) {
  requiredString(id, "check id");
  requiredString(kind, "check kind");
  requiredString(requirement, "check requirement");
  requiredString(status, "check status");
  requiredString(evidenceKind, "evidence kind");
  if (command !== undefined && typeof command !== "string") {
    throw artifactError("E_CHECK_INVALID", "command must be a string when supplied");
  }
  if (result !== undefined && typeof result !== "string") {
    throw artifactError("E_CHECK_INVALID", "result must be a string when supplied");
  }
  if (details !== undefined && (!details || typeof details !== "object" || Array.isArray(details))) {
    throw artifactError("E_CHECK_INVALID", "check details must be a JSON object");
  }
  if ((typeof command !== "string" || command.trim() === "")
    && (typeof result !== "string" || result.trim() === "")) {
    throw artifactError("E_CHECK_INVALID", "record-check requires --command or --result");
  }

  const state = await readWorkState(target, packageRoot);
  if (!state) throw artifactError("E_STATE_MISSING", "Work state is required before recording a check", [ARTIFACT_PATHS.state]);
  if (["COMPLETE", "BLOCKED"].includes(state.phase)) {
    throw artifactError("E_PHASE_TRANSITION_INVALID", `Cannot record a check in ${state.phase}`, [ARTIFACT_PATHS.state]);
  }
  if (state.phase !== "VERIFYING") {
    throw artifactError(
      "E_PHASE_PREREQUISITE_MISSING",
      `record-check requires VERIFYING before review; found ${state.phase}`,
      [ARTIFACT_PATHS.state],
    );
  }

  const existingReceipt = await readCurrentReceipt(target, packageRoot);
  await validateReceipt(existingReceipt.value, packageRoot);
  const source = command?.trim() || `check:${id}`;
  const recordedResult = result?.trim() || `recorded command: ${command.trim()}`;
  const check = createCheck({
    id,
    kind,
    requirement,
    status,
    evidenceKind,
    source,
    ...(exitCode === undefined ? {} : { exitCode }),
    details: {
      ...(command === undefined ? {} : { command }),
      ...(result === undefined ? {} : { result }),
      ...(details === undefined ? {} : details),
    },
  });
  const evidence = createEvidence({
    kind: evidenceKind,
    source,
    result: recordedResult,
    ...(details === undefined ? {} : { details: structuredClone(details) }),
  });

  const checks = mergeByCheckId(existingReceipt.value.checks ?? [], check);
  const evidenceList = appendUniqueEvidence(existingReceipt.value.evidence ?? [], evidence);
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
  const coverage = coverageForRequirements(requiredEvidence, checks);
  const nextState = {
    ...state,
    checks,
    verificationEvidence: appendUniqueEvidence(state.verificationEvidence ?? [], evidence),
    evidenceCoverage: coverage,
    lastUpdated: new Date().toISOString(),
  };
  const nextReceipt = await createReceipt({
    ...existingReceipt.value,
    checks,
    evidence: evidenceList,
    evidenceCoverage: coverage,
    ...(Object.hasOwn(existingReceipt.value, "stateFingerprint")
      ? { stateFingerprint: canonicalFingerprint(nextState) }
      : {}),
  }, packageRoot);

  await writeWorkState(target, nextState, { packageRoot });
  const written = await writeJsonArtifact(
    target,
    ARTIFACT_PATHS.receipt,
    nextReceipt,
    "execution-receipt",
    packageRoot,
  );
  const event = await appendProtocolEvent(target, {
    taskId: state.taskId,
    event: "VERIFICATION_RECORDED",
    details: {
      checkId: check.id,
      requirement: check.requirement,
      status: check.status,
      evidenceKind: check.evidenceKind,
    },
  }, packageRoot);
  return {
    path: written.path,
    receipt: written.value,
    check,
    evidence,
    coverage,
    event,
  };
}
