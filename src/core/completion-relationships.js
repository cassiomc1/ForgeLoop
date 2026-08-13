import { ARTIFACT_PATHS, canonicalFingerprint } from "./artifacts.js";
import { assertCheckList, requiredChecksSatisfied } from "./checks.js";
import { assertCoverageList, coverageForRequirements } from "./coverage.js";
import { assertEvidenceList } from "./evidence.js";

function issue(code, message, artifacts = []) {
  return { code, message, artifacts };
}

function sameValue(left, right) {
  return canonicalFingerprint(left) === canonicalFingerprint(right);
}

function addAssertion(errors, assertion, code, artifacts) {
  try {
    assertion();
  } catch (error) {
    errors.push(issue(code, error.message, artifacts));
  }
}

export function stateIdentityErrors({
  contract,
  route,
  state,
} = {}) {
  const errors = [];
  const contractValue = contract?.value ?? contract;
  const contractFingerprint = contract?.fingerprint;
  if (contractValue && state && contractValue.taskId !== state.taskId) {
    errors.push(issue("E_STATE_TASK_MISMATCH", "Work state does not belong to the current contract task", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.state]));
  }
  if (contractFingerprint && state && state.contractFingerprint !== contractFingerprint) {
    errors.push(issue("E_CONTRACT_STALE", "Work state does not match the current contract", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.state]));
  }
  if (contractFingerprint && route && route.value.contractFingerprint !== contractFingerprint) {
    errors.push(issue("E_ROUTE_STALE", "Routing result does not match the current contract", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route]));
  }
  if (route && state && route.value.contractFingerprint !== undefined
    && route.value.contractFingerprint !== state.contractFingerprint) {
    errors.push(issue("E_ROUTE_STALE", "Routing result does not match the work state contract", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.state]));
  }
  if (route && state && (state.routeFingerprint !== route.fingerprint || !sameValue(state.selectedGuides, route.value.guides))) {
    errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "Work state does not match the persisted route identity", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.state]));
  }
  return errors;
}

export function assertStateIdentity(input) {
  const errors = stateIdentityErrors(input);
  if (errors.length === 0) return;
  const first = errors[0];
  const error = new Error(first.message);
  error.code = first.code;
  error.artifacts = first.artifacts;
  throw error;
}

export function completionRelationshipErrors({
  contract,
  route,
  state,
  receipt,
  requiredEvidence = [],
  requireReceiptStateFingerprint = true,
  requireRequiredChecks = true,
} = {}) {
  const errors = stateIdentityErrors({ contract, route, state });
  const contractValue = contract?.value ?? contract;
  const contractFingerprint = contract?.fingerprint;
  if (contractValue && receipt && contractValue.taskId !== receipt.taskId) {
    errors.push(issue("E_RECEIPT_TASK_MISMATCH", "Execution receipt does not belong to the current contract task", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt]));
  }
  if (route && receipt && (receipt.routeFingerprint !== route.fingerprint || !sameValue(receipt.selectedGuides, route.value.guides))) {
    errors.push(issue("E_ROUTE_GUIDE_MISMATCH", "Execution receipt does not match the persisted route identity", [ARTIFACT_PATHS.route, ARTIFACT_PATHS.receipt]));
  }
  if (contractFingerprint && receipt && receipt.contractFingerprint !== contractFingerprint) {
    errors.push(issue("E_RECEIPT_CONTRACT_MISMATCH", "Execution receipt does not match the current contract", [ARTIFACT_PATHS.contract, ARTIFACT_PATHS.receipt]));
  }

  if (state) {
    addAssertion(errors, () => assertCheckList(state.checks, "work-state.checks"), "E_CHECK_INVALID", [ARTIFACT_PATHS.state]);
    addAssertion(errors, () => assertEvidenceList(state.verificationEvidence, "work-state.verificationEvidence"), "E_EVIDENCE_INVALID", [ARTIFACT_PATHS.state]);
  }
  if (receipt) {
    addAssertion(errors, () => assertCheckList(receipt.checks, "receipt.checks"), "E_CHECK_INVALID", [ARTIFACT_PATHS.receipt]);
    addAssertion(errors, () => assertEvidenceList(receipt.evidence ?? [], "receipt.evidence"), "E_EVIDENCE_INVALID", [ARTIFACT_PATHS.receipt]);
    if (requireRequiredChecks) {
      for (const error of requiredChecksSatisfied(receipt.checks, requiredEvidence)) {
        errors.push(issue(error.code, error.message, [ARTIFACT_PATHS.receipt]));
      }
    }
  }

  const expectedCoverage = state ? coverageForRequirements(requiredEvidence, state.checks) : [];
  if (state?.evidenceCoverage !== undefined) {
    addAssertion(errors, () => assertCoverageList(state.evidenceCoverage, "work-state.evidenceCoverage"), "E_EVIDENCE_COVERAGE_INVALID", [ARTIFACT_PATHS.state]);
    if (!sameValue(state.evidenceCoverage, expectedCoverage)) {
      errors.push(issue("E_EVIDENCE_COVERAGE_INVALID", "Work state evidence coverage does not match its checks", [ARTIFACT_PATHS.state]));
    }
  }
  if (receipt) {
    if (receipt.evidenceCoverage === undefined) {
      errors.push(issue("E_EVIDENCE_COVERAGE_INVALID", "Execution receipt requires evidence coverage", [ARTIFACT_PATHS.receipt]));
    } else {
      addAssertion(errors, () => assertCoverageList(receipt.evidenceCoverage, "receipt.evidenceCoverage"), "E_EVIDENCE_COVERAGE_INVALID", [ARTIFACT_PATHS.receipt]);
      if (!sameValue(receipt.evidenceCoverage, expectedCoverage)) {
        errors.push(issue("E_EVIDENCE_COVERAGE_INVALID", "Execution receipt evidence coverage does not match current checks", [ARTIFACT_PATHS.receipt]));
      }
    }
  }

  if (state && receipt) {
    if (requireReceiptStateFingerprint && receipt.stateFingerprint === undefined) {
      errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Execution receipt requires the current work-state fingerprint", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
    } else if (receipt.stateFingerprint !== undefined && receipt.stateFingerprint !== canonicalFingerprint(state)) {
      errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Execution receipt does not match the recorded work state", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
    }
    if (!sameValue(state.checks, receipt.checks)) {
      errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Work state and execution receipt checks diverge", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
    }
    if (!sameValue(state.verificationEvidence, receipt.evidence ?? [])) {
      errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Work state and execution receipt evidence diverge", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
    }
    if (state.evidenceCoverage !== undefined && receipt.evidenceCoverage !== undefined
      && !sameValue(state.evidenceCoverage, receipt.evidenceCoverage)) {
      errors.push(issue("E_RECEIPT_STATE_MISMATCH", "Work state and execution receipt coverage diverge", [ARTIFACT_PATHS.state, ARTIFACT_PATHS.receipt]));
    }
  }
  return errors;
}

export function assertCompletionRelationships(input) {
  const errors = completionRelationshipErrors(input);
  if (errors.length === 0) return;
  const first = errors[0];
  const error = new Error(first.message);
  error.code = first.code;
  error.artifacts = first.artifacts;
  throw error;
}
