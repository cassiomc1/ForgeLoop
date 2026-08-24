import test from "node:test";
import assert from "node:assert/strict";
import { deriveDiagnosticContext } from "../src/core/reflection.js";
import { computeFailureSignature } from "../src/core/failure-signature.js";

const TASK = "t-continuity-sig";

test("continuity exposes canonical active failure signature hashes", () => {
  const state = { taskId: TASK, verificationCycle: 2, checks: [] };
  const events = [
    {
      seq: 1,
      taskId: TASK,
      event: "VERIFICATION_RECORDED",
      details: { id: "check-auth", requirement: "auth-tests", status: "failed", exitCode: 1, failureToken: "AUTH_401_REFRESH", verificationCycle: 1 },
    },
    {
      seq: 2,
      taskId: TASK,
      event: "VERIFICATION_RECORDED",
      details: { id: "check-auth", requirement: "auth-tests", status: "failed", exitCode: 1, failureToken: "AUTH_401_REFRESH", verificationCycle: 2 },
    },
  ];

  const context = deriveDiagnosticContext(events, state);
  const expected = computeFailureSignature({
    requirement: "auth-tests",
    status: "failed",
    exitCode: 1,
    failureToken: "AUTH_401_REFRESH",
  });
  assert.deepEqual(context.activeFailureSignatures, [expected]);
  assert.match(context.activeFailureSignatures[0], /^[0-9a-f]{64}$/);
  assert.deepEqual(context.activeFailedRequirements, ["auth-tests"]);
});

test("continuity clears signatures after successful verification", () => {
  const state = { taskId: TASK, verificationCycle: 3, checks: [] };
  const events = [
    {
      seq: 1,
      taskId: TASK,
      event: "VERIFICATION_RECORDED",
      details: { id: "check-auth", requirement: "auth-tests", status: "passed", exitCode: 0, verificationCycle: 3 },
    },
  ];
  const context = deriveDiagnosticContext(events, state);
  assert.deepEqual(context.activeFailureSignatures, []);
  assert.deepEqual(context.activeFailedRequirements, []);
});
