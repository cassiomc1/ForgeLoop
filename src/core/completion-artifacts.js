import path from "node:path";
import {
  ARTIFACT_PATHS,
  canonicalFingerprint,
  readJsonArtifact,
  writeJsonArtifact,
} from "./artifacts.js";
import { readContract } from "./contract.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { completionEvidenceForGuides } from "./guide-metadata.js";
import { CHECK_PROVENANCE, createCheck } from "./checks.js";
import { createEvidence } from "./evidence.js";
import { coverageForRequirements } from "./coverage.js";
import { assertCompletionRelationships, assertStateIdentity } from "./completion-relationships.js";
import { evaluatePreflight } from "./preflight.js";
import { currentChangedPaths } from "./repository.js";
import { readPersistedRoute } from "./route-artifact.js";
import { createReceipt, validateReceipt } from "./receipt.js";
import { readWorkState, writeWorkState } from "./work-state.js";
import { assertExecutionPrerequisites, hasExecutionStarted } from "./execution-prerequisites.js";
import { normalizeRequirements, classifyRequirement } from "./evidence-readiness.js";
import { classifyCommandResolution, validateVerificationAuthority } from "./verification-capability.js";
import { readExecutionArtifact, validateExecutionBinding } from "./execution.js";

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

function formatArgv(argv) {
  return argv.map((argument) => /[\s"']/u.test(argument)
    ? JSON.stringify(argument)
    : argument).join(" ");
}

function commandProvenanceError(message = "Observed command evidence requires a ForgeLoop execution artifact") {
  return artifactError("E_COMMAND_PROVENANCE_UNATTESTED", message, [ARTIFACT_PATHS.receipt]);
}

/**
 * Revalidate the ForgeLoop-owned execution artifact behind an observed command
 * check. This is intentionally asynchronous so completion and audit can verify
 * the artifact instead of trusting duplicated check metadata.
 */
export async function validateCheckExecutionProvenance(check, {
  target,
  packageRoot,
  taskId,
  executionArtifacts,
  allowForeignCwd = false,
} = {}) {
  if (check?.kind !== "command" || check.evidenceKind !== "OBSERVED") return null;
  if (check.provenance !== "FORGELOOP_EXECUTED" || !check.executionRef) {
    throw commandProvenanceError();
  }
  const artifact = executionArtifacts
    ? { value: executionArtifacts[check.executionRef] }
    : await readExecutionArtifact({
      target,
      executionRef: check.executionRef,
      packageRoot,
    });
  if (!artifact.value) {
    throw artifactError(
      "E_EXECUTION_REF_INVALID",
      "Execution reference does not resolve to an execution artifact in this bundle",
      [ARTIFACT_PATHS.executionDirectory],
    );
  }
  const execution = validateExecutionBinding({
    execution: artifact.value,
    taskId,
    checkId: check.id,
    requirement: check.requirement,
    verificationCycle: check.details?.verificationCycle ?? 1,
  });
  if (!allowForeignCwd && path.resolve(execution.cwd) !== path.resolve(target)) {
    throw artifactError(
      "E_EXECUTION_REF_INVALID",
      "Execution artifact cwd does not match the current target",
      [ARTIFACT_PATHS.executionDirectory],
    );
  }
  if (check.status === "passed" && (execution.status !== "passed" || execution.exitCode !== 0)) {
    throw artifactError(
      "E_EXECUTION_REF_INVALID",
      "A passed command check must reference a successful execution artifact",
      [ARTIFACT_PATHS.executionDirectory],
    );
  }
  if (check.status === "failed" && execution.status !== "failed") {
    throw artifactError(
      "E_EXECUTION_REF_INVALID",
      "A failed command check must reference a failed execution artifact",
      [ARTIFACT_PATHS.executionDirectory],
    );
  }
  if (check.exitCode !== undefined && check.exitCode !== execution.exitCode) {
    throw artifactError(
      "E_EXECUTION_REF_INVALID",
      "Check exitCode does not match its execution artifact",
      [ARTIFACT_PATHS.executionDirectory],
    );
  }
  return execution;
}

export async function validateChecksExecutionProvenance(checks, options = {}) {
  const errors = [];
  for (const check of Array.isArray(checks) ? checks : []) {
    try {
      await validateCheckExecutionProvenance(check, options);
    } catch (error) {
      errors.push({
        code: error.code ?? "E_EXECUTION_REF_INVALID",
        message: error.message,
        artifacts: error.artifacts ?? [options.artifactPath ?? ARTIFACT_PATHS.receipt],
        checkId: check?.id,
        requirementId: check?.requirement,
      });
    }
  }
  return errors;
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

export async function prepareCompletion({ target, packageRoot, authorityContext, runtimeContext }) {
  const contract = await readContract(target, packageRoot);
  const route = await readPersistedRoute(target, packageRoot);
  const state = await readWorkState(target, packageRoot);
  if (!state) {
    throw artifactError("E_STATE_MISSING", "Work state is required before preparing completion", [ARTIFACT_PATHS.state]);
  }
  if (hasExecutionStarted(state.phase)) {
    await assertExecutionPrerequisites({ target, state, packageRoot });
  }

  let existing = null;
  try {
    existing = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
    await validateReceipt(existing.value, packageRoot, {
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
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
  if (existingValue.taskId && existingValue.taskId !== contract.value.taskId) {
    throw artifactError("E_RECEIPT_TASK_MISMATCH", "Execution receipt does not belong to the current contract task", [ARTIFACT_PATHS.receipt]);
  }
  if (existing && existingValue.stateFingerprint === undefined) {
    throw artifactError("E_RECEIPT_STATE_MISMATCH", "Execution receipt requires the current work-state fingerprint", [ARTIFACT_PATHS.receipt]);
  }
  assertStateIdentity({ contract, route, state });
  const observedPaths = await currentChangedPaths(target);
  const changedPaths = observedPaths !== null
    ? [...observedPaths]
    : existing
      ? [...(existingValue.changedPaths ?? [])]
      : [];
  const checks = existing ? [...existingValue.checks] : [...state.checks];
  const evidence = existing ? [...(existingValue.evidence ?? [])] : [...state.verificationEvidence];
  const receipt = await createReceipt({
    ...existingValue,
    taskId: contract.value.taskId,
    contractFingerprint: contract.fingerprint,
    routeFingerprint: route.fingerprint,
    stateFingerprint: canonicalFingerprint(state),
    verificationCycle: state.verificationCycle ?? 1,
    status: existingValue.status ?? "in-progress",
    taskStatus: existingValue.taskStatus ?? "in-progress",
    verificationStatus: existingValue.verificationStatus ?? "not-verified",
    publicationStatus: existingValue.publicationStatus ?? "local-only",
    productionReadiness: existingValue.productionReadiness ?? "not-verified",
    selectedGuides: [...route.value.guides],
    changedPaths,
    checks,
    evidence,
    evidenceCoverage: coverageForRequirements(requiredEvidence, checks, {
      target,
      taskId: contract.value.taskId,
      options: { authorityContext, runtimeContext },
    }),
    review: existingValue.review ?? { status: "not-run", independent: false },
    limitations: [...(existingValue.limitations ?? [])],
    publication: existingValue.publication ?? {
      committed: false,
      pushed: false,
      pullRequest: null,
      deployed: false,
    },
  }, packageRoot, {
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });
  assertCompletionRelationships({
    contract,
    route,
    state,
    receipt,
    requiredEvidence,
    requireRequiredChecks: false,
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });
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

/**
 * Read-only lifecycle checks shared by run-check and record-check. Keeping
 * these checks before process launch prevents a command from running when the
 * target is not ready to receive verification evidence.
 */
export async function assertRecordCheckPrerequisites({
  target,
  packageRoot,
  requirement,
  status,
  evidenceKind,
  authorityContext,
  runtimeContext,
} = {}) {
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
  await assertExecutionPrerequisites({ target, state, packageRoot });

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
  const requested = normalizeRequirements(requiredEvidence).find((item) => (
    item.id === requirement || item.text === requirement
  ));
  if (requested?.terminalOwned && status === "passed" && evidenceKind === "OBSERVED") {
    throw artifactError(
      "E_FUTURE_LIFECYCLE_EVIDENCE",
      `Terminal-owned requirement cannot be recorded before its authoritative result: ${requested.text}`,
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.events],
    );
  }

  const existingReceipt = await readCurrentReceipt(target, packageRoot);
  await validateReceipt(existingReceipt.value, packageRoot, {
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });
  const ledger = await validateEventLedger(target, packageRoot);
  if (!ledger.valid) {
    const first = ledger.errors[0];
    throw artifactError(first.code, first.message, [ARTIFACT_PATHS.events]);
  }
  if (!ledger.events.some((event) => event.taskId === state.taskId && event.event === "VERIFICATION_STARTED")) {
    throw artifactError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "record-check requires VERIFICATION_STARTED in the current task ledger",
      [ARTIFACT_PATHS.events],
    );
  }
  return {
    state,
    contract,
    route,
    preflight,
    requiredEvidence,
    existingReceipt,
    ledger,
  };
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
  executionRef,
  provenance,
  authorityContext,
  runtimeContext,
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
  if (executionRef !== undefined && (typeof executionRef !== "string" || executionRef.trim() === "")) {
    throw artifactError("E_EXECUTION_REF_INVALID", "executionRef must be a non-empty string when supplied");
  }
  if (provenance !== undefined && !CHECK_PROVENANCE.includes(provenance)) {
    throw artifactError("E_CHECK_INVALID", `provenance must be one of ${CHECK_PROVENANCE.join(", ")}`);
  }
  if ((typeof command !== "string" || command.trim() === "")
    && (typeof result !== "string" || result.trim() === "")) {
    throw artifactError("E_CHECK_INVALID", "record-check requires --command or --result");
  }

  const context = await assertRecordCheckPrerequisites({
    target,
    packageRoot,
    requirement,
    status,
    evidenceKind,
    authorityContext,
    runtimeContext,
  });
  const {
    state,
    contract,
    route,
    requiredEvidence,
    existingReceipt,
  } = context;

  const commandSpec = typeof command === "string" && command.trim() !== "" ? command.trim() : undefined;
  const observedCommand = kind === "command" && evidenceKind === "OBSERVED";
  if (observedCommand && (!executionRef || provenance !== "FORGELOOP_EXECUTED")) {
    throw commandProvenanceError();
  }
  const execution = executionRef
    ? await validateCheckExecutionProvenance({
      kind,
      evidenceKind,
      provenance,
      executionRef,
      status,
      exitCode,
      id,
      requirement,
      details: { ...(details ?? {}), verificationCycle: state.verificationCycle ?? 1 },
    }, {
      target,
      packageRoot,
      taskId: contract.value.taskId,
    })
    : null;
  const effectiveCommand = execution ? formatArgv(execution.argv) : commandSpec;
  const source = effectiveCommand || `check:${id}`;
  const recordedResult = result?.trim() || `recorded command: ${effectiveCommand || source}`;
  const classification = execution?.resolution ?? (effectiveCommand !== undefined ? classifyCommandResolution(effectiveCommand) : null);
  const installationAuthorized = Boolean(
    details?.installationAuthorized
    || details?.authority?.softwareInstallation === "AUTHORIZED"
    || details?.execution?.installationAuthorized
  );
  const check = createCheck({
    id,
    kind,
    requirement,
    status,
    evidenceKind,
    source,
    ...(executionRef === undefined ? {} : { executionRef }),
    ...(provenance === undefined ? {} : { provenance }),
    timestamp: new Date().toISOString(),
    ...(execution?.exitCode !== null && execution?.exitCode !== undefined
      ? { exitCode: execution.exitCode }
      : exitCode === undefined ? {} : { exitCode }),
    details: {
      ...(effectiveCommand === undefined ? {} : { command: effectiveCommand }),
      ...(result === undefined ? {} : { result }),
      ...(details === undefined ? {} : details),
      verificationCycle: state.verificationCycle ?? 1,
      ...(classification ? {
        execution: {
          ...(details?.execution ?? {}),
          ...(execution ? {
            executionRef: execution.executionId,
            argv: [...execution.argv],
            cwd: execution.cwd,
            resolution: execution.resolution,
            status: execution.status,
            exitCode: execution.exitCode,
          } : {}),
          resolutionMode: classification.resolutionMode,
          mayInstall: classification.mayInstall,
          installationAuthorized,
        },
      } : {}),
    },
  }, {
    target,
    taskId: contract.value.taskId,
    packageRoot,
    authorityContext,
    runtimeContext,
    requireCommandProvenance: observedCommand,
  });
  const evidence = createEvidence({
    kind: evidenceKind,
    source,
    result: recordedResult,
    verificationCycle: state.verificationCycle ?? 1,
    details: {
      ...(details === undefined ? {} : structuredClone(details)),
      verificationCycle: state.verificationCycle ?? 1,
    },
  });

  if (status === "passed") {
    const auth = validateVerificationAuthority(check, {
      target,
      taskId: contract.value.taskId,
      packageRoot,
      authorityContext,
      runtimeContext,
    });
    if (!auth.valid) {
      throw artifactError(auth.error.code, auth.error.message, [ARTIFACT_PATHS.receipt]);
    }
  }

  const checks = mergeByCheckId(existingReceipt.value.checks ?? [], check);
  const evidenceList = appendUniqueEvidence(existingReceipt.value.evidence ?? [], evidence);
  assertCompletionRelationships({
    contract,
    route,
    state,
    receipt: existingReceipt.value,
    requiredEvidence,
    requireRequiredChecks: false,
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });
  const coverage = coverageForRequirements(requiredEvidence, checks, {
    target,
    taskId: contract.value.taskId,
    options: { authorityContext, runtimeContext },
  });
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
    stateFingerprint: canonicalFingerprint(nextState),
    verificationCycle: state.verificationCycle ?? 1,
  }, packageRoot, {
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });

  assertCompletionRelationships({
    contract,
    route,
    state: nextState,
    receipt: nextReceipt,
    requiredEvidence,
    requireRequiredChecks: false,
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });

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
      verificationCycle: state.verificationCycle ?? 1,
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

export async function recordTerminalResult({
  target,
  packageRoot,
  requirement,
  type,
  status,
  source,
  result,
  details = {},
  authorityContext,
  runtimeContext,
} = {}) {
  if (!target || !requirement || !type || !status || !source || !result) {
    throw artifactError("E_CHECK_INVALID", "record-terminal-result requires target, requirement, type, status, source, and result", [ARTIFACT_PATHS.state]);
  }
  if (!["PUBLICATION", "PRODUCTION_READINESS"].includes(type)) {
    throw artifactError("E_FUTURE_TERMINAL_EVIDENCE", `record-terminal-result does not support type ${type}`, [ARTIFACT_PATHS.state]);
  }
  if (type === "PUBLICATION" && !["committed", "pushed", "published", "deployed"].includes(status)) {
    throw artifactError("E_CHECK_INVALID", `Invalid publication status for record-terminal-result: ${status}`, [ARTIFACT_PATHS.state]);
  }
  if (type === "PRODUCTION_READINESS" && !["ready", "blocked"].includes(status)) {
    throw artifactError("E_CHECK_INVALID", `Invalid production readiness status for record-terminal-result: ${status}`, [ARTIFACT_PATHS.state]);
  }

  const state = await readWorkState(target, packageRoot);
  if (!state) throw artifactError("E_STATE_MISSING", "Work state is required before recording a terminal result", [ARTIFACT_PATHS.state]);
  if (["COMPLETE", "BLOCKED"].includes(state.phase)) {
    throw artifactError("E_PHASE_TRANSITION_INVALID", `Cannot record a terminal result in ${state.phase}`, [ARTIFACT_PATHS.state]);
  }
  await assertExecutionPrerequisites({ target, state, packageRoot });

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

  const normalized = normalizeRequirements(requiredEvidence);
  const requested = normalized.find((item) => (
    item.id === requirement || item.text === requirement
  ));

  if (!requested) {
    throw artifactError(
      "E_TERMINAL_REQUIREMENT_UNKNOWN",
      `Terminal results must reference an existing canonical terminal requirement: ${requirement}`,
      [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt],
    );
  }

  if (!requested.terminalOwned) {
    throw artifactError(
      "E_TERMINAL_REQUIREMENT_NOT_TERMINAL",
      `record-terminal-result may only target terminal-owned requirements; found ${requested.type}: ${requested.text}`,
      [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt],
    );
  }

  if (requested.type !== type) {
    throw artifactError(
      "E_TERMINAL_REQUIREMENT_TYPE_MISMATCH",
      `Requirement ${requested.id} is ${requested.type}, not ${type}.`,
      [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt],
    );
  }

  const existingReceipt = await readCurrentReceipt(target, packageRoot);
  await validateReceipt(existingReceipt.value, packageRoot, {
    target,
    taskId: contract?.value?.taskId,
    authorityContext,
    runtimeContext,
  });

  if (type === "PUBLICATION") {
    const rank = {
      "not-published": 0,
      "local-only": 1,
      "committed": 2,
      "pushed": 3,
      "published": 4,
    };
    const prev = existingReceipt.value.publicationStatus ?? "not-published";
    if (prev in rank && status in rank && rank[status] < rank[prev]) {
      throw artifactError(
        "E_TERMINAL_STATUS_REGRESSION",
        `Publication status cannot regress from ${prev} to ${status}.`,
        [ARTIFACT_PATHS.receipt],
      );
    }
  }

  const cycle = state.verificationCycle ?? 1;

  // Idempotency check:
  const isIdentical = (existingReceipt.value.evidence ?? []).some((item) => (
    item.kind === "OBSERVED"
    && item.source === source.trim()
    && item.result === result.trim()
    && (item.verificationCycle ?? 1) === cycle
    && item.details?.requirementId === requested.id
    && item.details?.terminalType === type
    && item.details?.terminalStatus === status
  ));

  if (isIdentical) {
    const ledger = await validateEventLedger(target, packageRoot);
    const matchingEvent = ledger.events.find((event) => (
      event.taskId === state.taskId
      && event.event === "TERMINAL_RESULT_RECORDED"
      && event.details?.requirementId === requested.id
      && event.details?.type === type
      && event.details?.status === status
      && event.details?.verificationCycle === cycle
      && event.details?.source === source.trim()
      && event.details?.result === result.trim()
    ));

    if (matchingEvent) {
      return {
        path: path.join(target, ARTIFACT_PATHS.receipt),
        receipt: existingReceipt.value,
        requirementId: requested.id,
        type,
        status,
        idempotent: true,
        repaired: false,
        event: matchingEvent,
      };
    }

    const repairedEvent = await appendProtocolEvent(target, {
      taskId: state.taskId,
      event: "TERMINAL_RESULT_RECORDED",
      details: {
        requirementId: requested.id,
        type,
        status,
        verificationCycle: cycle,
        source: source.trim(),
        result: result.trim(),
      },
    }, packageRoot);

    return {
      path: path.join(target, ARTIFACT_PATHS.receipt),
      receipt: existingReceipt.value,
      requirementId: requested.id,
      type,
      status,
      idempotent: true,
      repaired: true,
      event: repairedEvent,
    };
  }

  const terminalEvidence = createEvidence({
    kind: "OBSERVED",
    source: source.trim(),
    result: result.trim(),
    verificationCycle: cycle,
    details: {
      requirementId: requested.id,
      requirementText: requested.text,
      terminalType: type,
      terminalStatus: status,
      ...(details === undefined ? {} : structuredClone(details)),
      verificationCycle: cycle,
    },
  });

  const evidenceList = appendUniqueEvidence(existingReceipt.value.evidence ?? [], terminalEvidence);
  const nextState = {
    ...state,
    verificationEvidence: evidenceList,
    lastUpdated: new Date().toISOString(),
  };

  const receiptUpdates = {
    ...existingReceipt.value,
    evidence: evidenceList,
    verificationCycle: cycle,
  };

  if (type === "PUBLICATION") {
    receiptUpdates.publicationStatus = status;
    receiptUpdates.publication = {
      ...(existingReceipt.value.publication ?? {}),
      committed: status === "committed" || (existingReceipt.value.publication?.committed ?? false),
      pushed: status === "pushed" || (existingReceipt.value.publication?.pushed ?? false),
      deployed: status === "deployed" || (existingReceipt.value.publication?.deployed ?? false),
    };
  } else if (type === "PRODUCTION_READINESS") {
    receiptUpdates.productionReadiness = status;
  }

  const nextReceipt = await createReceipt({
    ...receiptUpdates,
    stateFingerprint: canonicalFingerprint(nextState),
  }, packageRoot, {
    target,
    taskId: contract.value.taskId,
    authorityContext,
    runtimeContext,
  });

  await writeWorkState(target, nextState, { packageRoot });
  await writeJsonArtifact(
    target,
    ARTIFACT_PATHS.receipt,
    nextReceipt,
    "execution-receipt",
    packageRoot,
  );

  const event = await appendProtocolEvent(target, {
    taskId: state.taskId,
    event: "TERMINAL_RESULT_RECORDED",
    details: {
      requirementId: requested.id,
      type,
      status,
      verificationCycle: cycle,
      source: source.trim(),
      result: result.trim(),
    },
  }, packageRoot);

  return {
    path: path.join(target, ARTIFACT_PATHS.receipt),
    receipt: nextReceipt,
    requirementId: requested.id,
    type,
    status,
    evidence: terminalEvidence,
    event,
  };
}
