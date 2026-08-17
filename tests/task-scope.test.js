import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeWriteClaims,
  claimsOverlap,
  assertNoScopeConflicts,
  assertScopeNotFrozen,
  assertClaimsCoverChangedPaths,
} from "../src/core/task-scope.js";

test("normalizeWriteClaims normalizes and deduplicates project-relative paths", () => {
  assert.deepEqual(normalizeWriteClaims([]), []);
  assert.deepEqual(normalizeWriteClaims(["src/auth", "./src/auth/", "src/auth"]), ["src/auth"]);
  assert.deepEqual(normalizeWriteClaims(["src/auth", "src/auth"]), ["src/auth"]);
  assert.deepEqual(normalizeWriteClaims(["src/auth", "src/billing"]), ["src/auth", "src/billing"]);
  assert.deepEqual(normalizeWriteClaims(["."]), ["."]);

  assert.throws(() => normalizeWriteClaims(["/absolute/path"]), (err) => err.code === "E_TASK_DESCRIPTOR_INVALID");
  assert.throws(() => normalizeWriteClaims(["../outside"]), (err) => err.code === "E_TASK_DESCRIPTOR_INVALID");
});

test("claimsOverlap detects direct and prefix collisions", () => {
  assert.equal(claimsOverlap(".", "src/auth"), true);
  assert.equal(claimsOverlap("src/auth", "."), true);
  assert.equal(claimsOverlap("src/auth", "src/auth"), true);
  assert.equal(claimsOverlap("src/auth", "src/auth/login.js"), true);
  assert.equal(claimsOverlap("src/auth/login.js", "src/auth"), true);

  assert.equal(claimsOverlap("src/auth", "src/billing"), false);
  assert.equal(claimsOverlap("src/auth", "tests/auth"), false);
});

test("assertNoScopeConflicts rejects conflicts with active non-complete tasks", () => {
  const existingTasks = [
    { taskId: "task-1", phase: "EXECUTING", writeClaims: ["src/auth"] },
    { taskId: "task-completed", phase: "COMPLETE", writeClaims: ["src/billing"] },
  ];

  // Conflicting with task-1
  assert.throws(
    () => assertNoScopeConflicts(["src/auth"], existingTasks, "task-2"),
    (err) => err.code === "E_TASK_SCOPE_CONFLICT",
  );

  // Non-conflicting
  assert.doesNotThrow(
    () => assertNoScopeConflicts(["src/billing"], existingTasks, "task-2"),
  );
});

test("assertScopeNotFrozen allows modification in early phases and rejects in EXECUTING+", () => {
  assert.doesNotThrow(() => assertScopeNotFrozen("PLANNED"));
  assert.doesNotThrow(() => assertScopeNotFrozen("ROUTED"));

  assert.throws(
    () => assertScopeNotFrozen("EXECUTING"),
    (err) => err.code === "E_TASK_SCOPE_FROZEN",
  );
  assert.throws(
    () => assertScopeNotFrozen("VERIFYING"),
    (err) => err.code === "E_TASK_SCOPE_FROZEN",
  );
});

test("assertClaimsCoverChangedPaths checks modified files against claimed prefixes", () => {
  const claims = ["src/auth", "tests/auth"];

  // In scope
  const validChanges = ["src/auth/login.js", "tests/auth/login.test.js"];
  assert.doesNotThrow(() => assertClaimsCoverChangedPaths(claims, validChanges));

  // Out of scope
  const invalidChanges = ["src/auth/login.js", "src/billing/checkout.js"];
  assert.throws(
    () => assertClaimsCoverChangedPaths(claims, invalidChanges),
    (err) => err.code === "E_TASK_CHANGE_OUTSIDE_SCOPE",
  );

  // Whole repo claim allows anything
  assert.doesNotThrow(() => assertClaimsCoverChangedPaths(["."], invalidChanges));
});
