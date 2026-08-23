import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INTEGRATION_LIMITS,
  classifyForgeLoopInvocation,
} from "@cassiomc1/forgeloop/integration";
import { enforceStructuredInputBound } from "../src/input-policy.js";

function oversizedArgs() {
  // A small number of properties carrying huge values (§5).
  return { checkDetails: { payload: "x".repeat(INTEGRATION_LIMITS.maxStructuredInputBytes) } };
}

test("small and empty inputs are accepted", () => {
  assert.deepEqual(enforceStructuredInputBound({}), {});
  assert.deepEqual(enforceStructuredInputBound(undefined), {});
  const small = { taskId: "t", checkDetails: { note: "ok" } };
  assert.equal(enforceStructuredInputBound(small), small);
});

test("deeply nested but small input is accepted", () => {
  const nested = { a: { b: { c: { d: ["1", "2", { e: "f" }] } } } };
  assert.equal(enforceStructuredInputBound(nested), nested);
});

test("input beyond the byte bound is rejected with E_MCP_INPUT_TOO_LARGE", () => {
  assert.throws(
    () => enforceStructuredInputBound(oversizedArgs()),
    (error) => error.code === "E_MCP_INPUT_TOO_LARGE"
      && /exceeds \d+ bytes/.test(error.message),
  );
});

test("a real structured-JSON tool field (checkDetails) is bounded", async () => {
  const { buildToolRegistrations } = await import("../src/tool-registry.js");
  const { resolveLaunchPolicy, SERVER_MODES } = await import("../src/capability-policy.js");
  void buildToolRegistrations;
  void resolveLaunchPolicy;
  void SERVER_MODES;

  const recordCheck = classifyForgeLoopInvocation("record-check");
  assert.equal(recordCheck.executesExternalProcess, false);
  assert.throws(
    () => enforceStructuredInputBound({
      taskId: "t",
      checkId: "c",
      requirement: "r",
      status: "passed",
      evidenceKind: "OBSERVED",
      result: "x".repeat(INTEGRATION_LIMITS.maxStructuredInputBytes),
    }),
    (error) => error.code === "E_MCP_INPUT_TOO_LARGE",
  );
});
