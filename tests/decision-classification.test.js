import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BLOCKING_REASON_CODES,
  canAskUser,
  classifyDecision,
} from "../src/core/decision-classification.js";

const nonBlockingDecisions = [
  ["unspecified fictional brand name", { local: true, reversible: true }],
  ["unspecified practice-area emphasis", { local: true, reversible: true }],
  ["unspecified visual tone within a premium requirement", { local: true, reversible: true }],
  ["unspecified fictional office location", { local: true, reversible: true }],
  ["unspecified demo contact values", { local: true, reversible: true }],
  ["unspecified fictional attorney names", { local: true, reversible: true }],
  ["unspecified representative services", { local: true, reversible: true }],
];

for (const [description, flags] of nonBlockingDecisions) {
  test(`${description} is classified before asking`, () => {
    const decision = classifyDecision(flags);

    assert.deepEqual(decision, {
      classification: "NON_BLOCKING",
      reasonCode: "SAFE_REVERSIBLE_LOCAL_DEFAULT",
      blockingReason: null,
    });
    assert.equal(canAskUser(decision), false);
  });
}

const blockingDecisions = [
  ["the firm's real legal name", { realBusinessFact: true }, "REAL_BUSINESS_FACT_REQUIRED"],
  ["the real phone number", { realBusinessFact: true }, "REAL_BUSINESS_FACT_REQUIRED"],
  ["the real production domain", { external: true }, "EXTERNAL_AUTHORITY_REQUIRED"],
  ["an authoritative production domain", { authoritative: true }, "EXTERNAL_AUTHORITY_REQUIRED"],
  ["a production CRM connection", { external: true }, "EXTERNAL_AUTHORITY_REQUIRED"],
  ["real attorney credentials", { realBusinessFact: true }, "REAL_BUSINESS_FACT_REQUIRED"],
  ["regulated compliance claims", { regulatedClaim: true }, "REGULATED_CLAIM_REQUIRED"],
  ["payment information", { sensitive: true }, "SENSITIVE_VALUE_REQUIRED"],
  ["a destructive operation", { destructive: true }, "DESTRUCTIVE_ACTION_REQUIRED"],
  ["an irreversible architecture choice", { reversible: false }, "IRREVERSIBLE_DECISION_REQUIRED"],
];

for (const [description, flags, reasonCode] of blockingDecisions) {
  test(`${description} is blocking and justifies a question`, () => {
    const decision = classifyDecision(flags);

    assert.equal(decision.classification, "BLOCKING");
    assert.equal(decision.reasonCode, reasonCode);
    assert.equal(decision.blockingReason, reasonCode);
    assert.equal(canAskUser(decision), true);
  });
}

test("ordinary unspecified product ambiguity has no UNKNOWN question path", () => {
  const decision = classifyDecision({});

  assert.equal(decision.classification, "NON_BLOCKING");
  assert.equal(decision.blockingReason, null);
  assert.equal(canAskUser(decision), false);
});

test("question authorization rejects missing or unknown blocking reasons", () => {
  assert.equal(canAskUser({ classification: "BLOCKING" }), false);
  assert.equal(canAskUser({
    classification: "BLOCKING",
    reasonCode: "UNKNOWN_REASON",
    blockingReason: "UNKNOWN_REASON",
  }), false);
  assert.equal(canAskUser({
    classification: "NON_BLOCKING",
    reasonCode: "SAFE_REVERSIBLE_LOCAL_DEFAULT",
    blockingReason: null,
  }), false);
});

test("blocking reason codes are stable and finite", () => {
  assert.deepEqual(BLOCKING_REASON_CODES, [
    "REAL_BUSINESS_FACT_REQUIRED",
    "SENSITIVE_VALUE_REQUIRED",
    "EXTERNAL_AUTHORITY_REQUIRED",
    "IRREVERSIBLE_DECISION_REQUIRED",
    "REGULATED_CLAIM_REQUIRED",
    "DESTRUCTIVE_ACTION_REQUIRED",
  ]);
});
