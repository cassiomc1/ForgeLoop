import assert from "node:assert/strict";
import test from "node:test";

import { lintContinuity } from "../src/core/continuity-lint.js";
import { reconcileContinuity } from "../src/core/continuity-reconciliation.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import { writeJsonArtifact } from "../src/core/artifacts.js";

const packageRoot = getPackageRoot();

test("clean continuity passes lint without violations", () => {
  const result = lintContinuity({
    resumeNote: "Refactored the authentication token refresh pipeline.",
    decisions: ["Use rotating refresh tokens stored in secure cookie."],
  });

  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
});

test("lint flags EMPTY_DECISION on whitespace or empty items", () => {
  const result = lintContinuity({
    decisions: ["Valid decision", "   ", ""],
  });

  assert.equal(result.passed, false);
  const emptyViolations = result.violations.filter((v) => v.ruleId === "EMPTY_DECISION");
  assert.equal(emptyViolations.length, 2);
  assert.equal(emptyViolations[0].field, "decisions[1]");
  assert.equal(emptyViolations[1].field, "decisions[2]");
});

test("lint flags OVERSIZED_NOTE when note exceeds 4000 characters", () => {
  const result = lintContinuity({
    notes: ["a".repeat(4001)],
  });

  assert.equal(result.passed, false);
  const oversized = result.violations.find((v) => v.ruleId === "OVERSIZED_NOTE");
  assert.ok(oversized);
  assert.equal(oversized.field, "notes[0]");
});

test("lint flags PLACEHOLDER_TEXT on placeholder markers", () => {
  const result = lintContinuity({
    resumeNote: "Need to check TODO before continuing",
    decisions: ["Status is TBD"],
  });

  assert.equal(result.passed, false);
  const placeholders = result.violations.filter((v) => v.ruleId === "PLACEHOLDER_TEXT");
  assert.equal(placeholders.length, 2);
});

test("lint flags CONTROL_CHARACTERS on unescaped control chars", () => {
  const result = lintContinuity({
    resumeNote: "bad\u0000text",
  });

  assert.equal(result.passed, false);
  const control = result.violations.find((v) => v.ruleId === "CONTROL_CHARACTERS");
  assert.ok(control);
  assert.equal(control.field, "resumeNote");
});

test("lint flags UNSTRUCTURED_EVIDENCE_CLAIM on informal claims", () => {
  const phrases = [
    "all tests pass",
    "verified manually",
    "looks good",
    "tests passed",
    "working now",
  ];

  for (const phrase of phrases) {
    const result = lintContinuity({
      notes: [`I checked the code and ${phrase}`],
    });
    assert.equal(result.passed, false, `Expected violation for '${phrase}'`);
    const claim = result.violations.find((v) => v.ruleId === "UNSTRUCTURED_EVIDENCE_CLAIM");
    assert.ok(claim, `Expected UNSTRUCTURED_EVIDENCE_CLAIM for '${phrase}'`);
  }
});

test("reconcileContinuity includes lint summary and does not block reconciliation", async () => {
  const target = await createGitRepository("forgeloop-lint-reconcile-");
  const taskId = "task-lint-reconcile";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });

    const { writeContinuity } = await import("../src/core/continuity.js");
    await writeContinuity(target, {
      resumeNote: "TODO: fix remaining items and all tests pass",
    }, { taskId, packageRoot });

    const reconciled = await reconcileContinuity({ target, packageRoot, taskId });
    assert.ok(reconciled.lint, "reconciled continuity must include lint result");
    assert.equal(reconciled.lint.passed, false);
    assert.ok(reconciled.lint.violations.some((v) => v.ruleId === "PLACEHOLDER_TEXT"));
    assert.ok(reconciled.lint.violations.some((v) => v.ruleId === "UNSTRUCTURED_EVIDENCE_CLAIM"));
  } finally {
    await removeTempTree(target);
  }
});
