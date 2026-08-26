import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { verifyEvidenceDirectory } from "../../scripts/verify_poc_evidence.mjs";

const DEFAULT_EVIDENCE_DIR = path.resolve(process.cwd(), "poc/evidence/poc-20260826-real-execution");

test("published PoC evidence package passes all integrity and semantic assertions", async () => {
  const result = await verifyEvidenceDirectory(DEFAULT_EVIDENCE_DIR);
  if (!result.valid) {
    console.error("Verification errors:", result.errors);
  }
  assert.equal(result.valid, true);
  assert.equal(result.summary.executionCompletionStatus, "VALID");
  assert.equal(result.summary.postPublicationAuditStatus, "INVALID");
  assert.equal(result.summary.publicationPackageIntegrity, "VALID");
});

test("evidence verifier detects a file hash mutation", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "poc-verify-tamper-"));
  try {
    await fs.cp(DEFAULT_EVIDENCE_DIR, tmpDir, { recursive: true });
    
    // Mutate one byte in history.json
    const historyPath = path.join(tmpDir, "history.json");
    const originalContent = await fs.readFile(historyPath, "utf8");
    await fs.writeFile(historyPath, originalContent + " ");

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Hash mismatch for history.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier detects missing referenced file", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "poc-verify-missing-"));
  try {
    await fs.cp(DEFAULT_EVIDENCE_DIR, tmpDir, { recursive: true });
    
    // Remove protocol-info.json
    await fs.unlink(path.join(tmpDir, "protocol-info.json"));

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("protocol-info.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects directory traversal and unsafe paths", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "poc-verify-unsafe-"));
  try {
    await fs.cp(DEFAULT_EVIDENCE_DIR, tmpDir, { recursive: true });
    
    // Inject unsafe traversal path into manifest.json
    const manifestPath = path.join(tmpDir, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.files.push({
      path: "../outside.json",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      sizeBytes: 10,
      classification: "UNSAFE",
      description: "Malicious path"
    });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Path safety violation")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier preserves semantic distinction of execution vs post-publication drift", async () => {
  const result = await verifyEvidenceDirectory(DEFAULT_EVIDENCE_DIR);
  assert.equal(result.valid, true);

  const manifestPath = path.join(DEFAULT_EVIDENCE_DIR, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  assert.equal(manifest.executionCompletion.status, "VALID");
  assert.equal(manifest.postPublicationAudit.status, "INVALID");
  assert.ok(manifest.postPublicationAudit.reasonCodes.includes("E_RECEIPT_PATH_MISMATCH"));
  assert.equal(manifest.productionReadiness.status, "NOT_VERIFIED");
});
