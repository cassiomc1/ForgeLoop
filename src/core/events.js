import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { ARTIFACT_PATHS, canonicalFingerprint } from "./artifacts.js";
import { assertJsonBytes, assertJsonLimits } from "./json-safety.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { PROTOCOL_VERSION } from "./protocol.js";

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
const REPEATABLE_MILESTONES = new Set(["VERIFICATION_RECORDED"]);

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

async function readEvents(target, packageRoot) {
  await assertSafePath(target, ARTIFACT_PATHS.events);
  const eventsPath = ensureWithin(target, ARTIFACT_PATHS.events);
  if (!(await fileExists(eventsPath))) return [];
  const text = await readFile(eventsPath, "utf8");
  assertJsonBytes(text, ARTIFACT_PATHS.events);
  const schema = await readSchema("event", packageRoot);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
      assertJsonLimits(event, `${ARTIFACT_PATHS.events}[${index}]`);
      assertSchema(event, schema, `${ARTIFACT_PATHS.events}[${index}]`);
    } catch (error) {
      throw protocolError("E_EVENT_INVALID", `${ARTIFACT_PATHS.events} line ${index + 1}: ${error.message}`);
    }
    return event;
  });
}

export async function appendProtocolEvent(target, input, packageRoot, options = {}) {
  if (typeof input?.taskId !== "string" || !input.taskId) throw protocolError("E_EVENT_INVALID", "event taskId is required");
  if (typeof input?.event !== "string" || !input.event) throw protocolError("E_EVENT_INVALID", "event type is required");
  const events = await readEvents(target, packageRoot);
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
  assertSchema(event, schema, ARTIFACT_PATHS.events);
  event.hash = eventHash(event);
  const eventsPath = ensureWithin(target, ARTIFACT_PATHS.events);
  if (!options.dryRun) {
    await mkdir(path.dirname(eventsPath), { recursive: true });
    await appendFile(eventsPath, `${JSON.stringify(event)}\n`, { encoding: "utf8" });
  }
  return event;
}

export async function validateEventLedger(target, packageRoot) {
  let events;
  try {
    events = await readEvents(target, packageRoot);
  } catch (error) {
    return { valid: false, events: [], errors: [{ code: error.code ?? "E_EVENT_INVALID", message: error.message }] };
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
      } else if (milestoneIndex < lastMilestone) {
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
  }
  return { valid: errors.length === 0, events, errors };
}
