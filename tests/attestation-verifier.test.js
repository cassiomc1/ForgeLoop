import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { assertAttestationStatementBindings, verifyCodeManifestContent } from "../src/core/attestation-verifier.js";
import { canonicalFingerprint } from "../src/core/artifacts.js";

const bytes = Buffer.from("verified source\n", "utf8");
const digest = createHash("sha256").update(bytes).digest("hex");
const zero = "0".repeat(64);

function manifest() {
  const entries = [{ path: "src/index.js", operation: "MODIFIED", kind: "FILE", sha256: digest, providerMetadata: {} }];
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "attestation-verify-001",
    verificationCycle: 1,
    capture: { mode: "WORKTREE", revisionProvider: "fixture", baseRevision: null, observedRevision: "WORKTREE", providerMetadata: {} },
    bindings: { contractFingerprint: zero, routeFingerprint: null, stateFingerprint: zero, receiptFingerprint: zero, ledgerSeq: 1, ledgerHash: zero },
    entries,
    contentDigest: canonicalFingerprint(entries),
  };
}

test("attestation verifier preserves manifest bindings and detects content mutation", async () => {
  const value = manifest();
  const statement = {
    predicate: {
      task: { taskId: value.taskId, verificationCycle: value.verificationCycle },
      content: { manifestFingerprint: canonicalFingerprint(value), contentDigest: value.contentDigest, coveredPaths: ["src/index.js"] },
      evidence: { ...value.bindings },
    },
  };
  assert.doesNotThrow(() => assertAttestationStatementBindings(statement, value, value.taskId));

  let current = bytes;
  const provider = {
    name: "fixture",
    async detect() { return true; },
    async getCurrentRevision() { return "fixture"; },
    async getChangedEntries() { return []; },
    async readContent() { return current; },
    async getContentIdentity() { return "fixture-content"; },
    async getRepositoryIdentity() { return "fixture-repository"; },
  };
  const verified = await verifyCodeManifestContent({ target: ".", manifest: value, revisionProvider: provider });
  assert.equal(verified.results[0].valid, true);
  current = Buffer.from("tampered source\n", "utf8");
  await assert.rejects(
    () => verifyCodeManifestContent({ target: ".", manifest: value, revisionProvider: provider }),
    (error) => error.code === "E_ATTESTATION_CONTENT_MISMATCH",
  );
  assert.throws(
    () => assertAttestationStatementBindings({ ...statement, predicate: { ...statement.predicate, content: { ...statement.predicate.content, contentDigest: "f".repeat(64) } } }, value, value.taskId),
    (error) => error.code === "E_ATTESTATION_SUBJECT_MISMATCH",
  );
});
