import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { requiredEvidenceForTarget, validateChecksExecutionProvenance } from "./completion-artifacts.js";
import { appendProtocolEvent, LIFECYCLE_MILESTONES, validateEventLedger, validateStateLedgerCoherence } from "./events.js";
import { evaluatePreflight } from "./preflight.js";
import { readContract } from "./contract.js";
import { readPersistedRoute } from "./route-artifact.js";
import { readWorkState, writeWorkState, classifyLoadedWorkState } from "./work-state.js";
import { createReceipt, validateReceipt } from "./receipt.js";
import { completionRelationshipErrors } from "./completion-relationships.js";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { evaluateStartExecutionPrerequisites, hasExecutionStarted } from "./execution-prerequisites.js";
import { isRecoverableCompletionEvidenceCode } from "./completion-recovery.js";
import { evaluateTerminalRequirements } from "./evidence-readiness.js";
import { PROJECT_ARTIFACT_PATHS, taskArtifactPath } from "./task-paths.js";
import { evaluateTargetPolicy } from "./policy-engine.js";

function issue(code, message, artifacts = [], details = {}) {
  return { code, message, artifacts, ...details };
}

export function completionIdentityErrors({ contract, state, receipt } = {}) {
  return completionRelationshipErrors({ contract, state, receipt })
    .filter((error) => ["E_STATE_TASK_MISMATCH", "E_RECEIPT_TASK_MISMATCH"].includes(error.code));
}

function repairNext(error) {
  switch (error.code) {
    case "E_RECEIPT_MISSING":
      return "Run forgeloop prepare-completion after recording verification evidence.";
    case "E_RECEIPT_INVALID":
    case "E_RECEIPT_CONTRACT_MISMATCH":
    case "E_RECEIPT_ROUTE_MISMATCH":
    case "E_RECEIPT_STATE_MISMATCH":
    case "E_RECEIPT_CYCLE_MISMATCH":
      return "Run forgeloop prepare-completion, inspect the receipt, and validate it before retrying completion.";
    case "E_PHASE_PREREQUISITE_MISSING":
      return "Advance from EXECUTING through VERIFYING and REVIEWING, resolving the named prerequisite before completion.";
    case "E_PHASE_CHRONOLOGY_INVALID":
      return "Record the missing lifecycle event through the normal phase transition or forgeloop record-check path.";
    case "E_EVIDENCE_REQUIRED":
    case "E_EVIDENCE_COVERAGE_INVALID":
    case "E_EVIDENCE_COVERAGE_PARTIAL":
    case "E_EVIDENCE_KIND_INVALID":
    case "E_CHECK_INVALID":
    case "E_CHECK_STATUS_CONTRADICTION":
      return "Run forgeloop record-check with compatible observed evidence for the named requirement.";
    case "E_COMMAND_PROVENANCE_UNATTESTED":
    case "E_EXECUTION_REF_INVALID":
      return "Run forgeloop run-check with the exact argv, or record the result as manual/NOT_VERIFIED evidence without claiming command execution.";
    case "E_EVIDENCE_PARTIAL":
      return "Run or finish the missing component checks and record observed evidence.";
    case "E_EVIDENCE_INVALID":
      return "Resolve the invalid evidence format or failure status with forgeloop record-check.";
    case "E_FUTURE_LIFECYCLE_EVIDENCE":
      return "Remove the premature terminal claim; the lifecycle event must satisfy it.";
    case "E_CIRCULAR_COMPLETION_REQUIREMENT":
    case "E_MIXED_TERMINAL_REQUIREMENT":
      return "Split ordinary verification from terminal lifecycle criteria.";
    case "E_PUBLICATION_REQUIREMENT_PENDING":
      return "The contract explicitly requires publication. Record authoritative publication evidence or revise the contract if publication is not in scope.";
    case "E_PRODUCTION_READINESS_REQUIREMENT_PENDING":
    case "E_PRODUCTION_REQUIREMENT_PENDING":
      return "The contract explicitly requires production readiness. Record authoritative deployment/readiness evidence before completion.";
    case "E_TERMINAL_REQUIREMENT_PENDING":
      return "The contract contains an unresolved terminal requirement. Ensure all terminal lifecycle criteria are satisfied.";
    case "E_TERMINAL_REQUIREMENT_UNKNOWN":
      return "Terminal results must reference an existing canonical requirement declared in the contract.";
    case "E_TERMINAL_REQUIREMENT_NOT_TERMINAL":
      return "Use forgeloop record-check for ordinary verification requirements.";
    case "E_TERMINAL_REQUIREMENT_TYPE_MISMATCH":
      return "Ensure the supplied terminal type matches the canonical requirement type.";
    case "E_TERMINAL_STATUS_REGRESSION":
      return "Terminal publication status cannot regress to a weaker state.";
    case "E_STATE_LEDGER_DIVERGENCE":
      return "Do not edit work-state or receipt manually; recover through supported lifecycle commands.";
    case "E_COMPLETION_RECOVERY_UNAUTHORIZED":
    case "E_COMPLETION_REJECTION_LEDGER_MISMATCH":
    case "E_COMPLETION_REJECTION_STATE_FINGERPRINT_MISMATCH":
    case "E_COMPLETION_REJECTION_RECEIPT_FINGERPRINT_MISMATCH":
      return "Ensure a matching completion rejection exists in the protocol ledger and artifacts remain unmodified before recovery.";
    case "E_GATE_UNVERIFIED":
    case "E_GATE_STALE":
      return "Satisfy or refresh the named gate, then rerun forgeloop preflight.";
    case "E_PROFILE_UNVERIFIED":
      return "Use Standard mode for a fresh target, or verify PROJECT_PROFILE.md before Strict completion.";
    case "E_INSTALLATION_AUTHORITY_REQUIRED":
    case "E_AUTHORITY_INVALID":
    case "E_AUTHORITY_SCOPE_MISMATCH":
    case "E_AUTHORITY_UNTRUSTED_SOURCE":
      return "Do not execute installation-capable verification commands without explicit scoped installation authority; use local equivalents or record NOT_VERIFIED.";
    case "E_VERIFICATION_TOOL_UNAVAILABLE":
      return "Use an available local verifier, an existing equivalent, or record NOT_VERIFIED if installation was not authorized.";
    case "E_NEW_POLICY_VIOLATION":
      return "Resolve the new policy violation or record baseline if adopted debt before completion.";
    case "E_POLICY_WEAKENING":
      return "Restore the original policy configuration or obtain explicit project authority before retrying completion.";
    case "E_CHECK_INERT":
      return "Configure an applicable target scope or mark the inert check unsupported.";
    case "E_CHECK_MUTATION_NOT_DETECTED":
      return "Fix checker logic to properly detect intentional mutation fixtures.";
    case "E_POLICY_DRIFT":
      return "Re-verify affected checks or restore original policy.";
    case "E_BASELINE_EXPANSION":
      return "Resolve new violations rather than expanding the baseline.";
    default:
      return "Resolve this validator finding in the named artifact before retrying completion.";
  }
}

function withRepairGuidance(error) {
  const normalized = {
    ...error,
    code: error.code ?? "E_COMPLETION_REJECTED",
    message: error.message ?? String(error),
    artifacts: error.artifacts ?? [],
  };
  if (normalized.next) return normalized;
  return { ...normalized, next: repairNext(normalized) };
}

function sortIssues(issues) {
  return issues
    .map(withRepairGuidance)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "") || (a.message || "").localeCompare(b.message || ""));
}

async function loadRequired(readArtifact, errorCode, errorMessage, artifacts, errors) {
  try {
    return await readArtifact();
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") {
      errors.push(issue(errorCode, errorMessage, artifacts));
      return null;
    }
    errors.push(issue(error.code ?? errorCode, error.message ?? errorMessage, artifacts));
    return null;
  }
}

function publicationStatus(receipt) {
  if (receipt.publicationStatus) return receipt.publicationStatus;
  if (receipt.publication?.deployed) return "deployed";
  if (receipt.publication?.pushed) return "pushed";
  if (receipt.publication?.committed) return "committed";
  return receipt.changedPaths?.length > 0 ? "local-only" : "not-published";
}

async function validateLedger(target, scopedTaskId, contractTaskId, state, errors, packageRoot, options = {}) {
  const eventsRel = options.eventsPath ?? (scopedTaskId ? taskArtifactPath(scopedTaskId, "events") : ARTIFACT_PATHS.events);
  const stateRel = options.statePath ?? (scopedTaskId ? taskArtifactPath(scopedTaskId, "state") : ARTIFACT_PATHS.state);
  await assertSafePath(target, eventsRel);
  const eventsFilePath = ensureWithin(target, eventsRel);
  if (!(await fileExists(eventsFilePath))) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "Protocol event ledger is required before completion", [eventsRel]));
    return { valid: false, events: [], errors: [] };
  }
  const ledger = await validateEventLedger(target, packageRoot, { taskId: scopedTaskId, eventsPath: options.eventsPath });
  for (const error of ledger.errors) errors.push({ ...error, artifacts: [eventsRel] });
  for (const error of validateStateLedgerCoherence(state, ledger.events)) {
    errors.push({ ...error, artifacts: [stateRel, eventsRel] });
  }
  const requiredEvents = LIFECYCLE_MILESTONES.slice(0, state?.phase === "COMPLETE" ? undefined : -1);
  const observed = new Set(ledger.events.filter((event) => event.taskId === contractTaskId).map((event) => event.event));
  for (const event of requiredEvents) {
    if (!observed.has(event)) {
      errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", `Required protocol event is missing: ${event}`, [eventsRel], { event }));
    }
  }
  if (ledger.events.some((event) => event.taskId !== contractTaskId)) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "Protocol events must belong to the current task", [eventsRel]));
  }
  if (state?.phase !== "COMPLETE" && observed.has("COMPLETION_VALIDATED")) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "COMPLETION_VALIDATED requires COMPLETE state", [eventsRel]));
  }
  return ledger;
}

export async function evaluateCompletion({
  target,
  packageRoot,
  strict = false,
  authorityContext,
  runtimeContext,
  taskId = null,
  contractPath = null,
  routePath = null,
  statePath = null,
  receiptPath = null,
  eventsPath = null,
  preflightPath = null,
} = {}) {
  const errors = [];
  const preflight = await evaluatePreflight({ target, packageRoot, strict, taskId, contractPath, routePath, statePath });
  errors.push(...preflight.errors);

  const contractRel = contractPath ?? (taskId ? taskArtifactPath(taskId, "contract") : ARTIFACT_PATHS.contract);
  const routeRel = routePath ?? (taskId ? taskArtifactPath(taskId, "route") : ARTIFACT_PATHS.route);
  const stateRel = statePath ?? (taskId ? taskArtifactPath(taskId, "state") : ARTIFACT_PATHS.state);
  const receiptRel = receiptPath ?? (taskId ? taskArtifactPath(taskId, "receipt") : ARTIFACT_PATHS.receipt);

  const contract = await loadRequired(
    () => readContract(target, packageRoot, { taskId, contractPath }),
    "E_CONTRACT_MISSING",
    "Current contract is not available",
    [contractRel],
    errors,
  );
  const route = await loadRequired(
    () => readPersistedRoute(target, packageRoot, { taskId, routePath }),
    "E_ROUTE_MISSING",
    "Persisted routing result is not available",
    [routeRel],
    errors,
  );
  const state = await loadRequired(
    () => readWorkState(target, { packageRoot, taskId, statePath }).then((value) => {
      if (!value) {
        const error = new Error("Work state is missing");
        error.code = "ARTIFACT_MISSING";
        throw error;
      }
      return value;
    }),
    "E_STATE_MISSING",
    "Work state is not available",
    [stateRel],
    errors,
  );
  const receipt = await loadRequired(
    () => readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot),
    "E_RECEIPT_MISSING",
    "Execution receipt is not available",
    [receiptRel],
    errors,
  );

  if (state && hasExecutionStarted(state.phase)) {
    const prerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot, taskId, statePath, contractPath, routePath });
    errors.push(...prerequisites.errors);
  }

  if (receipt) {
    try {
      await validateReceipt(receipt.value, packageRoot, {
        target,
        taskId: contract?.value?.taskId,
        authorityContext,
        runtimeContext,
      });
    } catch (error) {
      errors.push(issue(error.code ?? "E_RECEIPT_INVALID", `Execution receipt is invalid: ${error.message}`, [receiptRel]));
    }
  }

  if (contract) {
    try {
      await validateChecksExecutionProvenance(state?.checks, {
        target,
        packageRoot,
        taskId: contract.value.taskId,
        artifactPath: stateRel,
      });
    } catch (error) {
      errors.push(issue(error.code ?? "E_EXECUTION_REF_INVALID", error.message, error.artifacts ?? [stateRel]));
    }
    try {
      await validateChecksExecutionProvenance(receipt?.value?.checks, {
        target,
        packageRoot,
        taskId: contract.value.taskId,
        artifactPath: receiptRel,
      });
    } catch (error) {
      errors.push(issue(error.code ?? "E_EXECUTION_REF_INVALID", error.message, error.artifacts ?? [receiptRel]));
    }
  }

  if (state && !["REVIEWING", "COMPLETE"].includes(state.phase)) {
    errors.push(issue("E_PHASE_PREREQUISITE_MISSING", `Completion requires REVIEWING or COMPLETE state, found ${state.phase}`, [stateRel]));
  }

  let coverage = [];
  if (contract && route) {
    const requiredEvidence = await requiredEvidenceForTarget({
      target,
      contract,
      route,
      packageRoot,
      additionalEvidence: preflight?.policy?.requiredEvidence ?? [],
    });
    const relationshipErrors = completionRelationshipErrors({
      contract,
      route,
      state,
      receipt: receipt?.value,
      requiredEvidence,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    errors.push(...relationshipErrors);
    coverage = receipt?.value?.evidenceCoverage ?? [];
  }

  const ledger = contract && state
    ? await validateLedger(target, taskId, contract.value.taskId, state, errors, packageRoot, { eventsPath, statePath })
    : { valid: false, events: [], errors: [] };

  if (state) {
    try {
      const classification = await classifyLoadedWorkState({
        target,
        state,
        contractFile: contractRel,
      });
      if (classification.status === "REVALIDATION_REQUIRED") {
        for (const reason of classification.reasons) {
          errors.push(issue(reason === "CONTRACT_CHANGED" ? "E_CONTRACT_STALE" : "E_PHASE_ARTIFACT_STALE", `State freshness check failed: ${reason}`, [stateRel]));
        }
      }
    } catch (error) {
      errors.push(issue("E_PHASE_ARTIFACT_STALE", error.message, [stateRel]));
    }
  }

  const receiptValue = receipt?.value;
  const publication = receiptValue ? publicationStatus(receiptValue) : "not-published";

  if (contract) {
    const allContractReqs = [
      ...(contract.value.verification ?? []),
      ...(contract.value.successCriteria ?? []),
    ];
    const terminalEval = evaluateTerminalRequirements({
      requirements: allContractReqs,
      receipt: receiptValue,
    });
    for (const termErr of terminalEval.errors) {
      errors.push(issue(
        termErr.code,
        termErr.message,
        [contractRel, receiptRel],
        { requirementId: termErr.requirementId },
      ));
    }
  }

  let policyEval = null;
  try {
    policyEval = await evaluateTargetPolicy({
      target,
      packageRoot,
      taskId: contract?.value?.taskId ?? taskId,
    });
    for (const policyErr of policyEval.errors ?? []) {
      const code = policyErr.code === "NEW_VIOLATION" ? "E_NEW_POLICY_VIOLATION"
        : policyErr.code === "POLICY_WEAKENING" ? "E_POLICY_WEAKENING"
        : policyErr.code === "CHECK_INERT" ? "E_CHECK_INERT"
        : policyErr.code === "CHECK_MUTATION_NOT_DETECTED" ? "E_CHECK_MUTATION_NOT_DETECTED"
        : policyErr.code;
      errors.push(issue(
        code,
        policyErr.why || policyErr.message,
        [PROJECT_ARTIFACT_PATHS.policyLock],
        { ruleId: policyErr.ruleId, fix: policyErr.fix },
      ));
    }
  } catch {
    // Gracefully handle environments without policy setup
  }

  const sortedErrors = sortIssues(errors);
  const valid = sortedErrors.length === 0;
  return {
    status: valid ? "VALID" : "REJECTED",
    taskStatus: valid ? "COMPLETE" : receiptValue?.status === "blocked" ? "BLOCKED" : "INCOMPLETE",
    verificationStatus: valid ? "VALID" : "invalid",
    publicationStatus: publication,
    productionReadiness: receiptValue?.productionReadiness ?? "not-verified",
    errors: sortedErrors,
    warnings: [],
    preflight,
    coverage,
    ledger: {
      status: ledger.valid ? "valid" : "invalid",
      events: ledger.events.length,
    },
  };
}

export async function runComplete({
  target,
  packageRoot,
  strict = false,
  persist = true,
  authorityContext,
  runtimeContext,
  taskId = null,
  contractPath = null,
  routePath = null,
  statePath = null,
  receiptPath = null,
  eventsPath = null,
  preflightPath = null,
} = {}) {
  const result = await evaluateCompletion({
    target,
    packageRoot,
    strict,
    authorityContext,
    runtimeContext,
    taskId,
    contractPath,
    routePath,
    statePath,
    receiptPath,
    eventsPath,
    preflightPath,
  });

  const receiptRel = receiptPath ?? (taskId ? taskArtifactPath(taskId, "receipt") : ARTIFACT_PATHS.receipt);

  const rejectionCodes = [...new Set(result.errors.map((error) => error.code))].sort();
  const evidenceOnlyRejection = rejectionCodes.length > 0
    && rejectionCodes.every(isRecoverableCompletionEvidenceCode);
  const authorityRejection = rejectionCodes.some((code) => [
    "E_INSTALLATION_AUTHORITY_REQUIRED",
    "E_AUTHORITY_INVALID",
    "E_AUTHORITY_SCOPE_MISMATCH",
    "E_AUTHORITY_UNTRUSTED_SOURCE",
  ].includes(code));
  if (persist && result.status === "REJECTED" && evidenceOnlyRejection && !authorityRejection) {
    const state = await readWorkState(target, { packageRoot, taskId, statePath });
    if (state?.phase === "REVIEWING") {
      const reasonCodes = rejectionCodes;
      const missingRequirementIds = [...new Set(result.errors.map((error) => error.requirementId).filter(Boolean))].sort();
      const currentCycle = state.verificationCycle ?? 1;
      const alreadyRejected = state.lastCompletionAttempt?.status === "REJECTED"
        && (state.lastCompletionAttempt.verificationCycle ?? 1) === currentCycle
        && JSON.stringify([...(state.lastCompletionAttempt.reasonCodes ?? [])].sort()) === JSON.stringify(reasonCodes)
        && JSON.stringify([...(state.lastCompletionAttempt.missingRequirementIds ?? [])].sort()) === JSON.stringify(missingRequirementIds);

      if (alreadyRejected) {
        return result;
      }

      const now = new Date().toISOString();
      const next = {
        ...state,
        lastCompletionAttempt: {
          status: "REJECTED",
          reasonCodes,
          missingRequirementIds,
          verificationCycle: currentCycle,
          timestamp: now,
        },
        lastUpdated: now,
      };
      let receipt = null;
      try {
        receipt = await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot);
      } catch {
        // The evaluator already reports a missing or invalid receipt; evidence-only rejection can persist without one.
      }
      await writeWorkState(target, next, { packageRoot, taskId, statePath });
      let nextReceipt = null;
      if (receipt) {
        nextReceipt = await createReceipt({
          ...receipt.value,
          stateFingerprint: canonicalFingerprint(next),
          verificationCycle: next.verificationCycle ?? receipt.value.verificationCycle ?? 1,
        }, packageRoot, { target, taskId: state.taskId, authorityContext, runtimeContext });
        await writeJsonArtifact(target, receiptRel, nextReceipt, "execution-receipt", packageRoot);
      }
      const ledger = await validateEventLedger(target, packageRoot, { taskId, eventsPath });
      const lastRejection = ledger.events.filter((e) => e.taskId === state.taskId && e.event === "COMPLETION_REJECTED").at(-1);
      const lastDetails = lastRejection?.details ?? {};
      const isIdentical = lastRejection
        && (lastDetails.verificationCycle ?? 1) === currentCycle
        && JSON.stringify([...(lastDetails.reasonCodes ?? [])].sort()) === JSON.stringify(reasonCodes)
        && JSON.stringify([...(lastDetails.missingRequirementIds ?? [])].sort()) === JSON.stringify(missingRequirementIds)
        && lastDetails.stateFingerprint === canonicalFingerprint(next)
        && lastDetails.receiptFingerprint === (nextReceipt ? canonicalFingerprint(nextReceipt) : undefined);

      if (!isIdentical) {
        await appendProtocolEvent(target, {
          taskId: state.taskId,
          event: "COMPLETION_REJECTED",
          details: {
            verificationCycle: currentCycle,
            reasonCodes,
            missingRequirementIds,
            stateFingerprint: canonicalFingerprint(next),
            ...(nextReceipt ? { receiptFingerprint: canonicalFingerprint(nextReceipt) } : {}),
          },
        }, packageRoot, { taskId, eventsPath });
      }
    }
  }
  if (persist && result.status === "VALID") {
    const state = await readWorkState(target, { packageRoot, taskId, statePath });
    if (state && state.phase !== "COMPLETE") {
      const receipt = await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot);
      const next = {
        ...state,
        previousPhase: state.phase,
        phase: "COMPLETE",
        evidenceCoverage: result.coverage,
        verificationEvidence: receipt.value.evidence,
        publicationStatus: result.publicationStatus,
        lastUpdated: new Date().toISOString(),
      };
      const nextReceipt = await createReceipt({
        ...receipt.value,
        stateFingerprint: canonicalFingerprint(next),
        verificationCycle: next.verificationCycle ?? receipt.value.verificationCycle ?? 1,
      }, packageRoot, { target, taskId: state.taskId, authorityContext, runtimeContext });
      await writeWorkState(target, next, { packageRoot, taskId, statePath });
      await writeJsonArtifact(target, receiptRel, nextReceipt, "execution-receipt", packageRoot);
    }
    const contract = await readContract(target, packageRoot, { taskId, contractPath });
    const ledger = await validateEventLedger(target, packageRoot, { taskId, eventsPath });
    if (!ledger.events.some((event) => event.taskId === contract.value.taskId && event.event === "COMPLETION_VALIDATED")) {
      await appendProtocolEvent(target, { taskId: contract.value.taskId, event: "COMPLETION_VALIDATED" }, packageRoot, { taskId, eventsPath });
    }
  }
  return result;
}
