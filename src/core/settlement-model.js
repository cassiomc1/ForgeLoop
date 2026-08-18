import { createHash } from "node:crypto";

export function normalizeDecisionText(value) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error("Decision text must be a non-empty string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

export function decisionId(decisionText) {
  const normalized = normalizeDecisionText(decisionText);
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `decision-${hash}`;
}

export function normalizeDecisionCriterionInput(input) {
  if (!input || typeof input !== "object") {
    const error = new Error("Decision criterion input must be an object");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  if (typeof input.decision !== "string" || !input.decision.trim()) {
    const error = new Error("decision must be a non-empty string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  if (typeof input.settledBy !== "string" || !input.settledBy.trim()) {
    const error = new Error("settledBy must be a non-empty string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  return {
    decision: input.decision.trim(),
    settledBy: input.settledBy.trim(),
  };
}

export function assertDecisionCriterionDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    const error = new Error("Decision criterion details must be an object");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  if (typeof details.decision !== "string" || !details.decision.trim()) {
    const error = new Error("Decision criterion decision must be a non-empty string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  const expectedId = decisionId(details.decision);
  if (details.decisionId !== expectedId) {
    const error = new Error(`Decision criterion decisionId "${details.decisionId}" does not match computed "${expectedId}"`);
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  if (typeof details.settledBy !== "string" || !details.settledBy.trim()) {
    const error = new Error("Decision criterion settledBy must be a non-empty string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  if (typeof details.contractFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(details.contractFingerprint)) {
    const error = new Error("Decision criterion contractFingerprint must be a 64-char hex string");
    error.code = "E_DECISION_CRITERION_INVALID";
    throw error;
  }
  return details;
}

export function decisionCriterionEvents(events, taskId) {
  if (!Array.isArray(events)) return [];
  return events.filter((e) => e.event === "DECISION_CRITERION_RECORDED" && (!taskId || e.taskId === taskId));
}

export function criterionForDecision(events, taskId, decisionText, contractFingerprint) {
  const decId = decisionId(decisionText);
  const taskEvents = decisionCriterionEvents(events, taskId);
  for (let i = taskEvents.length - 1; i >= 0; i--) {
    const details = taskEvents[i].details;
    if (details?.decisionId === decId && (!contractFingerprint || details?.contractFingerprint === contractFingerprint)) {
      return details;
    }
  }
  return null;
}
