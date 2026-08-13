import assert from "node:assert/strict";
import { test } from "node:test";

import { createCheck } from "../src/core/checks.js";
import { classifyRequirement, evaluateRequiredEvidence } from "../src/core/evidence-readiness.js";
import { isValidTransition } from "../src/core/protocol.js";
import { validateStateLedgerCoherence } from "../src/core/events.js";

test("canonical readiness uses stable requirement IDs and rejects partial compound evidence", () => {
  const requirement = {
    id: "SC_ACCESSIBILITY",
    text: "Accessibility modes pass",
    type: "VERIFICATION",
    operator: "ALL",
    requirements: [
      { id: "SC_KEYBOARD", text: "Keyboard passes" },
      { id: "SC_ZOOM", text: "Zoom passes" },
    ],
  };
  const checks = [
    createCheck({
      id: "accessibility",
      kind: "command",
      requirement: "SC_ACCESSIBILITY",
      status: "not-run",
      evidenceKind: "NOT_VERIFIED",
      source: "browser-check",
      details: {
        components: [
          { requirementId: "SC_KEYBOARD", status: "passed", evidenceKind: "OBSERVED" },
          { requirementId: "SC_ZOOM", status: "not-run", evidenceKind: "NOT_VERIFIED" },
        ],
      },
    }),
  ];

  const result = evaluateRequiredEvidence({ requirements: [requirement], checks });

  assert.equal(result.ready, false);
  assert.deepEqual(result.partial.map((item) => item.id), ["SC_ACCESSIBILITY"]);
  assert.deepEqual(result.reasonCodes, ["E_EVIDENCE_PARTIAL"]);
});

test("a passed compound check cannot contain an unverified component", () => {
  assert.throws(
    () => createCheck({
      id: "accessibility",
      kind: "command",
      requirement: "SC_ACCESSIBILITY",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "browser-check",
      details: {
        components: [
          { requirementId: "SC_KEYBOARD", status: "passed", evidenceKind: "OBSERVED" },
          { requirementId: "SC_ZOOM", status: "not-run", evidenceKind: "NOT_VERIFIED" },
        ],
      },
    }),
    (error) => error.code === "E_CHECK_STATUS_CONTRADICTION",
  );
});

test("terminal lifecycle criteria are lifecycle-owned instead of ordinary checks", () => {
  const requirement = classifyRequirement("Lifecycle reaches validator-backed COMPLETE");

  assert.equal(requirement.type, "LIFECYCLE");
  assert.equal(requirement.lifecycleOwned, true);
  assert.match(requirement.id, /^REQ_[A-F0-9]{16}$/);

  const result = evaluateRequiredEvidence({ requirements: [requirement], checks: [] });
  assert.equal(result.ready, true);
  assert.deepEqual(result.lifecyclePending.map((item) => item.id), [requirement.id]);
});

test("reviewing can return to verifying only through recovery authorization", () => {
  assert.equal(isValidTransition("REVIEWING", "VERIFYING"), true);
});

test("ledger replay rejects a manually advanced state phase", async () => {
  const state = { taskId: "task-replay", phase: "REVIEWING", verificationCycle: 1 };
  const events = [
    { taskId: "task-replay", event: "EXECUTION_STARTED" },
    { taskId: "task-replay", event: "VERIFICATION_STARTED", details: { verificationCycle: 1 } },
  ];

  const errors = validateStateLedgerCoherence(state, events);

  assert.ok(errors.some((error) => error.code === "E_STATE_LEDGER_DIVERGENCE"));
});

test("ledger replay rejects a manual rollback after review started in the same cycle", () => {
  const state = { taskId: "task-replay", phase: "VERIFYING", verificationCycle: 1 };
  const events = [
    { taskId: "task-replay", event: "EXECUTION_STARTED" },
    { taskId: "task-replay", event: "VERIFICATION_STARTED", details: { verificationCycle: 1 } },
    { taskId: "task-replay", event: "REVIEW_STARTED", details: { verificationCycle: 1 } },
  ];

  const errors = validateStateLedgerCoherence(state, events);

  assert.ok(errors.some((error) => error.code === "E_STATE_LEDGER_DIVERGENCE"));
});
