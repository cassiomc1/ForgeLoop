import { buildTaskSnapshot } from "./task-snapshot.js";
import { diagnosisEventsForTask } from "./diagnosis-model.js";
import {
  assertDiagnosticCaseDetails,
  assertInterventionDetails,
  assertHypothesisDispositionDetails,
} from "./diagnostic-model.js";

export const EVENT_CATEGORIES = Object.freeze([
  "task",
  "contract",
  "routing",
  "lifecycle",
  "execution",
  "verification",
  "diagnosis",
  "intervention",
  "evidence",
  "review",
  "continuity",
  "recovery",
  "policy",
  "audit",
  "completion",
  "integrity",
]);

const EVENT_CATEGORY_MAP = Object.freeze({
  TASK_RECEIVED: "task",
  CONTRACT_VALIDATED: "contract",
  DECISION_CRITERION_RECORDED: "contract",
  PLAN_RECORDED: "contract",
  ROUTE_VALIDATED: "routing",
  PREFLIGHT_READY: "lifecycle",
  PREFLIGHT_BLOCKED: "lifecycle",
  EXECUTION_STARTED: "execution",
  VERIFICATION_STARTED: "lifecycle",
  VERIFICATION_RECORDED: "verification",
  CHECK_RECORDED: "verification",
  TERMINAL_RESULT_RECORDED: "verification",
  REVIEW_STARTED: "review",
  DIAGNOSIS_RECORDED: "diagnosis",
  DIAGNOSTIC_CASE_RECORDED: "diagnosis",
  HYPOTHESIS_DISPOSITION_RECORDED: "diagnosis",
  INTERVENTION_RECORDED: "intervention",
  CONTINUITY_RECORDED: "continuity",
  CHECKPOINT_RECONCILED: "continuity",
  TASK_RECOVERY_RECORDED: "recovery",
  TASK_RECOVERY_RESUMED: "recovery",
  OPERATOR_RECOVERY_RECORDED: "recovery",
  LEGACY_RECOVERY_MIGRATION_RECORDED: "recovery",
  GATE_SATISFIED: "policy",
  COMPLETION_VALIDATED: "completion",
  COMPLETION_REJECTED: "completion",
  TRANSACTION_COMMITTED: "integrity",
});

const LIFECYCLE_TRANSITIONS = Object.freeze([
  "CONTRACT_VALIDATED",
  "ROUTE_VALIDATED",
  "PREFLIGHT_READY",
  "EXECUTION_STARTED",
  "VERIFICATION_STARTED_PLACEHOLDER",
  "REVIEW_STARTED",
  "COMPLETION_VALIDATED",
  "COMPLETION_REJECTED",
]);

export function eventCategory(eventType) {
  return EVENT_CATEGORY_MAP[eventType] ?? "integrity";
}

export function timestampQuality(event) {
  if (typeof event?.at === "string" && !Number.isNaN(Date.parse(event.at))) return "authoritative";
  return "unknown";
}

function eventSummary(event) {
  const d = event.details ?? {};
  switch (event.event) {
    case "TASK_RECEIVED":
      return `Task received${d.taskId ? ` (${d.taskId})` : ""}`;
    case "CONTRACT_VALIDATED":
      return "Contract validated";
    case "ROUTE_VALIDATED":
      return `Route selected${Array.isArray(d.selectedGuides) ? `: ${d.selectedGuides.join(", ")}` : ""}`;
    case "PREFLIGHT_READY":
      return "Preflight READY";
    case "PREFLIGHT_BLOCKED":
      return "Preflight BLOCKED";
    case "EXECUTION_STARTED":
      return "Execution started";
    case "VERIFICATION_RECORDED": {
      const id = d.id ?? d.checkId ?? d.requirement ?? "check";
      return `${id} ${String(d.status ?? "recorded").toUpperCase()}${d.exitCode !== undefined ? ` (exit ${d.exitCode})` : ""}`;
    }
    case "TERMINAL_RESULT_RECORDED":
      return `Terminal result ${d.type ?? ""} ${d.status ?? ""}`.trim();
    case "REVIEW_STARTED":
      return `Review started${Number.isInteger(d.verificationCycle) ? ` for cycle ${d.verificationCycle}` : ""}`;
    case "DIAGNOSIS_RECORDED":
      return `Diagnosis recorded (${d.informationGain ?? "gain unknown"})`;
    case "DIAGNOSTIC_CASE_RECORDED":
      return `Diagnostic case recorded (cycle ${d.verificationCycle}, revision ${d.diagnosticRevision})`;
    case "INTERVENTION_RECORDED":
      return `Intervention recorded (${d.intervention?.id ?? "unknown"})`;
    case "HYPOTHESIS_DISPOSITION_RECORDED":
      return `Hypothesis ${d.hypothesisRef ?? "unknown"} ${d.status ?? "dispositioned"}`;
    case "DECISION_CRITERION_RECORDED":
      return "Decision criterion recorded";
    case "GATE_SATISFIED":
      return `Gate satisfied: ${d.gate ?? "unknown"}`;
    case "CHECKPOINT_RECONCILED":
      return "Checkpoint reconciled";
    case "CONTINUITY_RECORDED":
      return "Continuity checkpoint recorded";
    case "TASK_RECOVERY_RECORDED":
      return `Task recovery recorded (${d.classification ?? "unknown"})`;
    case "TASK_RECOVERY_RESUMED":
      return "Task resumed after recovery";
    case "OPERATOR_RECOVERY_RECORDED":
      return "Operator recovery recorded";
    case "LEGACY_RECOVERY_MIGRATION_RECORDED":
      return "Legacy recovery migration recorded";
    case "COMPLETION_VALIDATED":
      return "Completion validated";
    case "COMPLETION_REJECTED":
      return "Completion rejected";
    case "TRANSACTION_COMMITTED":
      return "Transaction committed";
    default:
      return event.event;
  }
}

export function normalizeProtocolEvent(event, context = {}) {
  const phase = typeof context.phase === "string" ? context.phase : null;
  return {
    sequence: event.seq,
    timestamp: event.at ?? null,
    timestampSource: "ledger",
    timestampQuality: timestampQuality(event),
    type: event.event,
    category: eventCategory(event.event),
    phase,
    source: {
      kind: "ledger",
      artifact: context.artifactPath ?? ".forgeloop/task-state/<task-key>/events.ndjson",
    },
    summary: eventSummary(event),
    data: event.details ?? {},
    references: {
      checkIds: [event.details?.id, event.details?.checkId].filter((v) => typeof v === "string"),
      evidenceRefs: Array.isArray(event.details?.evidenceRefs) ? event.details.evidenceRefs : [],
      hypothesisRefs: Array.isArray(event.details?.hypothesisRefs)
        ? event.details.hypothesisRefs
        : [event.details?.hypothesisRef].filter((v) => typeof v === "string"),
      interventionRefs: [event.details?.intervention?.id].filter((v) => typeof v === "string"),
      relatedSequences: [],
    },
    hash: event.hash,
  };
}

function lifecycleTransitions(events) {
  const transitions = [];
  let lastPhaseEvent = null;
  for (const event of events) {
    if (!LIFECYCLE_TRANSITIONS.includes(event.event)) continue;
    transitions.push({
      sequence: event.seq,
      at: event.at,
      type: event.event,
      details: event.details ?? {},
      previous: lastPhaseEvent?.type ?? null,
    });
    lastPhaseEvent = event;
  }
  return transitions;
}

function projectChecks(snapshot) {
  const state = snapshot.state;
  const attemptsByCheck = new Map();
  const pushAttempt = (key, attempt) => {
    if (!attemptsByCheck.has(key)) attemptsByCheck.set(key, []);
    attemptsByCheck.get(key).push(attempt);
  };

  for (const event of snapshot.events) {
    if (event.event !== "VERIFICATION_RECORDED") continue;
    const d = event.details ?? {};
    const key = d.id ?? d.checkId ?? d.requirement ?? null;
    if (!key) continue;
    pushAttempt(key, {
      sequence: event.seq,
      at: event.at,
      status: d.status ?? null,
      exitCode: d.exitCode ?? null,
      requirement: d.requirement ?? null,
      verificationCycle: d.verificationCycle ?? null,
      provenance: d.provenance ?? null,
      executionMode: d.provenance === "FORGELOOP_EXECUTED"
        ? "executed"
        : (d.provenance === "ACTOR_REPORTED" || d.provenance === "MANUAL_OBSERVATION" ? "observed" : (d.executionId ? "executed" : "unknown")),
      failureToken: d.failureToken ?? d.details?.failureToken ?? null,
    });
  }

  for (const check of state?.checks ?? []) {
    const key = check.id ?? check.checkId ?? null;
    if (!key) continue;
    pushAttempt(key, {
      sequence: null,
      at: check.at ?? check.lastUpdatedAt ?? null,
      status: check.status,
      exitCode: check.exitCode ?? null,
      requirement: check.requirement ?? null,
      verificationCycle: check.details?.verificationCycle ?? null,
      provenance: check.provenance ?? null,
      executionMode: check.provenance === "ACTOR_REPORTED" || check.provenance === "MANUAL_OBSERVATION" ? "observed" : "executed",
      failureToken: check.details?.failureToken ?? null,
    });
  }

  const checks = [];
  for (const [id, attempts] of [...attemptsByCheck.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    checks.push({
      id,
      requirement: attempts.findLast((a) => a.requirement)?.requirement ?? null,
      attemptCount: attempts.length,
      failedAttempts: attempts.filter((a) => a.status === "failed" || a.status === "blocked").length,
      currentResult: attempts.at(-1)?.status ?? null,
      attempts,
    });
  }
  return checks;
}

function legacyDiagnoses(events, taskId) {
  return diagnosisEventsForTask(events, taskId).map((event) => ({
    sequence: event.seq,
    at: event.at,
    sourceModel: "LEGACY_DIAGNOSIS_V1",
    ...event.details,
  }));
}

function structuredDiagnostics(events) {
  const cases = [];
  const interventions = [];
  const dispositions = [];
  for (const event of events) {
    try {
      if (event.event === "DIAGNOSTIC_CASE_RECORDED") {
        assertDiagnosticCaseDetails(event.details);
        cases.push({ sequence: event.seq, at: event.at, ...event.details });
      } else if (event.event === "INTERVENTION_RECORDED") {
        assertInterventionDetails(event.details);
        interventions.push({ sequence: event.seq, at: event.at, ...event.details });
      } else if (event.event === "HYPOTHESIS_DISPOSITION_RECORDED") {
        assertHypothesisDispositionDetails(event.details);
        dispositions.push({ sequence: event.seq, at: event.at, ...event.details });
      }
    } catch {
      // Invalid diagnostic details surface through ledger integrity errors;
      // projections must not crash on them.
    }
  }
  return { cases, interventions, dispositions };
}

export function historyQualityFor({ snapshot, normalizedEvents }) {
  const reasons = [];
  const hasLedger = normalizedEvents.length > 0;
  if (!hasLedger) reasons.push("LEDGER_ABSENT");
  if (normalizedEvents.some((event) => event.timestampQuality !== "authoritative")) {
    reasons.push("LEGACY_PHASE_TIMESTAMPS_UNAVAILABLE");
  }
  if (snapshot.state && Number.isInteger(snapshot.state.verificationCycle) && snapshot.state.verificationCycle > 1
    && !snapshot.events.some((event) => event.event === "DIAGNOSIS_RECORDED" || event.event === "DIAGNOSTIC_CASE_RECORDED")) {
    reasons.push("STRUCTURED_DIAGNOSTICS_UNAVAILABLE");
  }
  const level = reasons.length === 0 ? "COMPLETE" : (hasLedger ? "PARTIAL" : "MINIMAL");
  return { level, reasons };
}

export async function buildTaskTrace({ target, packageRoot, taskId = null, eventsPath = null } = {}) {
  const snapshot = await buildTaskSnapshot({ target, packageRoot, taskId, eventsPath });
  const artifactPath = eventsPath ?? ".forgeloop/task-state/<task-key>/events.ndjson";

  let currentPhase = snapshot.state?.phase ?? null;
  const normalizedEvents = [];
  const phaseBySequence = new Map();
  for (const event of snapshot.events) {
    const transitionPhases = {
      EXECUTION_STARTED: "EXECUTING",
      REVIEW_STARTED: "REVIEWING",
      COMPLETION_VALIDATED: "COMPLETE",
    };
    if (transitionPhases[event.event]) currentPhase = transitionPhases[event.event];
    phaseBySequence.set(event.seq, currentPhase);
    normalizedEvents.push(normalizeProtocolEvent(event, { phase: currentPhase, artifactPath }));
  }

  const integrity = {
    valid: snapshot.integrity.valid,
    errors: snapshot.integrity.errors,
  };
  const historyQuality = historyQualityFor({ snapshot, normalizedEvents });

  return {
    schemaVersion: 1,
    protocolVersion: 1,
    command: "trace",
    task: {
      id: snapshot.taskId,
      phase: snapshot.state?.phase ?? null,
      status: snapshot.state?.status ?? null,
      revision: snapshot.state?.revision ?? null,
      verificationCycle: snapshot.state?.verificationCycle ?? null,
      present: Boolean(snapshot.state),
    },
    snapshot: {
      consistent: snapshot.consistent,
      stateRevision: snapshot.anchors.stateRevision,
      ledgerTailSequence: snapshot.anchors.sequence,
      capturedAt: snapshot.capturedAt,
    },
    historyQuality,
    integrity,
    artifacts: {},
    events: normalizedEvents,
    transitions: lifecycleTransitions(snapshot.events),
    executions: [],
    checks: projectChecks(snapshot),
    evidence: [],
    diagnostics: {
      legacyDiagnoses: legacyDiagnoses(snapshot.events, snapshot.taskId),
      ...structuredDiagnostics(snapshot.events),
    },
    failureSignatures: [],
    failureSurfaces: [],
    continuity: [],
    recovery: [],
    policy: {},
    audit: {},
    completion: {},
  };
}
