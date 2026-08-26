#!/usr/bin/env node

/**
 * ForgeLoop PoC Evidence Package Verifier
 * 
 * Deterministically validates cryptographic integrity, path safety,
 * manifest consistency, and semantic protocol invariants for the
 * published Real Execution Proof of Concept evidence package.
 *
 * Zero external dependencies.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_EVIDENCE_DIR = path.resolve(REPO_ROOT, "poc/evidence/poc-20260826-real-execution");

export async function computeSha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

export async function getAllFiles(dir, baseDir = dir, fileList = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await getAllFiles(fullPath, baseDir, fileList);
    } else {
      const relPath = path.relative(baseDir, fullPath).replaceAll("\\", "/");
      fileList.push({ fullPath, relPath });
    }
  }
  return fileList;
}

export async function verifyEvidenceDirectory(evidenceDir = DEFAULT_EVIDENCE_DIR) {
  const resolvedDir = path.resolve(evidenceDir);
  const errors = [];
  const warnings = [];

  // 1. Check root directory existence
  try {
    const rootStat = await stat(resolvedDir);
    if (!rootStat.isDirectory()) {
      return { valid: false, errors: [`Evidence path is not a directory: ${resolvedDir}`] };
    }
  } catch (err) {
    return { valid: false, errors: [`Evidence directory not found: ${resolvedDir} (${err.message})`] };
  }

  // 2. Read manifest.json
  const manifestPath = path.join(resolvedDir, "manifest.json");
  let manifest;
  try {
    const manifestContent = await readFile(manifestPath, "utf8");
    manifest = JSON.parse(manifestContent);
  } catch (err) {
    return { valid: false, errors: [`Failed to read/parse manifest.json: ${err.message}`] };
  }

  // 3. Verify manifest.sha256 if present
  const manifestShaPath = path.join(resolvedDir, "manifest.sha256");
  try {
    const expectedManifestHash = (await readFile(manifestShaPath, "utf8")).trim().split(/\s+/)[0];
    const actualManifestHash = await computeSha256(manifestPath);
    if (expectedManifestHash !== actualManifestHash) {
      errors.push(`manifest.sha256 mismatch: expected ${expectedManifestHash}, got ${actualManifestHash}`);
    }
  } catch (err) {
    errors.push(`Failed to read manifest.sha256: ${err.message}`);
  }

  // 4. Validate manifest entries for path safety and duplicates
  const seenPaths = new Set();
  const manifestFilesMap = new Map();

  for (const entry of manifest.files ?? []) {
    const relPath = entry.path;
    if (!relPath) {
      errors.push("Manifest file entry missing 'path'");
      continue;
    }

    if (path.isAbsolute(relPath)) {
      errors.push(`Path safety violation: absolute path in manifest: ${relPath}`);
    }

    if (relPath.startsWith("../") || relPath.includes("/../") || relPath === "..") {
      errors.push(`Path safety violation: directory traversal in manifest: ${relPath}`);
    }

    if (seenPaths.has(relPath)) {
      errors.push(`Duplicate path in manifest: ${relPath}`);
    }
    seenPaths.add(relPath);
    manifestFilesMap.set(relPath, entry);
  }

  // 5. Verify every listed file exists, matches sha256 and sizeBytes
  for (const [relPath, entry] of manifestFilesMap.entries()) {
    const fullPath = path.join(resolvedDir, relPath);
    try {
      const fileStat = await stat(fullPath);
      if (entry.sizeBytes !== undefined && fileStat.size !== entry.sizeBytes) {
        errors.push(`Size mismatch for ${relPath}: expected ${entry.sizeBytes}, got ${fileStat.size}`);
      }

      const actualHash = await computeSha256(fullPath);
      if (entry.sha256 && actualHash !== entry.sha256) {
        errors.push(`Hash mismatch for ${relPath}: expected ${entry.sha256}, got ${actualHash}`);
      }
    } catch (err) {
      errors.push(`Missing referenced evidence file: ${relPath} (${err.message})`);
    }
  }

  // 6. Check for unexpected unlisted files in directory
  const allDirFiles = await getAllFiles(resolvedDir);
  const ignoredMetaFiles = new Set(["manifest.json", "manifest.sha256", "hashes.txt"]);

  for (const { relPath } of allDirFiles) {
    if (ignoredMetaFiles.has(relPath)) continue;
    if (!manifestFilesMap.has(relPath)) {
      errors.push(`Unexpected unlisted file in evidence directory: ${relPath}`);
    }
  }

  // 7. Verify hashes.txt consistency
  const hashesTxtPath = path.join(resolvedDir, "hashes.txt");
  try {
    const hashesContent = await readFile(hashesTxtPath, "utf8");
    const hashLines = hashesContent.split("\n").map(l => l.trim()).filter(Boolean);
    const hashesMap = new Map();

    for (const line of hashLines) {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      if (!match) {
        errors.push(`Invalid line in hashes.txt: "${line}"`);
        continue;
      }
      const [, hash, filePath] = match;
      hashesMap.set(filePath, hash);
    }

    // Verify all manifest files are in hashes.txt
    for (const [relPath, entry] of manifestFilesMap.entries()) {
      if (!hashesMap.has(relPath)) {
        errors.push(`File ${relPath} from manifest missing in hashes.txt`);
      } else if (hashesMap.get(relPath) !== entry.sha256) {
        errors.push(`Hash mismatch between manifest and hashes.txt for ${relPath}`);
      }
    }

    // Verify manifest.json itself is in hashes.txt
    const actualManifestHash = await computeSha256(manifestPath);
    if (!hashesMap.has("manifest.json")) {
      errors.push("manifest.json is missing in hashes.txt");
    } else if (hashesMap.get("manifest.json") !== actualManifestHash) {
      errors.push("hashes.txt manifest.json hash does not match actual manifest.json SHA-256");
    }

    // Ensure hashes.txt does not hash itself
    if (hashesMap.has("hashes.txt")) {
      errors.push("Self-referential hashing violation: hashes.txt contains entry for itself");
    }
  } catch (err) {
    errors.push(`Failed to read/verify hashes.txt: ${err.message}`);
  }

  // 8. Assert Semantic Invariants
  try {
    // 8.1 Manifest semantic fields
    if (manifest.executionCompletion?.status !== "VALID") {
      errors.push(`Semantic invariant failure: manifest.executionCompletion.status must be VALID, got ${manifest.executionCompletion?.status}`);
    }
    if (manifest.postPublicationAudit?.status !== "INVALID") {
      errors.push(`Semantic invariant failure: manifest.postPublicationAudit.status must be INVALID, got ${manifest.postPublicationAudit?.status}`);
    }
    if (!manifest.postPublicationAudit?.reasonCodes?.includes("E_RECEIPT_PATH_MISMATCH")) {
      errors.push("Semantic invariant failure: manifest.postPublicationAudit.reasonCodes must include E_RECEIPT_PATH_MISMATCH");
    }

    // 8.2 validate-protocol.json
    const validateProtocolPath = path.join(resolvedDir, "validate-protocol.json");
    const valProto = JSON.parse(await readFile(validateProtocolPath, "utf8"));
    if (valProto.status !== "VALID") {
      errors.push(`Semantic invariant failure: validate-protocol.json status must be VALID, got ${valProto.status}`);
    }

    // 8.3 audit.json
    const auditPath = path.join(resolvedDir, "audit.json");
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    if (audit.status !== "INVALID") {
      errors.push(`Semantic invariant failure: audit.json status must be INVALID, got ${audit.status}`);
    }
    const auditErrorCodes = (audit.errors ?? []).map(e => e.code);
    if (!auditErrorCodes.includes("E_RECEIPT_PATH_MISMATCH")) {
      errors.push(`Semantic invariant failure: audit.json must report E_RECEIPT_PATH_MISMATCH, got ${auditErrorCodes.join(", ")}`);
    }

    // 8.4 report.json
    const reportPath = path.join(resolvedDir, "report.json");
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (report.status !== "INVALID") {
      errors.push(`Semantic invariant failure: report.json status must be INVALID, got ${report.status}`);
    }

    // 8.5 task-state/work-state.json
    const workStatePath = path.join(resolvedDir, "task-state/work-state.json");
    const workState = JSON.parse(await readFile(workStatePath, "utf8"));
    if (workState.phase !== "COMPLETE") {
      errors.push(`Semantic invariant failure: work-state.json phase must be COMPLETE, got ${workState.phase}`);
    }

    // 8.6 task-state/events.ndjson
    const eventsPath = path.join(resolvedDir, "task-state/events.ndjson");
    const eventsContent = await readFile(eventsPath, "utf8");
    if (!eventsContent.includes("COMPLETION_VALIDATED")) {
      errors.push("Semantic invariant failure: events.ndjson must contain COMPLETION_VALIDATED event");
    }
  } catch (err) {
    errors.push(`Failed while evaluating semantic invariants: ${err.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      runId: manifest?.runId ?? "unknown",
      taskId: manifest?.taskId ?? "unknown",
      totalVerifiedFiles: manifestFilesMap.size,
      executionCompletionStatus: manifest?.executionCompletion?.status ?? "unknown",
      postPublicationAuditStatus: manifest?.postPublicationAudit?.status ?? "unknown",
      publicationPackageIntegrity: errors.length === 0 ? "VALID" : "INVALID"
    }
  };
}

// CLI entrypoint execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_EVIDENCE_DIR;
  
  verifyEvidenceDirectory(targetDir).then((result) => {
    if (result.valid) {
      console.log("ForgeLoop PoC evidence: VALID");
      console.log(`run: ${result.summary.runId}`);
      console.log(`task: ${result.summary.taskId}`);
      console.log(`files: ${result.summary.totalVerifiedFiles}`);
      console.log(`execution completion: ${result.summary.executionCompletionStatus}`);
      console.log(`post-publication drift detection: ${result.summary.postPublicationAuditStatus} (expected and documented)`);
      console.log(`publication package integrity: ${result.summary.publicationPackageIntegrity}`);
      process.exit(0);
    } else {
      console.error("ForgeLoop PoC evidence verification FAILED:");
      for (const err of result.errors) {
        console.error(`  ✖ ${err}`);
      }
      process.exit(1);
    }
  }).catch((err) => {
    console.error("Unexpected error in verifier:", err);
    process.exit(1);
  });
}
