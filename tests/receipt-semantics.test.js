import assert from "node:assert/strict";
import { test } from "node:test";

import { createEvidence } from "../src/core/evidence.js";
import { validateReceipt } from "../src/core/receipt.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const evidence = [createEvidence({ kind: "OBSERVED", source: "npm test", result: "exit 0" })];

function receipt(overrides = {}) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "semantic-receipt",
    contractFingerprint: "a".repeat(64),
    status: "complete",
    selectedGuides: ["clean", "test"],
    changedPaths: ["src/example.js"],
    checks: [{ command: "npm test", status: "passed", result: "exit 0" }],
    evidence,
    review: { status: "approved", independent: false },
    limitations: [],
    publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
    ...overrides,
  };
}

test("complete receipts require current verification evidence", async () => {
  await assert.doesNotReject(() => validateReceipt(receipt(), packageRoot));
  await assert.rejects(
    () => validateReceipt(receipt({ evidence: [] }), packageRoot),
    /verification evidence|evidence/i,
  );
});

test("passed checks require a command or result field", async () => {
  await assert.rejects(
    () => validateReceipt(receipt({ checks: [{ status: "passed" }] }), packageRoot),
    /command|result|check/i,
  );
});

test("publication claims require matching evidence", async () => {
  await assert.rejects(
    () => validateReceipt(receipt({ publication: { committed: false, pushed: true, pullRequest: null, deployed: false } }), packageRoot),
    /push|evidence/i,
  );
  await assert.rejects(
    () => validateReceipt(receipt({ publication: { committed: false, pushed: false, pullRequest: null, deployed: true } }), packageRoot),
    /deploy|evidence/i,
  );
  await assert.doesNotReject(() => validateReceipt(receipt({
    publication: { committed: false, pushed: true, pullRequest: null, deployed: true },
    evidence: [
      ...evidence,
      createEvidence({ kind: "OBSERVED", source: "git push", result: "pushed commit" }),
      createEvidence({ kind: "OBSERVED", source: "deployment", result: "deployed version" }),
    ],
  }), packageRoot));
});

test("independent review claims require distinct identities", async () => {
  await assert.rejects(
    () => validateReceipt(receipt({ review: { status: "approved", independent: true, type: "independent", implementerId: "same", reviewerId: "same" } }), packageRoot),
    /distinct|reviewer|implementer/i,
  );
  await assert.doesNotReject(() => validateReceipt(receipt({
    review: { status: "approved", independent: true, type: "independent", implementerId: "agent-a", reviewerId: "agent-b" },
  }), packageRoot));
});
