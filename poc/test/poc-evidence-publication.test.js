import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  verifyEvidenceDirectory,
  normalizeEvidencePath,
  isUnsafeEvidencePath,
  DEFAULT_EVIDENCE_DIR,
  MAINTENANCE_EVIDENCE_DIR
} from "../../scripts/verify_poc_evidence.mjs";

async function createEvidenceFixture(prefix = "poc-verify-fixture-") {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.cp(DEFAULT_EVIDENCE_DIR, tmpDir, { recursive: true });
  return tmpDir;
}

async function createMaintenanceEvidenceFixture(prefix = "poc-maintenance-fixture-") {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.cp(MAINTENANCE_EVIDENCE_DIR, tmpDir, { recursive: true });
  return tmpDir;
}

async function mutateJson(filePath, mutator) {
  const content = JSON.parse(await fs.readFile(filePath, "utf8"));
  mutator(content);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2) + "\n");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function refreshMaintenanceFixtureIntegrity(tmpDir) {
  const manifestPath = path.join(tmpDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(tmpDir, entry.path));
    entry.sha256 = sha256(bytes);
    entry.sizeBytes = bytes.byteLength;
  }
  manifest.fileCount = manifest.files.length;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const manifestBytes = await fs.readFile(manifestPath);
  const manifestHash = sha256(manifestBytes);
  await fs.writeFile(path.join(tmpDir, "manifest.sha256"), `${manifestHash}  manifest.json\n`);

  const hashEntries = [
    ...manifest.files.map(entry => ({ path: entry.path, sha256: entry.sha256 })),
    { path: "manifest.json", sha256: manifestHash }
  ].sort((left, right) => left.path.localeCompare(right.path));
  await fs.writeFile(
    path.join(tmpDir, "hashes.txt"),
    hashEntries.map(entry => `${entry.sha256}  ${entry.path}`).join("\n") + "\n"
  );
}

async function mutateMaintenanceEvents(tmpDir, mutator) {
  const eventsPath = path.join(tmpDir, "source/events.ndjson");
  const events = (await fs.readFile(eventsPath, "utf8"))
    .trim()
    .split("\n")
    .map(line => JSON.parse(line));
  mutator(events);
  await fs.writeFile(eventsPath, events.map(event => JSON.stringify(event)).join("\n") + "\n");
  await refreshMaintenanceFixtureIntegrity(tmpDir);
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

// 6. Host-Independent Path Safety Helpers
test("isUnsafeEvidencePath rejects Windows drive-absolute paths on every host", () => {
  assert.equal(isUnsafeEvidencePath("C:\\outside.json"), true);
  assert.equal(isUnsafeEvidencePath("C:/outside.json"), true);
  assert.equal(isUnsafeEvidencePath("D:\\folder\\file.json"), true);
  assert.equal(isUnsafeEvidencePath("D:/folder/file.json"), true);
});

test("isUnsafeEvidencePath rejects Windows UNC paths on every host", () => {
  assert.equal(isUnsafeEvidencePath("\\\\server\\share\\file.json"), true);
  assert.equal(isUnsafeEvidencePath("//server/share/file.json"), true);
});

test("isUnsafeEvidencePath rejects Windows device namespace paths", () => {
  assert.equal(isUnsafeEvidencePath("\\\\?\\C:\\outside.json"), true);
  assert.equal(isUnsafeEvidencePath("\\\\.\\C:\\outside.json"), true);
});

test("isUnsafeEvidencePath does not reject safe relative strings merely for containing a colon", () => {
  assert.equal(isUnsafeEvidencePath("fixtures/value:example.json"), false);
});

// 7. End-to-End Manifest & Hashes Traversal Rejection
test("evidence verifier rejects Windows drive-absolute manifest paths", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-win-absolute-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.push({
        path: "C:\\outside.json",
        sha256: "0".repeat(64),
        sizeBytes: 10,
        classification: "UNSAFE",
        description: "Windows drive absolute path fixture"
      });
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("Path safety violation in manifest")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects Windows UNC manifest paths", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-win-unc-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.push({
        path: "\\\\server\\share\\outside.json",
        sha256: "0".repeat(64),
        sizeBytes: 10,
        classification: "UNSAFE",
        description: "Windows UNC path fixture"
      });
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("Path safety violation in manifest")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects Windows absolute paths in hashes.txt", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-win-hash-absolute-");
  try {
    const hashesPath = path.join(tmpDir, "hashes.txt");
    await fs.appendFile(hashesPath, `${"0".repeat(64)}  C:\\outside.json\n`);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("Path safety violation in hashes.txt")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 8. Cross-File Production Readiness Consistency
test("evidence verifier rejects manifest production readiness that overclaims verification", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-manifest-prod-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.productionReadiness.status = "VERIFIED";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("manifest.productionReadiness.status must be NOT_VERIFIED")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evidence verifier rejects publication production readiness mismatch", async () => {
  const tmpDir = await createEvidenceFixture("poc-verify-publication-prod-");
  try {
    await mutateJson(path.join(tmpDir, "publication.json"), publication => {
      publication.productionReadiness = "verified";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("productionReadiness")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 9. PR #113 Maintenance Evidence Package
test("published PR #113 maintenance evidence package passes all integrity and semantic assertions", async () => {
  const result = await verifyEvidenceDirectory(MAINTENANCE_EVIDENCE_DIR);
  if (!result.valid) {
    console.error("Maintenance verification errors:", result.errors);
  }
  assert.equal(result.valid, true);
  assert.equal(result.summary.executionCompletionStatus, "VALID");
  assert.equal(result.summary.postPublicationAuditStatus, "STALE");
  assert.equal(result.summary.publicationPackageIntegrity, "VALID");
});

test("maintenance evidence verifier detects file mutation in source events", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-tamper-");
  try {
    const eventsPath = path.join(tmpDir, "source/events.ndjson");
    const content = await fs.readFile(eventsPath, "utf8");
    await fs.writeFile(eventsPath, content + "\n");

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("source/events.ndjson")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance evidence verifier detects missing referenced execution record", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-missing-exec-");
  try {
    const execPath = path.join(tmpDir, "source/executions/exec-80e1a881-8623-4b24-bd6a-4e5d5892d414.json");
    await fs.unlink(execPath);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("Missing referenced execution provenance record") || e.includes("exec-80e1a881-8623-4b24-bd6a-4e5d5892d414.json")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance evidence verifier rejects non-monotonic event sequences", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-monotonic-");
  try {
    const eventsPath = path.join(tmpDir, "source/events.ndjson");
    const rawEvents = (await fs.readFile(eventsPath, "utf8")).trim().split("\n");
    const parsed = rawEvents.map(l => JSON.parse(l));
    if (parsed.length >= 3) {
      parsed[2].seq = parsed[1].seq;
    }
    await fs.writeFile(eventsPath, parsed.map(p => JSON.stringify(p)).join("\n") + "\n");
    const sha = (await import("node:crypto")).createHash("sha256").update(await fs.readFile(eventsPath)).digest("hex");
    await mutateJson(path.join(tmpDir, "manifest.json"), m => {
      const f = m.files.find(x => x.path === "source/events.ndjson");
      if (f) {
        f.sha256 = sha;
        f.sizeBytes = Buffer.byteLength(parsed.map(p => JSON.stringify(p)).join("\n") + "\n");
      }
    });
    const manifestJson = await fs.readFile(path.join(tmpDir, "manifest.json"), "utf8");
    const mSha = (await import("node:crypto")).createHash("sha256").update(manifestJson).digest("hex");
    await fs.writeFile(path.join(tmpDir, "manifest.sha256"), `${mSha}  manifest.json\n`);
    const hContent = (await fs.readFile(path.join(tmpDir, "hashes.txt"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map(line => {
        if (line.endsWith("  source/events.ndjson")) return `${sha}  source/events.ndjson`;
        if (line.endsWith("  manifest.json")) return `${mSha}  manifest.json`;
        return line;
      })
      .join("\n") + "\n";
    await fs.writeFile(path.join(tmpDir, "hashes.txt"), hContent);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e =>
      e.includes("Event sequence non-monotonic") ||
      (e.includes("E_EVENT_INVALID") && e.includes("event sequence must be 3"))
    ), `Expected event sequence error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance evidence verifier rejects taskId mismatch in publication.json", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-taskid-mismatch-");
  try {
    await mutateJson(path.join(tmpDir, "publication.json"), p => {
      p.forgeloopTask.taskId = "wrong-task-id";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("publication.json taskId")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance evidence verifier rejects privacy review failures", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-privacy-fail-");
  try {
    await mutateJson(path.join(tmpDir, "privacy-review.json"), p => {
      p.secretsPublished = true;
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("privacy-review.json reports secretsPublished !== false")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// 9b. Hardened verifier regression tests (privacy scan, semantics, projection labels)

test("maintenance verifier independently detects unredacted macOS path in execution record (does not trust privacy-review.json)", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-mac-path-");
  try {
    // Inject an unredacted macOS path into the first execution record
    const execDir = path.join(tmpDir, "source/executions");
    const execFiles = (await fs.readdir(execDir)).filter(f => f.endsWith(".json")).sort();
    const firstExec = path.join(execDir, execFiles[0]);
    await mutateJson(firstExec, exec => {
      exec.cwd = "/Users/testuser/Documents/github/forgeloop";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    // Must fail for the privacy scan (8.A.6), not just for manifest hash mismatch
    const hasPrivacyError = result.errors.some(e =>
      e.includes("Privacy violation") || e.includes("cwd contains unredacted machine-local path")
    );
    assert.ok(hasPrivacyError, `Expected privacy violation error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier independently detects unredacted Linux home path in bundle", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-linux-path-");
  try {
    // Inject Linux home path into work-state.json
    await mutateJson(path.join(tmpDir, "source/work-state.json"), ws => {
      ws._injectedTestPath = "/home/ciuser/repo/forgeloop/node_modules";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasPrivacyError = result.errors.some(e => e.includes("Privacy violation") && e.includes("Linux home path"));
    assert.ok(hasPrivacyError, `Expected Linux path privacy error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier independently detects credential-like content in bundle", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-credentials-");
  try {
    // Inject credential-like field into an inspection file
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._injectedTestCred = "auth_token=abcdef1234567890abcdef";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasCredError = result.errors.some(e => e.includes("Privacy violation") && e.includes("credentials or tokens"));
    assert.ok(hasCredError, `Expected credential privacy error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects audit-summary.json that conflates protocolValidation=VALID with historical completion", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-audit-summary-valid-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), as => {
      // This was the original incorrect field that mixed historical and publication-time
      as.protocolValidation = "VALID";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasSemanticError = result.errors.some(e =>
      e.includes("must not claim top-level protocolValidation=VALID") ||
      e.includes("protocolValidation=VALID")
    );
    assert.ok(hasSemanticError, `Expected semantic separation error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects audit-summary.json without historicalCompletionState=COMPLETE", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-audit-hist-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), as => {
      as.historicalCompletionState = "VERIFYING";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasError = result.errors.some(e => e.includes("historicalCompletionState") && e.includes("COMPLETE"));
    assert.ok(hasError, `Expected historical completion error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects audit-summary.json missing strict audit reason-code coverage", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-strict-codes-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), as => {
      // Remove strictAuditErrorCodes entirely
      delete as.publicationTimeStrictAudit.reasonCodes;
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasError = result.errors.some(e => e.includes("strict audit reason codes"));
    assert.ok(hasError, `Expected strict audit reason-code error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects execution-receipt.json missing REDACTED_PUBLICATION_PROJECTION label", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-receipt-proj-");
  try {
    await mutateJson(path.join(tmpDir, "source/execution-receipt.json"), r => {
      // Remove the projection label
      delete r._projection;
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasError = result.errors.some(e =>
      e.includes("REDACTED_PUBLICATION_PROJECTION") && e.includes("execution-receipt.json")
    );
    assert.ok(hasError, `Expected projection label error for receipt, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects privacy-review.json with localAbsolutePathsPublished=true", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-local-paths-flag-");
  try {
    await mutateJson(path.join(tmpDir, "privacy-review.json"), p => {
      p.localAbsolutePathsPublished = true;
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    const hasError = result.errors.some(e => e.includes("localAbsolutePathsPublished !== false"));
    assert.ok(hasError, `Expected localAbsolutePathsPublished error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects event body tampering after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-event-body-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events[10].details = { ...events[10].details, injected: "tampered" };
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("event 11 hash does not match its content")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects a wrong final event hash after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-event-hash-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events.at(-1).hash = "0".repeat(64);
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("event 35 hash does not match its content")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects a broken previousHash after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-previous-hash-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events[5].previousHash = "f".repeat(64);
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("event 6 previousHash does not match")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects a skipped event sequence after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-seq-skip-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events[8].seq = 10;
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("event sequence must be 9")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects an event taskId change after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-event-task-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events[12].taskId = "different-task";
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("event task IDs must remain stable")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects a missing completion event after package hashes are recomputed", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-no-completion-");
  try {
    await mutateMaintenanceEvents(tmpDir, events => {
      events.splice(events.findIndex(event => event.event === "COMPLETION_VALIDATED"), 1);
    });

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("COMPLETION_VALIDATED")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects duplicate executionRef values", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-duplicate-exec-ref-");
  try {
    await mutateJson(path.join(tmpDir, "source/execution-receipt.json"), receipt => {
      receipt.checks[1].executionRef = receipt.checks[0].executionRef;
      receipt.checks[1].details.execution.executionRef = receipt.checks[0].executionRef;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("Duplicate executionRef")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects receipt and execution argv disagreement", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-argv-mismatch-");
  try {
    await mutateJson(path.join(tmpDir, "source/execution-receipt.json"), receipt => {
      receipt.checks[0].details.execution.argv = ["npm", "run", "different-command"];
      receipt.checks[0].details.command = "npm run different-command";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("argv mismatch")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects an orphaned published execution record", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-orphan-exec-");
  try {
    await mutateJson(path.join(tmpDir, "source/execution-receipt.json"), receipt => {
      delete receipt.checks[0].executionRef;
      delete receipt.checks[0].details.execution.executionRef;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("published execution record is not referenced")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects a historical receipt state overclaim in audit-summary.json", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-receipt-overclaim-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), summary => {
      summary.historicalReceiptSnapshot.status = "complete";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("historicalReceiptSnapshot.status")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects publication-time protocol reason drift in audit-summary.json", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-protocol-reasons-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), summary => {
      summary.publicationTimeProtocolValidation.reasons = ["DIFFERENT_REASON"];
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("publication-time protocol reasons")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects extra strict-audit reason codes in audit-summary.json", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-strict-extra-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), summary => {
      summary.publicationTimeStrictAudit.reasonCodes.push("E_NOT_PRESENT");
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("strict audit reason codes")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects execution provenance coverage count drift", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-coverage-count-");
  try {
    await mutateJson(path.join(tmpDir, "audit-summary.json"), summary => {
      summary.executionProvenanceCoverage.referenced = 99;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("execution provenance coverage")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects bearer authorization material even when privacy-review passes", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-bearer-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixtureAuthorization = `Bearer ${["ghp_", "1234567890abcdefghijklmnop"].join("")}`;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("authorization bearer material")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects private-key material even when privacy-review passes", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-private-key-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixturePrivateKey = ["-----BEGIN ", "OPENSSH PRIVATE KEY-----"].join("");
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("private-key material")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects nondeterministic manifest path ordering", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-manifest-order-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      manifest.files.reverse();
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("manifest files must be sorted")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier requires manifest evidence classifications", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-manifest-classification-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      delete manifest.files[0].classification;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("classification")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier requires explicit private-original commitments", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-private-commitments-");
  try {
    await mutateJson(path.join(tmpDir, "manifest.json"), manifest => {
      delete manifest.privateOriginalCommitments;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("privateOriginalCommitments")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects Windows user paths in public payloads", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-windows-payload-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixturePath = "C:\\Users\\builduser\\forgeloop";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("Windows user path")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects UNC paths in public payloads", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-unc-payload-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixturePath = "\\\\build-server\\private-share";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("UNC path")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects API-key assignments in public payloads", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-api-key-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixtureCredential = `api_key=${["sk", "-test-1234567890abcdef"].join("")}`;
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("credentials or tokens")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects cookie headers in public payloads", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-cookie-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixtureCookie = "Cookie: sessionid=0123456789abcdef";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("cookie header material")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects SSH private paths in public payloads", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-ssh-path-");
  try {
    await mutateJson(path.join(tmpDir, "inspection/protocol-info.json"), info => {
      info._fixtureSshPath = ".ssh/id_ed25519";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("SSH private path material")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects execution check linkage drift", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-check-linkage-");
  try {
    const executionPath = path.join(
      tmpDir,
      "source/executions/exec-360e38f6-5df2-4d3a-b555-4b290e30313a.json"
    );
    await mutateJson(executionPath, execution => {
      execution.checkId = "different-check";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("task/check/requirement linkage mismatch")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("maintenance verifier rejects inconsistent execution timestamps", async () => {
  const tmpDir = await createMaintenanceEvidenceFixture("poc-maint-exec-time-");
  try {
    const executionPath = path.join(
      tmpDir,
      "source/executions/exec-360e38f6-5df2-4d3a-b555-4b290e30313a.json"
    );
    await mutateJson(executionPath, execution => {
      execution.finishedAt = "not-a-timestamp";
    });
    await refreshMaintenanceFixtureIntegrity(tmpDir);

    const result = await verifyEvidenceDirectory(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("inconsistent timestamps or duration")));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
