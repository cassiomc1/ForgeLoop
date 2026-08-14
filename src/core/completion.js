import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
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
import { classifyRequirement, evaluateTerminalRequirements } from "./evidence-readiness.js";

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
    case "E_PRODUCTION_REQUIREMENT_PENDING":
      return "The contract explicitly requires production readiness. Record authoritative deployment/readiness evidence before completion.";
    case "E_TERMINAL_REQUIREMENT_PENDING":
      return "The contract contains an unresolved terminal requirement. Ensure all terminal lifecycle criteria are satisfied.";
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
  if (!normalized.next) normalized.next = repairNext(normalized);
  return normalized;
}

function sortIssues(errors) {
  const unique = [...new Map(errors.map((rawError) => {
    const error = withRepairGuidance(rawError);
    return [
      `${error.code}\0${(error.artifacts ?? []).join("\0")}\0${error.message}`,
      error,
    ];
  })).values()];
  return unique.sort((left, right) => left.code.localeCompare(right.code)
    || left.artifacts.join("\0").localeCompare(right.artifacts.join("\0"))
    || left.message.localeCompare(right.message));
}

async function loadRequired(loader, code, message, artifacts, errors) {
  try {
    return await loader();
  } catch (error) {
    errors.push(issue(error.code === "ARTIFACT_MISSING" ? code : `${code.replace(/_MISSING$/, "")}_INVALID`, `${message}: ${error.message}`, artifacts));
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

async function validateLedger(target, taskId, state, errors, packageRoot) {
  await assertSafePath(target, ARTIFACT_PATHS.events);
  const eventsPath = ensureWithin(target, ARTIFACT_PATHS.events);
  if (!(await fileExists(eventsPath))) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "Protocol event ledger is required before completion", [ARTIFACT_PATHS.events]));
    return { valid: false, events: [], errors: [] };
  }
  const ledger = await validateEventLedger(target, packageRoot);
  for (const error of ledger.errors) errors.push({ ...error, artifacts: [ARTIFACT_PATHS.events] });
  for (const error of validateStateLedgerCoherence(state, ledger.events)) {
    errors.push({ ...error, artifacts: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.events] });
  }
  const requiredEvents = LIFECYCLE_MILESTONES.slice(0, state?.phase === "COMPLETE" ? undefined : -1);
  const observed = new Set(ledger.events.filter((event) => event.taskId === taskId).map((event) => event.event));
  for (const event of requiredEvents) {
    if (!observed.has(event)) {
      errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", `Required protocol event is missing: ${event}`, [ARTIFACT_PATHS.events], { event }));
    }
  }
  if (ledger.events.some((event) => event.taskId !== taskId)) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "Protocol events must belong to the current task", [ARTIFACT_PATHS.events]));
  }
  if (state?.phase !== "COMPLETE" && observed.has("COMPLETION_VALIDATED")) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "COMPLETION_VALIDATED requires COMPLETE state", [ARTIFACT_PATHS.events]));
  }
  return ledger;
}

export async function evaluateCompletion({ target, packageRoot, strict = false } = {}) {
  const errors = [];
  const preflight = await evaluatePreflight({ target, packageRoot, strict });
  errors.push(...preflight.errors);
  const contract = await loadRequired(
    () => readContract(target, packageRoot),
    "E_CONTRACT_MISSING",
    "Current contract is not available",
    [ARTIFACT_PATHS.contract],
    errors,
  );
  const route = await loadRequired(
    () => readPersistedRoute(target, packageRoot),
    "E_ROUTE_MISSING",
    "Persisted routing result is not available",
    [ARTIFACT_PATHS.route],
    errors,
  );
  const state = await loadRequired(
    () => readWorkState(target, packageRoot).then((value) => {
      if (!value) {
        const error = new Error("Work state is missing");
        error.code = "ARTIFACT_MISSING";
        throw error;
      }
      return value;
    }),
    "E_STATE_MISSING",
    "Work state is not available",
    [ARTIFACT_PATHS.state],
    errors,
  );
  const receipt = await loadRequired(
    () => readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot),
    "E_RECEIPT_MISSING",
    "Execution receipt is not available",
    [ARTIFACT_PATHS.receipt],
    errors,
  );

  if (state && hasExecutionStarted(state.phase)) {
    const prerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot });
    errors.push(...prerequisites.errors);
  }

  if (receipt) {
    try {
      await validateReceipt(receipt.value, packageRoot);
    } catch (error) {
      errors.push(issue(error.code ?? "E_RECEIPT_INVALID", `Execution receipt is invalid: ${error.message}`, [ARTIFACT_PATHS.receipt]));
    }
  }

  if (state && !["REVIEWING", "COMPLETE"].includes(state.phase)) {
    errors.push(issue("E_PHASE_PREREQUISITE_MISSING", `Completion requires REVIEWING or COMPLETE state, found ${state.phase}`, [ARTIFACT_PATHS.state]));
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
    });
    errors.push(...relationshipErrors);
    coverage = receipt?.value?.evidenceCoverage ?? [];
  }

  const ledger = contract && state
    ? await validateLedger(target, contract.value.taskId, state, errors, packageRoot)
    : { valid: false, events: [], errors: [] };

  if (state) {
    try {
      const classification = await classifyLoadedWorkState({
        target,
        state,
        contractFile: ARTIFACT_PATHS.contract,
      });
      if (classification.status === "REVALIDATION_REQUIRED") {
        for (const reason of classification.reasons) {
          errors.push(issue(reason === "CONTRACT_CHANGED" ? "E_CONTRACT_STALE" : "E_PHASE_ARTIFACT_STALE", `State freshness check failed: ${reason}`, [ARTIFACT_PATHS.state]));
        }
      }
    } catch (error) {
      errors.push(issue("E_PHASE_ARTIFACT_STALE", error.message, [ARTIFACT_PATHS.state]));
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
        [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt],
        { requirementId: termErr.requirementId },
      ));
    }
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

export async function runComplete({ target, packageRoot, strict = false, persist = true } = {}) {
  const result = await evaluateCompletion({ target, packageRoot, strict });
  const rejectionCodes = [...new Set(result.errors.map((error) => error.code))].sort();
  const evidenceOnlyRejection = rejectionCodes.length > 0
    && rejectionCodes.every(isRecoverableCompletionEvidenceCode);
  if (persist && result.status === "REJECTED" && evidenceOnlyRejection) {
    const state = await readWorkState(target, packageRoot);
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
        receipt = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
      } catch {
        // The evaluator already reports a missing or invalid receipt; evidence-only rejection can persist without one.
      }
      await writeWorkState(target, next, { packageRoot });
      let nextReceipt = null;
      if (receipt) {
        nextReceipt = await createReceipt({
          ...receipt.value,
          stateFingerprint: canonicalFingerprint(next),
          verificationCycle: next.verificationCycle ?? receipt.value.verificationCycle ?? 1,
        }, packageRoot);
        await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, nextReceipt, "execution-receipt", packageRoot);
      }
      const ledger = await validateEventLedger(target, packageRoot);
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
        }, packageRoot);
      }
    }
  }
  if (persist && result.status === "VALID") {
    const state = await readWorkState(target, packageRoot);
    if (state && state.phase !== "COMPLETE") {
      const receipt = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
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
      }, packageRoot);
      await writeWorkState(target, next, { packageRoot });
      await writeJsonArtifact(target, ARTIFACT_PATHS.receipt, nextReceipt, "execution-receipt", packageRoot);
    }
    const contract = await readContract(target, packageRoot);
    const ledger = await validateEventLedger(target, packageRoot);
    if (!ledger.events.some((event) => event.event === "COMPLETION_VALIDATED")) {
      await appendProtocolEvent(target, { taskId: contract.value.taskId, event: "COMPLETION_VALIDATED" }, packageRoot);
    }
  }
  return result;
}
