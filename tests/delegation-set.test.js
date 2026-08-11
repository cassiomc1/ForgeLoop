import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findOwnershipConflicts,
  findUnknownDependencies,
  validateDelegationSet,
} from "../src/core/delegation.js";

function brief(taskId, overrides = {}) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    parentTaskId: "parent-task",
    objective: `Implement ${taskId}`,
    allowedPaths: [`src/${taskId}.js`],
    readOnlyPaths: ["README.md"],
    dependencies: [],
    constraints: [],
    requiredGuides: ["clean"],
    verification: ["npm test"],
    authority: [`write src/${taskId}.js`],
    deliverables: [`src/${taskId}.js`],
    executionMode: "delegated",
    ...overrides,
  };
}

test("resource conflicts distinguish write/write and write/read hazards", () => {
  const result = findOwnershipConflicts([
    brief("a", { allowedPaths: ["src/config.js"] }),
    brief("b", { allowedPaths: ["src/config.js"], readOnlyPaths: [] }),
  ]);
  assert.deepEqual(result.conflicts, [{
    taskIds: ["a", "b"],
    type: "WRITE_WRITE",
    path: "src/config.js",
  }]);

  const writeRead = findOwnershipConflicts([
    brief("a", { allowedPaths: ["src/config.js"] }),
    brief("b", { allowedPaths: ["src/other.js"], readOnlyPaths: ["src/config.js"] }),
  ]);
  assert.deepEqual(writeRead.conflicts, [{
    taskIds: ["a", "b"],
    type: "WRITE_READ",
    path: "src/config.js",
  }]);
});

test("delegation sets classify safe, serial, and invalid contracts", () => {
  const safe = validateDelegationSet([brief("a"), brief("b")]);
  assert.equal(safe.status, "PARALLEL_SAFE");
  assert.deepEqual(safe.errors, []);

  const serial = validateDelegationSet([
    brief("a", { allowedPaths: ["src/config.js"] }),
    brief("b", { readOnlyPaths: ["src/config.js"] }),
  ]);
  assert.equal(serial.status, "SERIAL_REQUIRED");
  assert.equal(serial.conflicts[0].type, "WRITE_READ");

  const invalid = validateDelegationSet([
    brief("a", { dependencies: ["missing"] }),
    brief("a", { allowedPaths: ["src/other.js"] }),
  ]);
  assert.equal(invalid.status, "INVALID");
  assert.ok(invalid.errors.some((error) => error.code === "DUPLICATE_TASK_ID"));
  assert.ok(invalid.errors.some((error) => error.code === "UNKNOWN_DEPENDENCY"));
});

test("unknown dependency references are deterministic and cycles remain separate", () => {
  assert.deepEqual(
    findUnknownDependencies([
      brief("b", { dependencies: ["missing", "a"] }),
      brief("a"),
    ]),
    [{ taskId: "b", dependency: "missing" }],
  );
});
