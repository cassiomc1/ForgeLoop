import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCheck,
  assertCheckList,
  createCheck,
} from "../src/core/checks.js";
import {
  assertCoverage,
  createCoverage,
  evaluateCoverage,
} from "../src/core/coverage.js";
import {
  assertSourceProvenance,
  createSourceRegistry,
} from "../src/core/sources.js";

test("structured checks reject contradictory evidence classes", () => {
  const check = createCheck({
    id: "build",
    kind: "command",
    requirement: "production build succeeds",
    status: "passed",
    evidenceKind: "OBSERVED",
    source: "npm run build",
    exitCode: 0,
  });
  assert.equal(check.schemaVersion, 1);
  assert.doesNotThrow(() => assertCheck(check));
  assert.throws(
    () => assertCheck({ ...check, evidenceKind: "NOT_VERIFIED" }),
    (error) => error.code === "E_CHECK_STATUS_CONTRADICTION",
  );
  assert.throws(
    () => assertCheck({ ...check, status: "passed", evidenceKind: "BLOCKED" }),
    (error) => error.code === "E_CHECK_STATUS_CONTRADICTION",
  );
  assert.doesNotThrow(() => assertCheckList([check]));
});

test("coverage identifies covered, partial, and blocked requirements", () => {
  const covered = createCoverage({
    requirement: "accessible navigation",
    requiredEvidence: ["keyboard", "focus"],
    observedEvidence: ["keyboard", "focus"],
  });
  assert.equal(covered.status, "COVERED");
  assert.equal(evaluateCoverage(["keyboard", "focus"], ["keyboard"]), "PARTIAL");
  assert.equal(evaluateCoverage(["keyboard"], [], { blocked: true }), "BLOCKED");
  assert.doesNotThrow(() => assertCoverage(covered));
});

test("source provenance keeps agent decisions distinct from user requests", () => {
  const registry = createSourceRegistry({
    "USER-001": { kind: "user-request", summary: "Build the requested feature" },
    "DECISION-001": { kind: "agent-decision", summary: "Choose a local implementation" },
  });
  assert.doesNotThrow(() => assertSourceProvenance(registry, ["USER-001", "DECISION-001"]));
  assert.throws(
    () => assertSourceProvenance(registry, ["UNKNOWN-001"]),
    (error) => error.code === "E_PROFILE_SOURCE_UNKNOWN",
  );
  assert.throws(
    () => assertSourceProvenance(registry, ["DECISION-001"], { expectedKind: "user-request" }),
    (error) => error.code === "E_PROFILE_SOURCE_MISCLASSIFIED",
  );
});
