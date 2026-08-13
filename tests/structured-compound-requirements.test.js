import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createContract, contractFingerprint, writeContract, validateContract } from "../src/core/contract.js";
import { createCheck } from "../src/core/checks.js";
import { classifyRequirement, evaluateRequiredEvidence } from "../src/core/evidence-readiness.js";
import { getPackageRoot } from "../src/core/templates.js";
import { readSchema, validateSchema } from "../src/core/schema-validation.js";

const packageRoot = getPackageRoot();

test("backward compatibility with string array verification requirements", async () => {
  const contract = createContract({
    taskId: "task-string-reqs",
    objective: "Support string arrays seamlessly",
    deliverables: ["src/app.js"],
    constraints: [],
    risks: [],
    verification: ["Unit tests pass", "Lint checks pass"],
    successCriteria: ["App builds cleanly"],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });

  await validateContract(contract, packageRoot);
  assert.equal(contract.verification.length, 2);
  assert.equal(contract.verification[0], "Unit tests pass");
});

test("structured requirement objects are schema-valid and validate cleanly (P1-7)", async () => {
  const contract = createContract({
    taskId: "task-structured-reqs",
    objective: "Support structured requirement objects",
    deliverables: ["src/app.js"],
    constraints: [],
    risks: [],
    verification: [
      {
        id: "REQ_A11Y_COMPOUND",
        text: "Accessibility comprehensive verification",
        type: "VERIFICATION",
        operator: "ALL",
        requirements: [
          { id: "REQ_KEYBOARD", text: "Keyboard navigation works" },
          { id: "REQ_ZOOM", text: "Zoom mode 200% works" },
        ],
      },
      "Integration tests pass",
    ],
    successCriteria: [
      {
        id: "SC_PERF",
        text: "Performance budget met",
        type: "VERIFICATION",
      },
    ],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });

  await validateContract(contract, packageRoot);
  assert.equal(contract.verification.length, 2);
  assert.equal(typeof contract.verification[0], "object");
  assert.equal(contract.verification[0].id, "REQ_A11Y_COMPOUND");
});

test("duplicate explicit requirement IDs in contract are rejected", () => {
  assert.throws(
    () => createContract({
      taskId: "task-dup-ids",
      objective: "Reject duplicate requirement IDs",
      deliverables: ["src/app.js"],
      constraints: [],
      risks: [],
      verification: [
        { id: "REQ_DUPLICATE", text: "First requirement" },
        { id: "REQ_DUPLICATE", text: "Second requirement with same ID" },
      ],
      successCriteria: [],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    }),
    (err) => err.message.includes("Duplicate requirement ID"),
  );
});

test("compound partial verification fails readiness (Matrix L)", () => {
  const requirement = classifyRequirement({
    id: "SC_ACCESSIBILITY",
    text: "Accessibility passes",
    type: "VERIFICATION",
    operator: "ALL",
    requirements: [
      { id: "SC_KEYBOARD", text: "Keyboard passes" },
      { id: "SC_ZOOM", text: "Zoom passes" },
      { id: "SC_MOTION", text: "Reduced motion passes" },
    ],
  });

  const checks = [
    createCheck({
      id: "chk-keyboard",
      kind: "command",
      requirement: "SC_KEYBOARD",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "a11y-test",
    }),
    createCheck({
      id: "chk-zoom",
      kind: "command",
      requirement: "SC_ZOOM",
      status: "not-run",
      evidenceKind: "NOT_VERIFIED",
      source: "a11y-test",
    }),
    createCheck({
      id: "chk-motion",
      kind: "command",
      requirement: "SC_MOTION",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "a11y-test",
    }),
  ];

  const result = evaluateRequiredEvidence({
    requirements: [requirement],
    checks,
  });

  assert.equal(result.ready, false);
  assert.equal(result.partial.length, 1);
  assert.equal(result.partial[0].id, "SC_ACCESSIBILITY");
  assert.deepEqual(result.reasonCodes, ["E_EVIDENCE_PARTIAL"]);
});

test("compound complete verification passes readiness (Matrix M)", () => {
  const requirement = classifyRequirement({
    id: "SC_ACCESSIBILITY",
    text: "Accessibility passes",
    type: "VERIFICATION",
    operator: "ALL",
    requirements: [
      { id: "SC_KEYBOARD", text: "Keyboard passes" },
      { id: "SC_ZOOM", text: "Zoom passes" },
      { id: "SC_MOTION", text: "Reduced motion passes" },
    ],
  });

  const checks = [
    createCheck({
      id: "chk-keyboard",
      kind: "command",
      requirement: "SC_KEYBOARD",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "a11y-test",
    }),
    createCheck({
      id: "chk-zoom",
      kind: "command",
      requirement: "SC_ZOOM",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "a11y-test",
    }),
    createCheck({
      id: "chk-motion",
      kind: "command",
      requirement: "SC_MOTION",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "a11y-test",
    }),
  ];

  const result = evaluateRequiredEvidence({
    requirements: [requirement],
    checks,
  });

  assert.equal(result.ready, true);
  assert.equal(result.covered.length, 1);
  assert.equal(result.covered[0].id, "SC_ACCESSIBILITY");
  assert.equal(result.partial.length, 0);
  assert.equal(result.missing.length, 0);
});
