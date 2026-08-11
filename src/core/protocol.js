export const PROTOCOL_VERSION = 1;

export const FAILURE_CLASSES = Object.freeze([
  "CONTRACT_FAILURE",
  "DISCOVERY_FAILURE",
  "ROUTING_FAILURE",
  "IMPLEMENTATION_FAILURE",
  "VERIFICATION_FAILURE",
  "REGRESSION_FAILURE",
  "REVIEW_FAILURE",
  "CAPABILITY_FAILURE",
  "AUTHORITY_FAILURE",
  "ENVIRONMENT_FAILURE",
  "EXTERNAL_SERVICE_FAILURE",
  "STALE_STATE_FAILURE",
]);

export const WORK_PHASES = Object.freeze([
  "RECEIVED",
  "DISCOVERING",
  "CONTRACT_READY",
  "ROUTED",
  "DESIGNING",
  "PLANNED",
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
  "BLOCKED",
]);

export const GUIDE_IDS = Object.freeze([
  "premium",
  "clean",
  "test",
  "security",
  "design",
  "performance",
  "accessibility",
  "games",
]);

export const GUIDE_ORDER = GUIDE_IDS;

const TRANSITIONS = Object.freeze({
  RECEIVED: ["DISCOVERING"],
  DISCOVERING: ["CONTRACT_READY"],
  CONTRACT_READY: ["ROUTED"],
  ROUTED: ["DESIGNING", "PLANNED"],
  DESIGNING: ["PLANNED"],
  PLANNED: ["EXECUTING"],
  EXECUTING: ["VERIFYING"],
  VERIFYING: ["DIAGNOSING", "REVIEWING"],
  DIAGNOSING: ["CORRECTING"],
  CORRECTING: ["VERIFYING"],
  REVIEWING: ["COMPLETE", "CORRECTING"],
  COMPLETE: [],
  BLOCKED: [],
});

export function isValidTransition(from, to) {
  if (!WORK_PHASES.includes(from) || !WORK_PHASES.includes(to)) return false;
  if (to === "BLOCKED" && from !== "COMPLETE" && from !== "BLOCKED") return true;
  return TRANSITIONS[from].includes(to);
}

export function assertFailureClass(value) {
  if (!FAILURE_CLASSES.includes(value)) {
    throw new Error(`Unknown failure class: ${value}`);
  }
  return value;
}

export function assertWorkPhase(value) {
  if (!WORK_PHASES.includes(value)) {
    throw new Error(`Unknown work phase: ${value}`);
  }
  return value;
}
