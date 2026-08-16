import assert from "node:assert/strict";
import { test } from "node:test";

import { canonicalFingerprint } from "../src/core/artifacts.js";
import { evaluateContinuityConformance } from "../src/core/continuity-conformance.js";

function state() {
  return { schemaVersion:1, protocolVersion:1, taskId:"task-1", contractFingerprint:"b".repeat(64), phase:"EXECUTING", marker:"state" };
}
function continuity(overrides={}) {
  const s=state();
  return {
    schemaVersion:1, protocolVersion:1, taskId:s.taskId,
    workStateFingerprint:canonicalFingerprint(s), contractFingerprint:s.contractFingerprint,
    phase:s.phase, repositoryFingerprint:{branch:"main",head:"abc"},
    updatedAt:"2026-08-16T17:00:00.000Z", remainingWork:[], knownIssues:[], changedAreas:[], inspectFirst:[],
    ...overrides,
  };
}

test("continuity conformance is optional", () => {
  const result=evaluateContinuityConformance({continuity:null,state:state()});
  assert.equal(result.required,false);
  assert.equal(result.status,"NOT_APPLICABLE");
  assert.deepEqual(result.errors,[]);
});

test("fresh continuity is valid but has no evidence authority", () => {
  const s=state();
  const result=evaluateContinuityConformance({
    continuity:continuity({workStateFingerprint:canonicalFingerprint(s)}), state:s,
    contractFingerprint:s.contractFingerprint,
    repositoryFingerprint:{branch:"main",head:"abc"}, changedPaths:[],
  });
  assert.equal(result.status,"VALID");
  assert.equal(result.authority,"OPERATIONAL_CONTEXT_ONLY");
  assert.equal(result.evidenceAuthority,"NONE");
});

test("stale continuity reports STALE without becoming evidence", () => {
  const s=state();
  const result=evaluateContinuityConformance({
    continuity:continuity({workStateFingerprint:"a".repeat(64)}), state:s,
    contractFingerprint:s.contractFingerprint,
    repositoryFingerprint:{branch:"main",head:"abc"}, changedPaths:[],
  });
  assert.equal(result.status,"STALE");
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.reasonCodes,["E_CONTINUITY_RECONCILIATION_REQUIRED"]);
});

test("task mismatch is inconsistent", () => {
  const s=state();
  const result=evaluateContinuityConformance({
    continuity:continuity({taskId:"other"}), state:s,
    contractFingerprint:s.contractFingerprint,
    repositoryFingerprint:{branch:"main",head:"abc"}, changedPaths:[],
  });
  assert.equal(result.status,"INCONSISTENT");
  assert.equal(result.errors[0].code,"E_CONTINUITY_TASK_MISMATCH");
});
