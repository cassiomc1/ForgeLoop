import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { codeManifestContentDigest, validateCodeManifest } from "../src/core/code-manifest.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const zero = "0".repeat(64);

function manifest(entries = []) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "manifest-001",
    verificationCycle: 1,
    capture: {
      mode: "WORKTREE",
      revisionProvider: "fixture",
      baseRevision: null,
      observedRevision: "WORKTREE",
      providerMetadata: {},
    },
    bindings: {
      contractFingerprint: zero,
      routeFingerprint: null,
      stateFingerprint: zero,
      receiptFingerprint: zero,
      ledgerSeq: 1,
      ledgerHash: zero,
    },
    entries,
    contentDigest: codeManifestContentDigest(entries),
  };
}

test("code manifests bind normalized exact-content entries deterministically", async () => {
  const bytes = Buffer.from("manifest fixture\n", "utf8");
  const entry = {
    path: "src/index.js",
    operation: "MODIFIED",
    kind: "FILE",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    providerMetadata: {},
  };
  const value = await validateCodeManifest(manifest([entry]), packageRoot);
  assert.deepEqual(value.entries, [entry]);
  assert.equal(value.contentDigest, codeManifestContentDigest(value.entries));
  assert.notEqual(codeManifestContentDigest([]), value.contentDigest);
});

test("code manifests reject unsorted, duplicate, reserved, and stale content entries", async () => {
  const first = { path: "src/a.js", operation: "ADDED", kind: "FILE", sha256: zero };
  const second = { path: "src/b.js", operation: "ADDED", kind: "FILE", sha256: zero };
  await assert.rejects(() => validateCodeManifest(manifest([second, first]), packageRoot), /sorted/i);
  await assert.rejects(() => validateCodeManifest(manifest([first, first]), packageRoot), /duplicate/i);
  await assert.rejects(() => validateCodeManifest(manifest([{ ...first, path: ".forgeloop/state.json" }]), packageRoot), /reserved|unsafe/i);
  await assert.rejects(() => validateCodeManifest({ ...manifest(), contentDigest: "f".repeat(64) }, packageRoot), /contentDigest/i);
});
