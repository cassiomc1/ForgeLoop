import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyExecutionPolicy,
} from "../src/execution-policy.js";
import { classifyForgeLoopInvocation, INTEGRATION_RISK_CLASSES } from "@cassiomc1/forgeloop/integration";

const POLICY = Object.freeze({
  mode: "safe",
  maxExecutionTimeMs: 600000,
});

test("timeout matrix: omitted and null receive the server maximum", () => {
  for (const args of [undefined, {}, { timeoutMs: null }]) {
    const applied = applyExecutionPolicy({
      classification: classifyForgeLoopInvocation("run-check"),
      args,
      policy: POLICY,
    });
    assert.equal(applied.timeoutMs, 600000);
  }
});

test("timeout matrix: positive values within the maximum are accepted", () => {
  for (const timeoutMs of [1, 600000]) {
    const applied = applyExecutionPolicy({
      classification: classifyForgeLoopInvocation("run-check"),
      args: { timeoutMs },
      policy: POLICY,
    });
    assert.equal(applied.timeoutMs, timeoutMs);
  }
});

test("timeout matrix: zero, negative, float, string, and over-max are rejected", () => {
  const invalid = [
    ["zero", 0],
    ["negative", -1],
    ["float", 1.5],
    ["string", "600000"],
  ];
  for (const [label, timeoutMs] of invalid) {
    assert.throws(
      () => applyExecutionPolicy({
        classification: classifyForgeLoopInvocation("run-check"),
        args: { timeoutMs },
        policy: POLICY,
      }),
      (error) => error.code === "E_MCP_EXECUTION_TIMEOUT_INVALID",
      label,
    );
  }
  assert.throws(
    () => applyExecutionPolicy({
      classification: classifyForgeLoopInvocation("run-check"),
      args: { timeoutMs: 600001 },
      policy: POLICY,
    }),
    (error) => error.code === "E_MCP_EXECUTION_TIMEOUT_EXCEEDS_LIMIT"
      && /600000/.test(error.message),
  );
});

test("non-external invocations pass through untouched", () => {
  const args = { taskId: "t" };
  const applied = applyExecutionPolicy({
    classification: classifyForgeLoopInvocation("status"),
    args,
    policy: POLICY,
  });
  assert.equal(applied, args);
  // Even a bogus timeout on a non-external command is not this layer's job.
  const untouched = applyExecutionPolicy({
    classification: classifyForgeLoopInvocation("status"),
    args: { taskId: "t", timeoutMs: 0 },
    policy: POLICY,
  });
  assert.equal(untouched.timeoutMs, 0);
});

test("both external-execution commands are classified EXTERNAL_EXECUTION", () => {
  for (const command of ["run-check", "reconcile-closure"]) {
    assert.equal(classifyForgeLoopInvocation(command).riskClass, INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION);
  }
});
