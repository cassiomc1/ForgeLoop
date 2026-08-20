import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { validateTaskArtifactSet, delegationIsInScope } from "../src/core/conformance.js";
import { evaluateRoute } from "../src/core/router.js";
import { contractFingerprint, createWorkState } from "../src/core/work-state.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const route = evaluateRoute({ workType: "api", surfaces: ["api"], platforms: [] });
const contract = { objective: "conformance" };
const fingerprint = contractFingerprint(contract);
const state = createWorkState({
  taskId: "parent",
  contractFingerprint: fingerprint,
  repositoryFingerprint: { branch: "main", head: "head" },
  phase: "ROUTED",
  selectedGuides: route.guides,
  completedSteps: [],
  pendingSteps: ["implementation"],
  checks: [],
  failures: [],
  blockers: [],
  verificationEvidence: [],
});
const receipt = {
  schemaVersion: 1,
  protocolVersion: 1,
  taskId: "parent",
  contractFingerprint: fingerprint,
  selectedGuides: route.guides,
  changedPaths: [],
  checks: [],
  review: { status: "not-run", independent: false },
  limitations: [],
  publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
};
const brief = {
  schemaVersion: 1,
  protocolVersion: 1,
  taskId: "child",
  parentTaskId: "parent",
  objective: "Conformance child",
  allowedPaths: ["src/child.js"],
  readOnlyPaths: [],
  dependencies: [],
  constraints: [],
  requiredGuides: ["clean"],
  verification: ["npm test"],
  authority: ["write src/child.js"],
  deliverables: ["src/child.js"],
};
const delegated = {
  schemaVersion: 1,
  protocolVersion: 1,
  taskId: "child",
  status: "complete-with-concerns",
  changes: [],
  verification: ["npm test"],
  openFindings: [],
  limitations: [],
};

test("delegationIsInScope correctly derives whether delegation applies", () => {
  assert.equal(delegationIsInScope({ state, receipt }), false);
  assert.equal(delegationIsInScope({ state, receipt, taskBriefs: [brief] }), true);
  assert.equal(delegationIsInScope({ state, receipt, delegatedResults: [delegated] }), true);
  assert.equal(delegationIsInScope({ state: { ...state, delegatedTasks: ["child"] } }), true);
  assert.equal(delegationIsInScope({ events: [{ type: "TASK_DELEGATED", taskId: "child" }] }), true);
});

test("compatibility conformance scenarios have complete, versioned contracts", async () => {
  const scenarios = ["cross-harness-resume", "policy-drift", "verification-recovery", "concurrent-claims", "interrupted-transaction"];
  for (const scenario of scenarios) {
    const content = await readFile(path.join(repositoryRoot, "conformance", scenario, "SCENARIO.json"), "utf8");
    const value = JSON.parse(content);
    assert.equal(value.protocolVersion, 1, scenario);
    assert.equal(typeof value.request, "string", scenario);
    assert.ok(value.expectedRoute && Array.isArray(value.expectedRoute.guides), scenario);
    assert.ok(Array.isArray(value.requiredGates), scenario);
    assert.ok(Array.isArray(value.requiredEvidence) && value.requiredEvidence.length > 0, scenario);
    assert.ok(Array.isArray(value.expectedNextActionSequence) && value.expectedNextActionSequence.length > 0, scenario);
    assert.equal(typeof value.expectedTerminalResult, "string", scenario);
  }
});

test("cross-artifact conformance accepts a coherent single-actor set without delegation", () => {
  const result = validateTaskArtifactSet({
    route,
    state,
    receipt,
  });
  assert.equal(result.status, "VALID");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.incomplete, []);
  assert.equal(result.delegation.status, "NOT_APPLICABLE");
  assert.equal(result.delegation.required, false);
});

test("cross-artifact conformance accepts a coherent delegated set", () => {
  const result = validateTaskArtifactSet({
    route,
    state,
    receipt,
    taskBriefs: [brief],
    delegatedResults: [delegated],
  });
  assert.equal(result.status, "VALID");
  assert.deepEqual(result.errors, []);
  assert.equal(result.delegation.status, "VALID");
  assert.equal(result.delegation.required, true);
});

test("cross-artifact conformance reports exact relationship failures", () => {
  const result = validateTaskArtifactSet({
    route,
    state: { ...state, selectedGuides: ["security"] },
    receipt: { ...receipt, contractFingerprint: "b".repeat(64) },
    taskBriefs: [brief],
    delegatedResults: [{ ...delegated, taskId: "unknown" }],
  });
  assert.equal(result.status, "INCONSISTENT");
  assert.ok(result.errors.some((error) => error.code === "ROUTE_STATE_GUIDES_MISMATCH"));
  assert.ok(result.errors.some((error) => error.code === "STATE_RECEIPT_CONTRACT_MISMATCH"));
  assert.ok(result.errors.some((error) => error.code === "UNKNOWN_DELEGATED_TASK"));
  assert.equal(result.delegation.status, "INCONSISTENT");
});

test("cross-artifact conformance distinguishes incomplete, stale, and incompatible sets", () => {
  assert.equal(validateTaskArtifactSet({ route, state }).status, "INCOMPLETE");
  assert.equal(validateTaskArtifactSet({ route, state, receipt, taskBriefs: [brief] }).status, "INCOMPLETE");
  const stateClassification = {
    status: "REVALIDATION_REQUIRED",
    reasons: ["CONTRACT_CHANGED"],
    warnings: [],
    repositoryComparison: "MATCH",
    contractComparison: "MISMATCH",
    artifactComparison: "NOT_APPLICABLE",
  };
  const stale = validateTaskArtifactSet({ route, state, stateClassification, receipt });
  assert.equal(stale.status, "STALE");
  assert.deepEqual(stale.stale, {
    reasons: ["CONTRACT_CHANGED"],
    warnings: [],
    repositoryComparison: "MATCH",
    contractComparison: "MISMATCH",
    artifactComparison: "NOT_APPLICABLE",
  });
  const inconsistent = validateTaskArtifactSet({
    route: { ...route, guides: [] },
    state,
    stateClassification,
    receipt,
  });
  assert.equal(inconsistent.status, "INCONSISTENT");
  assert.equal(inconsistent.stale, null);
  assert.equal(validateTaskArtifactSet({
    route: { ...route, protocolVersion: 99 },
    state,
    stateClassification,
    receipt,
  }).status, "INVALID");
});
