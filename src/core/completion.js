import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact } from "./artifacts.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { completionEvidenceForGuides } from "./guide-metadata.js";
import { evaluatePreflight } from "./preflight.js";
import { readContract } from "./contract.js";
import { readPersistedRoute } from "./route-artifact.js";
import { readWorkState, writeWorkState, classifyLoadedWorkState } from "./work-state.js";
import { validateReceipt } from "./receipt.js";
import { assertCheckList, requiredChecksSatisfied } from "./checks.js";
import { assertCoverageList, coverageForRequirements } from "./coverage.js";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";

function issue(code, message, artifacts = [], details = {}) {
  return { code, message, artifacts, ...details };
}

function sortIssues(errors) {
  const unique = [...new Map(errors.map((error) => [
    `${error.code}\0${(error.artifacts ?? []).join("\0")}\0${error.message}`,
    error,
  ])).values()];
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

function requiredEvidenceFor(contract, route, packageRoot, preflight) {
  return Promise.all([
    completionEvidenceForGuides(route?.value?.guides ?? [], packageRoot),
  ]).then(([guideEvidence]) => [...new Set([
    ...(contract?.value?.successCriteria ?? []),
    ...guideEvidence,
    ...(preflight?.policy?.requiredEvidence ?? []),
  ])].sort());
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
  const requiredEvents = ["CONTRACT_VALIDATED", "ROUTE_VALIDATED", "PREFLIGHT_READY", "EXECUTION_STARTED", "VERIFICATION_RECORDED"];
  const observed = new Set(ledger.events.filter((event) => event.taskId === taskId).map((event) => event.event));
  for (const event of requiredEvents) {
    if (!observed.has(event)) {
      errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", `Required protocol event is missing: ${event}`, [ARTIFACT_PATHS.events], { event }));
    }
  }
  if (ledger.events.some((event) => event.taskId !== taskId)) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "Protocol events must belong to the current task", [ARTIFACT_PATHS.events]));
  }
  if (state?.phase === "COMPLETE" && !observed.has("COMPLETION_VALIDATED")) {
    errors.push(issue("E_PHASE_CHRONOLOGY_INVALID", "COMPLETE state requires COMPLETION_VALIDATED", [ARTIFACT_PATHS.events]));
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

  if (receipt) {
    try {
      await validateReceipt(receipt.value, packageRoot);
    } catch (error) {
      errors.push(issue(error.code ?? "E_RECEIPT_INVALID", `Execution receipt is invalid: ${error.message}`, [ARTIFACT_PATHS.receipt]));
    }
  }

  if (contract && route && route.value.contractFingerprint !== undefined
    && route.value.contractFingerprint !== contract.fingerprint) {
    errors.push(issue("E_ROUTE_STALE", "Routing result does not match the current contract", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.contract]));
  }
  if (contract && state && state.contractFingerprint !== contract.fingerprint) {
    errors.push(issue("E_CONTRACT_STALE", "Work state does not match the current contract", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract]));
  }
  if (route && state && JSON.stringify(route.value.guides) !== JSON.stringify(state.selectedGuides)) {
    errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "Work state guides do not match the persisted route", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.state]));
  }
  if (route && receipt && JSON.stringify(route.value.guides) !== JSON.stringify(receipt.value.selectedGuides)) {
    errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "Receipt guides do not match the persisted route", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.receipt]));
  }
  if (contract && receipt && receipt.value.contractFingerprint !== contract.fingerprint) {
    errors.push(issue("E_RECEIPT_CONTRACT_MISMATCH", "Receipt does not match the current contract", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt]));
  }
  if (route && receipt && receipt.value.routeFingerprint !== undefined && receipt.value.routeFingerprint !== route.fingerprint) {
    errors.push(issue("E_RECEIPT_ROUTE_MISMATCH", "Receipt does not match the persisted route", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.receipt]));
  }
  if (state && receipt && receipt.value.stateFingerprint !== undefined && receipt.value.stateFingerprint !== canonicalFingerprint(state)) {
    errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Receipt does not match the recorded work state", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
  }
  if (state && !["REVIEWING", "COMPLETE"].includes(state.phase)) {
    errors.push(issue("E_PHASE_PREREQUISITE_MISSING", `Completion requires REVIEWING or COMPLETE state, found ${state.phase}`, [ARTIFACT_PATHS.state]));
  }

  let coverage = [];
  if (receipt && contract && route) {
    const requiredEvidence = await requiredEvidenceFor(contract, route, packageRoot, preflight);
    coverage = receipt.value.evidenceCoverage
      ? receipt.value.evidenceCoverage
      : coverageForRequirements(requiredEvidence, receipt.value.checks);
    try {
      assertCoverageList(coverage);
    } catch (error) {
      errors.push(issue(error.code ?? "E_EVIDENCE_COVERAGE_PARTIAL", error.message, [ARTIFACT_PATHS.receipt]));
    }
    const byRequirement = new Map(coverage.map((item) => [item.requirement, item]));
    for (const requirement of requiredEvidence) {
      const item = byRequirement.get(requirement);
      if (!item) {
        errors.push(issue("E_EVIDENCE_REQUIRED", `Evidence coverage is missing: ${requirement}`, [ARTIFACT_PATHS.receipt], { requirement }));
      } else if (item.status !== "COVERED") {
        errors.push(issue(
          item.status === "BLOCKED" ? "E_EVIDENCE_COVERAGE_PARTIAL" : "E_EVIDENCE_COVERAGE_PARTIAL",
          `Evidence coverage is ${item.status}: ${requirement}`,
          [ARTIFACT_PATHS.receipt],
          { requirement, status: item.status },
        ));
      }
    }
    const structuredChecks = receipt.value.checks.filter((check) => check?.schemaVersion === 1 || check?.id !== undefined || check?.evidenceKind !== undefined);
    if (structuredChecks.length > 0) {
      try {
        assertCheckList(structuredChecks, "receipt.checks");
        errors.push(...requiredChecksSatisfied(structuredChecks, requiredEvidence));
      } catch (error) {
        errors.push(issue(error.code ?? "E_CHECK_INVALID", error.message, [ARTIFACT_PATHS.receipt]));
      }
    }
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

  const sortedErrors = sortIssues(errors);
  const receiptValue = receipt?.value;
  const publication = receiptValue ? publicationStatus(receiptValue) : "not-published";
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
      await writeWorkState(target, next, { packageRoot });
    }
    const contract = await readContract(target, packageRoot);
    const ledger = await validateEventLedger(target, packageRoot);
    if (!ledger.events.some((event) => event.event === "COMPLETION_VALIDATED")) {
      await appendProtocolEvent(target, { taskId: contract.value.taskId, event: "COMPLETION_VALIDATED" }, packageRoot);
    }
  }
  return result;
}
