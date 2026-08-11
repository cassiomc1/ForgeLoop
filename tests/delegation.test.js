import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findDependencyCycles,
  findOwnershipConflicts,
  isIndependentReview,
  normalizeDelegatedResult,
  selectExecutionMode,
  validateDelegatedResult,
  validateTaskBrief,
} from "../src/core/delegation.js";

const validBrief = {
  schemaVersion: 1,
  protocolVersion: 1,
  taskId: "child-1",
  parentTaskId: "parent-1",
  objective: "Update the isolated component.",
  allowedPaths: ["src/components/card.js"],
  readOnlyPaths: ["README.md"],
  dependencies: [],
  constraints: ["Do not change the public API."],
  requiredGuides: ["clean", "test"],
  verification: ["npm test"],
  authority: ["write src/components/card.js"],
  deliverables: ["Updated component and regression test."],
  executionMode: "delegated",
};

test("valid task briefs normalize path separators and preserve inline fallback mode", async () => {
  const brief = await validateTaskBrief({ ...validBrief, allowedPaths: ["src\\components\\card.js"] });

  assert.deepEqual(brief.allowedPaths, ["src/components/card.js"]);
  assert.equal(brief.executionMode, "delegated");
  assert.equal(selectExecutionMode({ subagentsAvailable: false }), "inline");
});

test("task brief validation rejects unknown guides and missing verification", async () => {
  await assert.rejects(
    () => validateTaskBrief({ ...validBrief, requiredGuides: ["unknown"] }),
    /unknown guide/i,
  );
  await assert.rejects(
    () => validateTaskBrief({ ...validBrief, verification: [] }),
    /verification|required/i,
  );
});

test("ownership conflicts include exact and parent-child overlaps", () => {
  const result = findOwnershipConflicts([
    { taskId: "a", allowedPaths: ["src"] },
    { taskId: "b", allowedPaths: ["src/components/card.js"] },
  ]);

  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].taskIds, ["a", "b"]);
});

test("dependency cycles are returned in deterministic task order", () => {
  const cycles = findDependencyCycles([
    { taskId: "a", dependencies: ["b"] },
    { taskId: "b", dependencies: ["a"] },
  ]);

  assert.deepEqual(cycles, [["a", "b", "a"]]);
});

test("review independence requires distinct identities and an explicit type", () => {
  assert.equal(isIndependentReview({ implementerId: "a", reviewerId: "b", reviewType: "independent" }), true);
  assert.equal(isIndependentReview({ implementerId: "a", reviewerId: "a", reviewType: "independent" }), false);
  assert.equal(isIndependentReview({ implementerId: "a", reviewerId: "b", reviewType: "self" }), false);
});

test("delegated results normalize stable fields and validate status", async () => {
  const result = normalizeDelegatedResult({
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "child-1",
    status: "complete-with-concerns",
    changes: ["src/components/card.js"],
    verification: ["npm test"],
    openFindings: ["Manual browser check remains."],
    limitations: [],
  });

  assert.equal(result.status, "complete-with-concerns");
  await assert.doesNotReject(() => validateDelegatedResult(result));
  await assert.rejects(
    () => validateDelegatedResult({ ...result, status: "done" }),
    /status|one of/i,
  );
});
