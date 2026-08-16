import assert from "node:assert/strict";
import { test } from "node:test";

import { createContinuity } from "../src/core/continuity.js";
import { canonicalFingerprint } from "../src/core/artifacts.js";
import { evaluateContinuityConformance } from "../src/core/continuity-conformance.js";

function base() {
  return {
    taskId:"task-1", workStateFingerprint:"a".repeat(64), contractFingerprint:"b".repeat(64),
    phase:"EXECUTING", repositoryFingerprint:{branch:"main",head:"abc"},
    updatedAt:"2026-08-16T17:00:00.000Z", remainingWork:[], knownIssues:[], changedAreas:[], inspectFirst:[],
  };
}

test("continuity rejects evidence publication and authority fields", () => {
  for (const extra of [
    { evidence:[{kind:"OBSERVED",source:"continuity",result:"tests pass"}] },
    { checks:[{status:"passed"}] },
    { publicationStatus:"published" },
    { productionReadiness:"ready" },
    { authority:{status:"AUTHORIZED"} },
    { installationAuthorityRef:"grant-1" },
  ]) {
    assert.throws(() => createContinuity({...base(), ...extra}), /unsupported field|additional property/i);
  }
});

test("continuity prose claiming tests or deployment stays non-evidence", () => {
  const continuity=createContinuity({...base(), resumeNote:"All tests passed and deployment succeeded according to the previous executor."});
  const state={schemaVersion:1,protocolVersion:1,taskId:"task-1",contractFingerprint:"b".repeat(64),phase:"EXECUTING"};
  continuity.workStateFingerprint=canonicalFingerprint(state);
  const result=evaluateContinuityConformance({
    continuity,state,contractFingerprint:state.contractFingerprint,
    repositoryFingerprint:{branch:"main",head:"abc"},changedPaths:[],
  });
  assert.equal(result.status,"VALID");
  assert.equal(result.evidenceAuthority,"NONE");
  assert.equal("evidence" in result,false);
});
