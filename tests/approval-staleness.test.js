import assert from "node:assert/strict";
import test from "node:test";

import { assertApprovalFresh } from "../src/core/approvals.js";

const base = {
  approvalId: "approval-one",
  taskId: "task-one",
  actionId: "action-one",
  actionFingerprint: "a".repeat(64),
  contractFingerprint: "b".repeat(64),
  taskRevision: 4,
  capability: "repository.push",
  status: "APPROVED",
};

test("action fingerprint drift makes approval stale", () => {
  assert.throws(() => assertApprovalFresh(base, { ...base, actionFingerprint: "c".repeat(64) }),
    (error) => error.code === "E_APPROVAL_STALE");
});

test("contract fingerprint, task revision, and capability drift make approval stale", () => {
  for (const changed of [
    { contractFingerprint: "d".repeat(64) },
    { taskRevision: 5 },
    { capability: "external.publish" },
  ]) {
    assert.throws(() => assertApprovalFresh(base, { ...base, ...changed }),
      (error) => error.code === "E_APPROVAL_STALE");
  }
});
