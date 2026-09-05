// Executable protocol example for tests; not a runtime authority.
import { canAskUser } from "./decision-classification.js";

export const QUESTION_SOURCES = Object.freeze([
  "USER_REQUIREMENT",
  "FORGELOOP_BLOCKING_DECISION",
  "EXTERNAL_WORKFLOW_POLICY",
  "MODEL_PREFERENCE",
]);

export const EXTERNAL_WORKFLOW_REASON_CODES = Object.freeze({
  APPROVAL_CONFLICT: "E_EXTERNAL_WORKFLOW_APPROVAL_CONFLICT",
  BLOCKS_NON_BLOCKING: "E_EXTERNAL_WORKFLOW_BLOCKS_NON_BLOCKING",
  REQUIRES_USER_GATE: "E_EXTERNAL_WORKFLOW_REQUIRES_USER_GATE",
});

const DECISION_CLASSIFICATIONS = new Set(["NON_BLOCKING", "BLOCKING"]);

function normalizeDecision(value) {
  if (typeof value === "string") {
    if (!DECISION_CLASSIFICATIONS.has(value)) {
      throw new TypeError(`forgeLoopDecision classification is invalid: ${value}`);
    }
    return {
      classification: value,
      reasonCode: value === "NON_BLOCKING" ? "SAFE_REVERSIBLE_LOCAL_DEFAULT" : null,
      blockingReason: null,
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("forgeLoopDecision must be a decision object or classification");
  }
  if (!DECISION_CLASSIFICATIONS.has(value.classification)) {
    throw new TypeError(`forgeLoopDecision classification is invalid: ${value.classification}`);
  }
  return {
    classification: value.classification,
    reasonCode: value.reasonCode ?? null,
    blockingReason: value.blockingReason ?? null,
  };
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean`);
}

function workflowName(value) {
  if (value === undefined) return "external-workflow";
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("workflowName must be a non-empty string");
  }
  return value;
}

function compatibleResult({ decision, name, autonomousMode, requiresUserApproval }) {
  return {
    status: "COMPATIBLE",
    compatible: true,
    autonomousMode,
    workflowName: name,
    forgeLoopClassification: decision.classification,
    requiresUserApproval,
    questionSource: null,
    canAskUser: false,
    requiresUserDecision: false,
    recordAs: null,
    addsUnresolvedDecision: false,
    reasonCodes: [],
  };
}

/**
 * Evaluates an external workflow policy after ForgeLoop classifies the decision.
 * The helper records a policy conflict instead of turning a reversible local
 * default into a fake user blocker or mutating the decision classifier.
 */
export function classifyWorkflowCompatibility({
  forgeLoopDecision,
  workflowName: requestedWorkflowName,
  requiresUserApproval = false,
  autonomousMode,
} = {}) {
  assertBoolean(autonomousMode, "autonomousMode");
  assertBoolean(requiresUserApproval, "requiresUserApproval");

  const decision = normalizeDecision(forgeLoopDecision);
  const name = workflowName(requestedWorkflowName);

  if (!requiresUserApproval) {
    return compatibleResult({
      decision,
      name,
      autonomousMode,
      requiresUserApproval,
    });
  }

  if (decision.classification === "NON_BLOCKING") {
    if (!autonomousMode) {
      return {
        status: "INTERACTIVE_APPROVAL",
        compatible: true,
        autonomousMode,
        workflowName: name,
        forgeLoopClassification: decision.classification,
        requiresUserApproval,
        questionSource: "EXTERNAL_WORKFLOW_POLICY",
        canAskUser: true,
        requiresUserDecision: true,
        recordAs: null,
        addsUnresolvedDecision: true,
        reasonCodes: [EXTERNAL_WORKFLOW_REASON_CODES.REQUIRES_USER_GATE],
      };
    }

    return {
      status: "WORKFLOW_CONFLICT",
      compatible: false,
      autonomousMode,
      workflowName: name,
      forgeLoopClassification: decision.classification,
      requiresUserApproval,
      questionSource: "EXTERNAL_WORKFLOW_POLICY",
      canAskUser: false,
      requiresUserDecision: false,
      recordAs: "WORKFLOW_CONFLICT",
      addsUnresolvedDecision: false,
      reasonCodes: [
        EXTERNAL_WORKFLOW_REASON_CODES.APPROVAL_CONFLICT,
        EXTERNAL_WORKFLOW_REASON_CODES.BLOCKS_NON_BLOCKING,
        EXTERNAL_WORKFLOW_REASON_CODES.REQUIRES_USER_GATE,
      ],
    };
  }

  const legitimateBlockingQuestion = canAskUser(decision);
  return {
    ...compatibleResult({
      decision,
      name,
      autonomousMode,
      requiresUserApproval,
    }),
    questionSource: legitimateBlockingQuestion ? "FORGELOOP_BLOCKING_DECISION" : null,
    canAskUser: legitimateBlockingQuestion,
    requiresUserDecision: legitimateBlockingQuestion,
    addsUnresolvedDecision: legitimateBlockingQuestion,
    reasonCodes: legitimateBlockingQuestion
      ? [EXTERNAL_WORKFLOW_REASON_CODES.REQUIRES_USER_GATE]
      : [],
  };
}
