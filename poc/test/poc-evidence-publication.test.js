import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { verifyEvidenceDirectory, normalizeEvidencePath, isUnsafeEvidencePath } from "../../scripts/verify_poc_evidence.mjs";

const DEFAULT_EVIDENCE_DIR = path.resolve(process.cwd(), "poc/evidence/poc-20260826-real-execution");

async function createEvidenceFixture(prefix = "poc-verify-fixture-") {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.cp(DEFAULT_EVIDENCE_DIR, tmpDir, { recursive: true });
  return tmpDir;
}

async function mutateJson(filePath, mutator) {
  const content = JSON.parse(await fs.readFile(filePath, "utf8"));
  mutator(content);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2) + "\n");
}

// 1. Baseline Valid Package
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

// 2. Cryptographic Mutation & Missing Files
test("evidence verifier detects a file hash mutation", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-tamper-");
  try {
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
  const tmpDir = await createEvidenceFixture("poc-verify-missing-");
  try {
    await fs.unlink(path.join(tmpDir, "protocol-info.json"));

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("protocol-info.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 3. Path Safety & Traversal Rejection
test("evidence verifier rejects Unix-style directory traversal in manifest", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-traversal-unix-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.push({
        path: "../outside.json",
        sha256: "0".repeat(64),
        sizeBytes: 10,
        classification: "UNSAFE",
        description: "Traversal fixture"
      });
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Path safety violation in manifest: ../outside.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects Windows-style directory traversal in manifest", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-traversal-win-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.push({
        path: "..\\outside.json",
        sha256: "0".repeat(64),
        sizeBytes: 10,
        classification: "UNSAFE",
        description: "Windows traversal fixture"
      });
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Path safety violation in manifest: ..\\outside.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects nested Windows directory traversal", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-traversal-nested-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.push({
        path: "nested\\..\\outside.json",
        sha256: "0".repeat(64),
        sizeBytes: 10,
        classification: "UNSAFE",
        description: "Nested traversal fixture"
      });
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Path safety violation in manifest: nested\\..\\outside.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects non-canonical backslash separators in manifest", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-backslash-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      const entry = manifest.files.find(f => f.path.startsWith("task-state/"));
      if (entry) {
        entry.path = entry.path.replaceAll("/", "\\");
      }
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Non-canonical manifest path separator")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 4. hashes.txt Strict Parity
test("evidence verifier rejects duplicate paths in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-dup-hashes-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    const content = await fs.readFile(hashesPath, "utf8");
    const firstLine = content.split("\n")[0];
    await fs.writeFile(hashesPath, firstLine + "\n" + content);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Duplicate path in hashes.txt")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects unexpected extra paths in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-extra-hash-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    await fs.appendFile(hashesPath, `${"0".repeat(64)}  unexpected-extra.json\n`);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Unexpected path in hashes.txt: unexpected-extra.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects missing paths in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-missing-hash-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    const content = await fs.readFile(hashesPath, "utf8");
    const filtered = content.split("\n").filter(l => !l.includes("completion.json")).join("\n");
    await fs.writeFile(hashesPath, filtered);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Missing path in hashes.txt: completion.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects self-referential entry in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-self-ref-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    await fs.appendFile(hashesPath, `${"0".repeat(64)}  hashes.txt\n`);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Self-referential hashing violation")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects unsafe traversal path in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-unsafe-hash-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    await fs.appendFile(hashesPath, `${"0".repeat(64)}  ..\\outside.json\n`);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Path safety violation in hashes.txt: ..\\outside.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 5. Semantic Validation of completion.json
test("evidence verifier rejects invalid completion status in completion.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-status-");
  try {
    await mutateJson(path.join(tmpDir, "completion.json"), c => {
      c.status = "INVALID";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("completion.json status must be VALID")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects non-COMPLETE taskStatus in completion.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-taskstatus-");
  try {
    await mutateJson(path.join(tmpDir, "completion.json"), c => {
      c.taskStatus = "REVIEWING";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("completion.json taskStatus must be COMPLETE")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects non-VALID verificationStatus in completion.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-verifstatus-");
  try {
    await mutateJson(path.join(tmpDir, "completion.json"), c => {
      c.verificationStatus = "INCOMPLETE";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("completion.json verificationStatus must be VALID")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects premature productionReadiness in completion.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-prodreadiness-");
  try {
    await mutateJson(path.join(tmpDir, "completion.json"), c => {
      c.productionReadiness = "verified";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("completion.json productionReadiness must be not-verified")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects unexpected errors array in completion.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-errors-");
  try {
    await mutateJson(path.join(tmpDir, "completion.json"), c => {
      c.errors = [{ code: "E_TEST_ERROR", message: "Unexpected failure" }];
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("completion.json errors must be empty array")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects mismatch between completion.json and manifest.json", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-completion-mismatch-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.executionCompletion.status = "PARTIALLY_VALID";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("does not match manifest.executionCompletion.status")));
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
