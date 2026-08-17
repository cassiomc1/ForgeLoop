
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { ARTIFACT_PATHS, canonicalFingerprint } from "./artifacts.js";
import { assertJsonBytes, assertJsonLimits } from "./json-safety.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { isRecoverableCompletionEvidenceCode } from "./completion-recovery.js";

import { taskArtifactPath } from "./task-paths.js";

const EVENT_SCHEMA_VERSION = 1;
export const LIFECYCLE_MILESTONES = Object.freeze([
  "CONTRACT_VALIDATED",
  "ROUTE_VALIDATED",
  "PREFLIGHT_READY",
  "EXECUTION_STARTED",
  "VERIFICATION_STARTED",
  "VERIFICATION_RECORDED",
  "COMPLETION_VALIDATED",
]);
export const ACTIVATION_EVENT_MATRIX = Object.freeze([
  Object.freeze({ stage: "task received", event: "TASK_RECEIVED", requiredFor: "new activation" }),
  Object.freeze({ stage: "contract validated", event: "CONTRACT_VALIDATED", requiredFor: "preflight readiness" }),
  Object.freeze({ stage: "route validated", event: "ROUTE_VALIDATED", requiredFor: "preflight readiness" }),
  Object.freeze({ stage: "gate satisfied", event: "GATE_SATISFIED", requiredFor: "each satisfied gate" }),
  Object.freeze({ stage: "preflight blocked", event: "PREFLIGHT_BLOCKED", requiredFor: "blocked activation" }),
  Object.freeze({ stage: "preflight ready", event: "PREFLIGHT_READY", requiredFor: "resumable readiness" }),
]);
const REPEATABLE_MILESTONES = new Set([
  "VERIFICATION_STARTED",
  "VERIFICATION_RECORDED",
  "REVIEW_STARTED",
  "TERMINAL_RESULT_RECORDED",
]);

function eventHash(event) {
  const { hash, ...body } = event;
  return canonicalFingerprint(body);
}

function protocolError(code, message, artifacts = [ARTIFACT_PATHS.events]) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

export async function readEvents(target, packageRoot, options = {}) {
  const relPath = options?.eventsPath ?? options?.relativePath ?? (options?.taskId ? taskArtifactPath(options.taskId, "events") : ARTIFACT_PATHS.events);
  await assertSafePath(target, relPath);
  const eventsPath = ensureWithin(target, relPath);
  if (!(await fileExists(eventsPath))) return [];
  const text = await readFile(eventsPath, "utf8");
  assertJsonBytes(text, relPath);
  const schema = await readSchema("event", packageRoot);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
      assertJsonLimits(event, `${relPath}[${index}]`);
      assertSchema(event, schema, `${relPath}[${index}]`);
    } catch (error) {
      throw protocolError("E_EVENT_INVALID", `${relPath} line ${index + 1}: ${error.message}`, [relPath]);
    }
    return event;
  });
}

export async function appendProtocolEvent(target, input, packageRoot, options = {}) {
  if (typeof input?.taskId !== "string" || !input.taskId) throw protocolError("E_EVENT_INVALID", "event taskId is required");
  if (typeof input?.event !== "string" || !input.event) throw protocolError("E_EVENT_INVALID", "event type is required");
  const relPath = options?.eventsPath ?? options?.relativePath ?? (options?.taskId ? taskArtifactPath(options.taskId, "events") : ARTIFACT_PATHS.events);
  const events = await readEvents(target, packageRoot, { ...options, eventsPath: relPath });
  const previous = events.at(-1) ?? null;
  const event = {
    seq: events.length + 1,
    schemaVersion: EVENT_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    event: input.event,
    at: input.at ?? new Date().toISOString(),
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    previousHash: previous?.hash ?? null,
    ...(input.details ? { details: structuredClone(input.details) } : {}),
  };
  assertSecretFree(event);
  const schema = await readSchema("event", packageRoot);
  assertSchema(event, schema, relPath);
  event.hash = eventHash(event);
  const eventsPath = ensureWithin(target, relPath);
  if (!options.dryRun) {
    await mkdir(path.dirname(eventsPath), { recursive: true });
    await appendFile(eventsPath, `${JSON.stringify(event)}\n`, { encoding: "utf8" });
  }
  return event;
}

export async function validateEventLedger(target, packageRoot, options = {}) {
  const relPath = options?.eventsPath ?? options?.relativePath ?? (options?.taskId ? taskArtifactPath(options.taskId, "events") : ARTIFACT_PATHS.events);
  let events;
  try {
    events = await readEvents(target, packageRoot, { ...options, eventsPath: relPath });
  } catch (error) {
    return { valid: false, events: [], errors: [{ code: error.code ?? "E_EVENT_INVALID", message: error.message, artifacts: [relPath] }] };
  }
  const errors = [];
  let taskId = null;
  const seen = new Set();
  let lastMilestone = -1;
  const milestoneCounts = new Map();
  for (const [index, event] of events.entries()) {
    if (event.seq !== index + 1) {
      errors.push({ code: "E_EVENT_INVALID", message: `event sequence must be ${index + 1}` });
    }
    if (taskId === null) taskId = event.taskId;
    if (event.taskId !== taskId) errors.push({ code: "E_EVENT_INVALID", message: "event task IDs must remain stable" });
    if (event.previousHash !== (index === 0 ? null : events[index - 1].hash)) {
      errors.push({ code: "E_LEDGER_HASH_INVALID", message: `event ${event.seq} previousHash does not match` });
    }
    if (event.hash !== eventHash(event)) {
      errors.push({ code: "E_LEDGER_HASH_INVALID", message: `event ${event.seq} hash does not match its content` });
    }
    const milestoneIndex = LIFECYCLE_MILESTONES.indexOf(event.event);
    if (milestoneIndex >= 0) {
      const count = (milestoneCounts.get(event.event) ?? 0) + 1;
      milestoneCounts.set(event.event, count);
      if (count > 1 && !REPEATABLE_MILESTONES.has(event.event)) {
        errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: `lifecycle milestone must not repeat: ${event.event}` });
      }
      if (milestoneIndex > lastMilestone + 1) {
        errors.push({
          code: "E_PHASE_CHRONOLOGY_INVALID",
          message: `${event.event} is missing prerequisite milestone: ${LIFECYCLE_MILESTONES[lastMilestone + 1]}`,
        });
      } else if (milestoneIndex < lastMilestone && event.event !== "VERIFICATION_STARTED") {
        errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: `${event.event} is out of lifecycle order` });
      } else if (milestoneIndex === lastMilestone && !REPEATABLE_MILESTONES.has(event.event)) {
        errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: `lifecycle milestone must not repeat: ${event.event}` });
      }
      if (milestoneIndex > lastMilestone) lastMilestone = milestoneIndex;
    }
    seen.add(event.event);
    if (event.event === "EXECUTION_STARTED" && !seen.has("ROUTE_VALIDATED")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "execution started before route validation" });
    }
    if (event.event === "EXECUTION_STARTED" && !seen.has("CONTRACT_VALIDATED")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "execution started before contract validation" });
    }
    if (event.event === "EXECUTION_STARTED" && !seen.has("PREFLIGHT_READY")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "execution started before preflight readiness" });
    }
    if (event.event === "EXECUTION_STARTED") {
      const preflight = events.slice(0, index).findLast((candidate) => candidate.event === "PREFLIGHT_READY");
      const requiredGates = preflight?.details?.requiredGates ?? [];
      const satisfiedGates = new Set(events.slice(0, index)
        .filter((candidate) => candidate.event === "GATE_SATISFIED")
        .map((candidate) => candidate.details?.gate));
      for (const gate of requiredGates) {
        if (!satisfiedGates.has(gate)) {
          errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: `execution started before gate satisfaction: ${gate}` });
        }
      }
    }
    if (event.event === "VERIFICATION_RECORDED" && !seen.has("VERIFICATION_STARTED")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "verification evidence recorded before verification started" });
    }
    if (event.event === "COMPLETION_VALIDATED" && !seen.has("VERIFICATION_RECORDED")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "completion validated before verification evidence" });
    }
    if (event.event === "COMPLETION_REJECTED" && !seen.has("VERIFICATION_STARTED")) {
      errors.push({ code: "E_PHASE_CHRONOLOGY_INVALID", message: "completion rejected before verification started" });
    }
  }
  return { valid: errors.length === 0, events, errors };
}

export function validateStateLedgerCoherence(state, events) {
  const errors = [];
  if (!Number.isInteger(state.verificationCycle)) return errors;
  const taskEvents = events.filter((event) => event.taskId === state.taskId);
  const observed = new Set(taskEvents.map((event) => event.event));
  const supportsReviewEvents = taskEvents.some((event) => event.event === "REVIEW_STARTED"
    || (event.event === "VERIFICATION_STARTED" && Number.isInteger(event.details?.verificationCycle)));
  const phaseRequirements = {
    EXECUTING: ["EXECUTION_STARTED"],
    VERIFYING: ["EXECUTION_STARTED", "VERIFICATION_STARTED"],
    DIAGNOSING: ["EXECUTION_STARTED", "VERIFICATION_STARTED"],
    CORRECTING: ["EXECUTION_STARTED", "VERIFICATION_STARTED"],
    REVIEWING: ["EXECUTION_STARTED", "VERIFICATION_STARTED", ...(supportsReviewEvents ? ["REVIEW_STARTED"] : [])],
    COMPLETE: ["EXECUTION_STARTED", "VERIFICATION_STARTED", ...(supportsReviewEvents ? ["REVIEW_STARTED"] : []), "COMPLETION_VALIDATED"],
  };
  for (const required of phaseRequirements[state.phase] ?? []) {
    if (!observed.has(required)) {
      errors.push({
        code: "E_STATE_LEDGER_DIVERGENCE",
        message: `Work-state phase ${state.phase} requires ledger event ${required}`,
      });
    }
  }
  if (Number.isInteger(state.verificationCycle)) {
    const verificationEvents = taskEvents
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.event === "VERIFICATION_STARTED");
    const cycles = verificationEvents.map(({ event }) => event.details?.verificationCycle ?? 1);
    if (cycles.at(-1) !== state.verificationCycle) {
      errors.push({
        code: "E_STATE_LEDGER_DIVERGENCE",
        message: "Work-state verification cycle does not match the lifecycle ledger",
      });
    }
    const latestVerification = verificationEvents.at(-1);
    const latestReview = taskEvents
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.event === "REVIEW_STARTED")
      .at(-1);
    const latestReviewCycle = latestReview?.event.details?.verificationCycle;
    if (state.phase === "VERIFYING"
      && latestReviewCycle === state.verificationCycle
      && latestReview.index > (latestVerification?.index ?? -1)) {
      errors.push({
        code: "E_STATE_LEDGER_DIVERGENCE",
        message: "Work-state returned to VERIFYING without a new verification cycle in the lifecycle ledger",
      });
    }
    if (["REVIEWING", "COMPLETE"].includes(state.phase)
      && supportsReviewEvents
      && (latestReviewCycle !== state.verificationCycle
        || latestReview.index < (latestVerification?.index ?? -1))) {
      errors.push({
        code: "E_STATE_LEDGER_DIVERGENCE",
        message: "Work-state review phase does not match the current lifecycle ledger cycle",
      });
    }
  }
  return errors;
}

export function validateCompletionRecoveryAuthorization({ state, receipt, events } = {}) {
  const errors = [];
  if (!state) {
    return {
      authorized: false,
      errors: [{ code: "E_STATE_MISSING", message: "Work-state is required for recovery validation" }],
    };
  }
  const attempt = state.lastCompletionAttempt;
  if (!attempt || attempt.status !== "REJECTED") {
    return {
      authorized: false,
      errors: [{ code: "E_COMPLETION_RECOVERY_UNAUTHORIZED", message: "Recovery requires a persisted REJECTED completion attempt" }],
    };
  }
  const hasRecoverableReason = Array.isArray(attempt.reasonCodes)
    && attempt.reasonCodes.length > 0
    && attempt.reasonCodes.every((code) => isRecoverableCompletionEvidenceCode(code));
  if (!hasRecoverableReason) {
    return {
      authorized: false,
      errors: [{ code: "E_COMPLETION_RECOVERY_UNAUTHORIZED", message: "Completion attempt contains no recoverable evidence reason codes" }],
    };
  }

  const taskEvents = (events ?? []).filter((event) => event.taskId === state.taskId);
  const targetCycle = state.verificationCycle ?? 1;

  if (attempt.verificationCycle !== targetCycle) {
    errors.push({
      code: "E_COMPLETION_REJECTION_LEDGER_MISMATCH",
      message: `Work-state rejection verificationCycle ${attempt.verificationCycle} does not match state verificationCycle ${targetCycle}`,
    });
    return { authorized: false, errors };
  }

  const reviewEvents = taskEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.event === "REVIEW_STARTED" && (event.details?.verificationCycle ?? 1) === targetCycle);
  const latestReviewIndex = reviewEvents.at(-1)?.index ?? -1;

  const rejectionEvents = taskEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.event === "COMPLETION_REJECTED");

  if (rejectionEvents.length === 0) {
    errors.push({
      code: "E_COMPLETION_RECOVERY_UNAUTHORIZED",
      message: "No COMPLETION_REJECTED event found in protocol ledger",
    });
    return { authorized: false, errors };
  }

  const matchingEvent = rejectionEvents.findLast(({ event, index }) => {
    const eventCycle = event.details?.verificationCycle ?? 1;
    if (eventCycle !== targetCycle) return false;
    if (latestReviewIndex >= 0 && index < latestReviewIndex) return false;
    return true;
  });

  if (!matchingEvent) {
    errors.push({
      code: "E_COMPLETION_REJECTION_LEDGER_MISMATCH",
      message: `No matching COMPLETION_REJECTED event found for verification cycle ${targetCycle}`,
    });
    return { authorized: false, errors };
  }

  const eventDetails = matchingEvent.event.details ?? {};
  const stateReasons = [...new Set(attempt.reasonCodes ?? [])].sort();
  const eventReasons = [...new Set(eventDetails.reasonCodes ?? [])].sort();
  if (stateReasons.join(",") !== eventReasons.join(",")) {
    errors.push({
      code: "E_COMPLETION_REJECTION_LEDGER_MISMATCH",
      message: "Work-state rejection reasonCodes do not match ledger COMPLETION_REJECTED event",
    });
  }

  const stateMissing = [...new Set(attempt.missingRequirementIds ?? [])].sort();
  const eventMissing = [...new Set(eventDetails.missingRequirementIds ?? [])].sort();
  if (stateMissing.join(",") !== eventMissing.join(",")) {
    errors.push({
      code: "E_COMPLETION_REJECTION_LEDGER_MISMATCH",
      message: "Work-state missingRequirementIds do not match ledger COMPLETION_REJECTED event",
    });
  }

  const currentStateFingerprint = canonicalFingerprint(state);
  if (eventDetails.stateFingerprint && eventDetails.stateFingerprint !== currentStateFingerprint) {
    errors.push({
      code: "E_COMPLETION_REJECTION_STATE_FINGERPRINT_MISMATCH",
      message: "Current work-state no longer matches the rejected completion snapshot",
    });
  }

  if (eventDetails.receiptFingerprint !== undefined) {
    const currentReceiptFingerprint = receipt ? canonicalFingerprint(receipt) : undefined;
    if (currentReceiptFingerprint !== eventDetails.receiptFingerprint) {
      errors.push({
        code: "E_COMPLETION_REJECTION_RECEIPT_FINGERPRINT_MISMATCH",
        message: "Current receipt no longer matches the rejected completion snapshot",
      });
    }
  }

  return {
    authorized: errors.length === 0,
    errors,
  };
}
