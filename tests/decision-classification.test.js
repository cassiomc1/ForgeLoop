import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BLOCKING_REASON_CODES,
  canAskUser,
  classifyDecision,
} from "./helpers/decision-classification.js";

const nonBlockingDecisions = [["safe local default", { local: true, reversible: true }]];

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
  ["the real production domain", { external: true }, "EXTERNAL_AUTHORITY_REQUIRED"],
  ["an authoritative production domain", { authoritative: true }, "EXTERNAL_AUTHORITY_REQUIRED"],
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

test("decision rules preserve precedence and reject malformed question authorization", () => {
  assert.equal(classifyDecision({ external: true, realBusinessFact: true }).reasonCode, "REAL_BUSINESS_FACT_REQUIRED");
  assert.equal(classifyDecision({ local: false }).reasonCode, "REAL_BUSINESS_FACT_REQUIRED");
  assert.equal(classifyDecision({ irreversible: true }).reasonCode, "IRREVERSIBLE_DECISION_REQUIRED");
  for (const value of [null, [], "external", 0]) {
    assert.equal(canAskUser(classifyDecision(value)), false);
  }
});
