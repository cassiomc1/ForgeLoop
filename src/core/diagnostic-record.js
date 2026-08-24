import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { readWorkState, mutateWorkState } from "./work-state.js";
import {
  DIAGNOSTIC_SCHEMA_VERSION,
  assertDiagnosticCaseDetails,
  assertHypothesisDispositionDetails,
  assertInterventionDetails,
  diagnosticSemanticFingerprint,
  interventionSemanticFingerprint,
} from "./diagnostic-model.js";

export {
  DIAGNOSTIC_SCHEMA_VERSION,
  assertDiagnosticCaseDetails,
  assertInterventionDetails,
  assertHypothesisDispositionDetails,
};

function stateError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function requireActiveState(target, { packageRoot, taskId }) {
  const state = await readWorkState(target, { packageRoot, taskId });
  if (!state) throw stateError("E_STATE_MISSING", "Work state not found");
  if (typeof state.verificationCycle !== "number" || state.verificationCycle < 1) {
    throw stateError("E_DIAGNOSTIC_CASE_CYCLE_MISMATCH", "Active verification cycle must be an integer >= 1");
  }
  return state;
}

async function requireValidLedger(target, packageRoot, taskId) {
  const ledger = await validateEventLedger(target, packageRoot, { taskId: taskId ?? null });
  if (!ledger.valid) {
    throw stateError(ledger.errors[0].code ?? "E_EVENT_INVALID", ledger.errors[0].message);
  }
  return ledger;
}

export function legacyDiagnosisToDiagnosticCase(diagnosisDetails) {
  if (!diagnosisDetails || typeof diagnosisDetails !== "object") return null;
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    verificationCycle: diagnosisDetails.verificationCycle,
    diagnosticRevision: 1,
    failureClass: diagnosisDetails.failureClass,
    observations: (diagnosisDetails.evidenceRefs ?? []).map((ref, index) => ({
      id: `obs-legacy-${index + 1}`,
      kind: "CHECK_RESULT",
      evidenceRef: ref,
      statement: `Legacy diagnosis bound evidence ${ref}.`,
    })),
    contributors: [],
    hypotheses: [
      {
        id: "h-legacy",
        statement: diagnosisDetails.hypothesis,
        contributorRefs: [],
        evidenceRefs: [...(diagnosisDetails.evidenceRefs ?? [])],
        settledBy: { type: "PREDICATE", statement: diagnosisDetails.settledBy },
        status: "OPEN",
      },
    ],
    nextSafeAction: { statement: diagnosisDetails.nextSafeAction },
    diagnosticFingerprint: diagnosisDetails.diagnosisFingerprint,
    previousDiagnosticFingerprint: diagnosisDetails.previousDiagnosisFingerprint ?? null,
    sourceModel: "LEGACY_DIAGNOSIS_V1",
  };
}

export async function recordStructuredDiagnosticCase({
  target,
  packageRoot,
  caseFile = null,
  caseInput = null,
  taskId = null,
}) {
  let parsed;
  if (caseFile) {
    const { readFile } = await import("node:fs/promises");
    const { assertSafePath, ensureWithin } = await import("./filesystem.js");
    await assertSafePath(target, caseFile);
    const absolute = ensureWithin(target, caseFile);
    try {
      parsed = JSON.parse(await readFile(absolute, "utf8"));
    } catch (error) {
      throw stateError("E_DIAGNOSTIC_CASE_INVALID", `diagnostic case file is not valid JSON: ${error.message}`);
    }
  } else {
    parsed = caseInput;
  }

  const state = await requireActiveState(target, { packageRoot, taskId });
  if (state.phase !== "DIAGNOSING") {
    throw stateError("E_PHASE_PREREQUISITE_MISSING", `Recording a structured diagnostic case requires phase DIAGNOSING, currently ${state.phase}`);
  }
  const ledger = await requireValidLedger(target, packageRoot, state.taskId);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw stateError("E_DIAGNOSTIC_CASE_INVALID", "diagnostic case must be a JSON object");
  }
  if (Number.isInteger(parsed.verificationCycle) && parsed.verificationCycle !== state.verificationCycle) {
    throw stateError("E_DIAGNOSTIC_CASE_CYCLE_MISMATCH", `case verificationCycle ${parsed.verificationCycle} does not match active cycle ${state.verificationCycle}`);
  }

  for (const hypothesis of parsed.hypotheses ?? []) {
    for (const ref of hypothesis.evidenceRefs ?? []) {
      const check = (state.checks ?? []).find(
        (candidate) => candidate.details?.verificationCycle === state.verificationCycle
          && (candidate.id === ref || candidate.checkId === ref),
      );
      if (!check) {
        throw stateError("E_DIAGNOSTIC_CASE_EVIDENCE_INVALID", `evidenceRef "${ref}" does not match any check from verification cycle ${state.verificationCycle}`);
      }
    }
  }

  const previousCases = ledger.events.filter(
    (event) => event.event === "DIAGNOSTIC_CASE_RECORDED"
      && event.taskId === state.taskId
      && event.details?.verificationCycle === state.verificationCycle,
  );
  const previousCase = previousCases.at(-1)?.details ?? null;
  const revision = (previousCase?.diagnosticRevision ?? 0) + 1;

  const details = {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    verificationCycle: state.verificationCycle,
    diagnosticRevision: revision,
    failureClass: parsed.failureClass,
    observations: parsed.observations ?? [],
    contributors: parsed.contributors ?? [],
    hypotheses: (parsed.hypotheses ?? []).map((hypothesis) => ({ ...hypothesis, status: "OPEN" })),
    nextSafeAction: parsed.nextSafeAction,
  };
  details.diagnosticFingerprint = diagnosticSemanticFingerprint({
    verificationCycle: details.verificationCycle,
    failureClass: details.failureClass,
    case_: details,
  });
  details.previousDiagnosticFingerprint = previousCase?.diagnosticFingerprint ?? null;

  if (previousCase && previousCase.diagnosticFingerprint === details.diagnosticFingerprint) {
    return {
      event: previousCases.at(-1),
      state,
      diagnosticCase: previousCase,
      idempotent: true,
    };
  }

  assertDiagnosticCaseDetails(details);

  const event = await appendProtocolEvent(
    target,
    { taskId: state.taskId, event: "DIAGNOSTIC_CASE_RECORDED", details },
    packageRoot,
    { taskId: taskId ?? null },
  );

  const updatedState = await mutateWorkState(target, {
    expectedRevision: state.revision ?? 0,
    packageRoot,
    taskId,
  }, () => ({
    ...state,
    diagnosedHypothesis: details.hypotheses[0]?.statement ?? state.diagnosedHypothesis,
    lastUpdated: new Date().toISOString(),
  }));

  return { event, state: updatedState, diagnosticCase: details, idempotent: false };
}

export async function recordIntervention({
  target,
  packageRoot,
  interventionFile = null,
  interventionInput = null,
  taskId = null,
}) {
  let parsed;
  if (interventionFile) {
    const { readFile } = await import("node:fs/promises");
    const { assertSafePath, ensureWithin } = await import("./filesystem.js");
    await assertSafePath(target, interventionFile);
    try {
      parsed = JSON.parse(await readFile(ensureWithin(target, interventionFile), "utf8"));
    } catch (error) {
      throw stateError("E_INTERVENTION_INVALID", `intervention file is not valid JSON: ${error.message}`);
    }
  } else {
    parsed = interventionInput;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw stateError("E_INTERVENTION_INVALID", "intervention must be a JSON object");
  }

  const state = await requireActiveState(target, { packageRoot, taskId });
  if (state.phase !== "CORRECTING") {
    throw stateError("E_PHASE_PREREQUISITE_MISSING", `Recording an intervention requires phase CORRECTING, currently ${state.phase}`);
  }
  const ledger = await requireValidLedger(target, packageRoot, state.taskId);

  const knownHypothesisIds = new Set();
  for (const event of ledger.events) {
    if (event.event !== "DIAGNOSTIC_CASE_RECORDED" && event.event !== "DIAGNOSIS_RECORDED") continue;
    if (event.taskId !== state.taskId) continue;
    if (event.event === "DIAGNOSTIC_CASE_RECORDED") {
      for (const hypothesis of event.details?.hypotheses ?? []) knownHypothesisIds.add(hypothesis.id);
    } else {
      knownHypothesisIds.add("h-legacy");
    }
  }
  for (const ref of parsed.hypothesisRefs ?? []) {
    if (!knownHypothesisIds.has(ref)) {
      throw stateError("E_INTERVENTION_REFERENCE_INVALID", `intervention references unknown hypothesis "${ref}"`);
    }
  }

  const details = {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    verificationCycle: state.verificationCycle,
    intervention: {
      id: parsed.id,
      kind: parsed.kind,
      statement: parsed.statement,
      ...(Array.isArray(parsed.targets) ? { targets: parsed.targets } : {}),
      hypothesisRefs: parsed.hypothesisRefs ?? [],
      ...(typeof parsed.expectedObservation === "string" ? { expectedObservation: parsed.expectedObservation } : {}),
      ...(typeof parsed.reversible === "boolean" ? { reversible: parsed.reversible } : {}),
    },
  };
  details.interventionSemanticFingerprint = interventionSemanticFingerprint(details);
  assertInterventionDetails(details);

  const priorInterventions = ledger.events.filter(
    (event) => event.event === "INTERVENTION_RECORDED"
      && event.taskId === state.taskId
      && event.details?.interventionSemanticFingerprint === details.interventionSemanticFingerprint,
  );
  const repeatedWithoutGain = priorInterventions.length > 0;

  const event = await appendProtocolEvent(
    target,
    { taskId: state.taskId, event: "INTERVENTION_RECORDED", details },
    packageRoot,
    { taskId: taskId ?? null },
  );

  return { event, state, intervention: details, repeatedWithoutGain };
}

export async function recordHypothesisDisposition({
  target,
  packageRoot,
  hypothesisRef,
  status,
  evidenceRefs = [],
  reason,
  taskId = null,
}) {
  const state = await requireActiveState(target, { packageRoot, taskId });
  const ledger = await requireValidLedger(target, packageRoot, state.taskId);

  const taskDiagnosticEvents = ledger.events.filter(
    (event) => ["DIAGNOSTIC_CASE_RECORDED", "DIAGNOSIS_RECORDED"].includes(event.event) && event.taskId === state.taskId,
  );
  const sourceCase = taskDiagnosticEvents.findLast(
    (event) => event.event === "DIAGNOSTIC_CASE_RECORDED"
      && (event.details?.hypotheses ?? []).some((hypothesis) => hypothesis.id === hypothesisRef),
  )?.details ?? null;

  const currentStatus = (() => {
    if (sourceCase) return "OPEN";
    const lastDisposition = ledger.events.findLast(
      (event) => event.event === "HYPOTHESIS_DISPOSITION_RECORDED"
        && event.taskId === state.taskId
        && event.details?.hypothesisRef === hypothesisRef,
    );
    return lastDisposition?.details?.status ?? "OPEN";
  })();
  const knownHypothesisIds = new Set();
  for (const event of taskDiagnosticEvents) {
    if (event.event === "DIAGNOSTIC_CASE_RECORDED") {
      for (const hypothesis of event.details?.hypotheses ?? []) knownHypothesisIds.add(hypothesis.id);
    } else {
      knownHypothesisIds.add("h-legacy");
    }
  }
  if (!knownHypothesisIds.has(hypothesisRef)) {
    throw stateError("E_HYPOTHESIS_DISPOSITION_INVALID", `unknown hypothesis "${hypothesisRef}"`);
  }

  const allowedTransitions = { OPEN: "*", SUPPORTED: ["WEAKENED", "FALSIFIED", "SUPERSEDED"], WEAKENED: ["SUPPORTED", "FALSIFIED", "SUPERSEDED"] };
  const allowed = allowedTransitions[currentStatus];
  if (Array.isArray(allowed) && !allowed.includes(status)) {
    throw stateError("E_HYPOTHESIS_DISPOSITION_INVALID", `disposition transition ${currentStatus} -> ${status} is not allowed`);
  }

  for (const ref of evidenceRefs) {
    const check = (state.checks ?? []).find(
      (candidate) => candidate.details?.verificationCycle === state.verificationCycle
        && (candidate.id === ref || candidate.checkId === ref),
    );
    if (!check) {
      throw stateError("E_HYPOTHESIS_DISPOSITION_EVIDENCE_INVALID", `evidenceRef "${ref}" does not match any check from verification cycle ${state.verificationCycle}`);
    }
  }

  const details = {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    verificationCycle: state.verificationCycle,
    hypothesisRef,
    status,
    evidenceRefs: [...new Set(evidenceRefs)],
    reason,
  };
  assertHypothesisDispositionDetails(details);

  const event = await appendProtocolEvent(
    target,
    { taskId: state.taskId, event: "HYPOTHESIS_DISPOSITION_RECORDED", details },
    packageRoot,
    { taskId: taskId ?? null },
  );

  return { event, state, disposition: details };
}
