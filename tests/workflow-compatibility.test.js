import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyDecision } from "./helpers/decision-classification.js";
import {
  EXTERNAL_WORKFLOW_REASON_CODES,
  QUESTION_SOURCES,
  classifyWorkflowCompatibility,
} from "./helpers/workflow-compatibility.js";

test("mandatory approval conflicts with NON_BLOCKING in autonomous mode without asking", () => {
  const result = classifyWorkflowCompatibility({
    forgeLoopDecision: classifyDecision({ local: true, reversible: true }),
    workflowName: "external-brainstorming",
    requiresUserApproval: true,
    autonomousMode: true,
  });

  assert.deepEqual(result, {
    status: "WORKFLOW_CONFLICT",
    compatible: false,
    autonomousMode: true,
    workflowName: "external-brainstorming",
    forgeLoopClassification: "NON_BLOCKING",
    requiresUserApproval: true,
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
  });
  assert.notEqual(result.status, "BLOCKING");
});

test("NON_BLOCKING remains compatible when no external approval is required", () => {
  const result = classifyWorkflowCompatibility({
    forgeLoopDecision: classifyDecision({ local: true, reversible: true }),
    workflowName: "external-review",
    requiresUserApproval: false,
    autonomousMode: true,
  });

  assert.deepEqual(result, {
    status: "COMPATIBLE",
    compatible: true,
    autonomousMode: true,
    workflowName: "external-review",
    forgeLoopClassification: "NON_BLOCKING",
    requiresUserApproval: false,
    questionSource: null,
    canAskUser: false,
    requiresUserDecision: false,
    recordAs: null,
    addsUnresolvedDecision: false,
    reasonCodes: [],
  });
});

test("a real BLOCKING production-authority decision can authorize a legitimate autonomous question", () => {
  const result = classifyWorkflowCompatibility({
    forgeLoopDecision: classifyDecision({ external: true }),
    workflowName: "external-approval",
    requiresUserApproval: true,
    autonomousMode: true,
  });

  assert.equal(result.status, "COMPATIBLE");
  assert.equal(result.compatible, true);
  assert.equal(result.forgeLoopClassification, "BLOCKING");
  assert.equal(result.questionSource, "FORGELOOP_BLOCKING_DECISION");
  assert.equal(result.canAskUser, true);
  assert.equal(result.requiresUserDecision, true);
  assert.deepEqual(result.reasonCodes, [EXTERNAL_WORKFLOW_REASON_CODES.REQUIRES_USER_GATE]);
  assert.equal(result.recordAs, null);
  assert.equal(result.addsUnresolvedDecision, true);
});

test("interactive mode explicitly permits a workflow-policy approval", () => {
  const result = classifyWorkflowCompatibility({
    forgeLoopDecision: classifyDecision({ local: true, reversible: true }),
    workflowName: "external-design-review",
    requiresUserApproval: true,
    autonomousMode: false,
  });

  assert.equal(result.status, "INTERACTIVE_APPROVAL");
  assert.equal(result.compatible, true);
  assert.equal(result.questionSource, "EXTERNAL_WORKFLOW_POLICY");
  assert.equal(result.canAskUser, true);
  assert.equal(result.requiresUserDecision, true);
  assert.equal(result.addsUnresolvedDecision, true);
});

test("question source vocabulary makes autonomous authority explicit", () => {
  assert.deepEqual(QUESTION_SOURCES, [
    "USER_REQUIREMENT",
    "FORGELOOP_BLOCKING_DECISION",
    "EXTERNAL_WORKFLOW_POLICY",
    "MODEL_PREFERENCE",
  ]);
  assert.deepEqual(EXTERNAL_WORKFLOW_REASON_CODES, {
    APPROVAL_CONFLICT: "E_EXTERNAL_WORKFLOW_APPROVAL_CONFLICT",
    BLOCKS_NON_BLOCKING: "E_EXTERNAL_WORKFLOW_BLOCKS_NON_BLOCKING",
    REQUIRES_USER_GATE: "E_EXTERNAL_WORKFLOW_REQUIRES_USER_GATE",
  });
});

test("autonomous mode must be explicit instead of silently switching policy", () => {
  assert.throws(
    () => classifyWorkflowCompatibility({
      forgeLoopDecision: classifyDecision({}),
      requiresUserApproval: true,
    }),
    /autonomousMode must be a boolean/,
  );
});
