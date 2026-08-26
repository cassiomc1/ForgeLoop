#!/usr/bin/env node

/**
 * ForgeLoop PoC Evidence Package Verifier
 * 
 * Deterministically validates cryptographic integrity, path safety,
 * cross-platform traversal protection, exact checksum parity,
 * manifest consistency, and semantic protocol invariants for the
 * published Real Execution Proof of Concept evidence package.
 *
 * Zero external dependencies.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateEventLedger } from "../src/core/events.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
export const DEFAULT_EVIDENCE_DIR = path.resolve(REPO_ROOT, "poc/evidence/poc-20260826-real-execution");
export const MAINTENANCE_EVIDENCE_DIR = path.resolve(REPO_ROOT, "poc/evidence/maintenance/pr-113-final-hardening");

export function normalizeEvidencePath(value) {
  if (typeof value !== "string") return "";
  return value.replaceAll("\\", "/");
}

export function isUnsafeEvidencePath(value) {
  if (typeof value !== "string" || value.length === 0) return true;

  const normalized = normalizeEvidencePath(value);

  const posixAbsolute = path.posix.isAbsolute(normalized);
  const windowsAbsoluteRaw = path.win32.isAbsolute(value);
  const windowsAbsoluteNormalized = path.win32.isAbsolute(normalized);

  return (
    posixAbsolute ||
    windowsAbsoluteRaw ||
    windowsAbsoluteNormalized ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized.startsWith("/")
  );
}

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
      const relPath = normalizeEvidencePath(path.relative(baseDir, fullPath));
      fileList.push({ fullPath, relPath });
    }
  }
  return fileList;
}

const REDACTED_PROJECTION_KIND = "REDACTED_PUBLICATION_PROJECTION";
const MANIFEST_META_FILES = new Set(["manifest.json", "manifest.sha256", "hashes.txt"]);
const MAINTENANCE_CLASSIFICATIONS = new Set([
  "AUTHORITATIVE_PUBLIC_ARTIFACT",
  "REDACTED_DERIVATIVE",
  "EXECUTION_PROVENANCE",
  "GATE_ATTESTATION",
  "PUBLICATION_OBSERVATION",
  "VALIDATION_OUTPUT",
  "PUBLICATION_METADATA",
  "DOCUMENTATION"
]);

function compareCanonicalPaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedUniqueStrings(values) {
  return [...new Set(values)].sort(compareCanonicalPaths);
}

function isValidSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function publicPayloadPrivacyFindings(content) {
  const checks = [
    ["unredacted macOS user path (/Users/<name>/...)", /\/Users\/[^/\s"']+\//],
    ["unredacted Linux home path (/home/<name>/...)", /\/home\/[^/\s"']+\//],
    ["Windows user path (C:\\Users\\<name>\\...)", /[A-Za-z]:(?:\\+|\/+)+Users(?:\\+|\/+)+[^\\/\s"']+(?:\\+|\/+)/],
    ["UNC path (\\\\<machine>\\...)", /\\\\[^\\\s"']+\\/],
    ["authorization bearer material", /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/i],
    ["private-key material", /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i],
    ["GitHub access token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
    ["cloud access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["credentials or tokens", /\b(?:password|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{8,}/i],
    ["cookie header material", /\b(?:Set-Cookie|Cookie)\s*:\s*[^\r\n]{8,}/i],
    ["SSH private path material", /(?:^|["'\\/])\.ssh(?:\\+|\/+)(?:id_[A-Za-z0-9_-]+|authorized_keys)(?:["'\s\\/]|$)/i],
    ["credential-bearing URL", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
    ["machine-local email or hostname", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.local\b/i]
  ];
  return checks.filter(([, pattern]) => pattern.test(content)).map(([finding]) => finding);
}

function commandFromArgv(argv) {
  return Array.isArray(argv) ? argv.join(" ") : "";
}

async function verifyMaintenanceEvidence({ resolvedDir, manifest, manifestFilesMap, errors }) {
  const metrics = {
    eventCount: 0,
    eventChainStatus: "INVALID",
    executionProvenanceCoverage: { referenced: 0, published: 0, missing: 0 },
    privacyStatus: "FAIL"
  };

  if (manifest.executionCompletion?.status !== "VALID") {
    errors.push(`Semantic invariant failure: manifest.executionCompletion.status must be VALID, got ${manifest.executionCompletion?.status}`);
  }
  if (manifest.productionReadiness?.status !== "NOT_VERIFIED") {
    errors.push(`Semantic invariant failure: manifest.productionReadiness.status must be NOT_VERIFIED, got ${manifest.productionReadiness?.status}`);
  }
  if (manifest.fileCount !== (manifest.files ?? []).length) {
    errors.push(`Semantic invariant failure: manifest.fileCount must equal manifest.files length (${manifest.files?.length ?? 0}), got ${manifest.fileCount}`);
  }

  const manifestPaths = (manifest.files ?? []).map(entry => entry.path);
  const sortedManifestPaths = [...manifestPaths].sort(compareCanonicalPaths);
  if (!equalJson(manifestPaths, sortedManifestPaths)) {
    errors.push("Semantic invariant failure: manifest files must be sorted by canonical path");
  }
  for (const entry of manifest.files ?? []) {
    if (!MAINTENANCE_CLASSIFICATIONS.has(entry.classification)) {
      errors.push(`Semantic invariant failure: manifest entry ${entry.path} has invalid or missing classification: ${entry.classification}`);
    }
    if (MANIFEST_META_FILES.has(entry.path)) {
      errors.push(`Semantic invariant failure: manifest.files must exclude integrity metadata file ${entry.path}`);
    }
  }

  const commitments = manifest.privateOriginalCommitments;
  if (!Array.isArray(commitments) || commitments.length === 0) {
    errors.push("Semantic invariant failure: manifest.privateOriginalCommitments must be a non-empty array");
  }
  const commitmentMap = new Map();
  for (const commitment of commitments ?? []) {
    if (typeof commitment.publicPath !== "string" || isUnsafeEvidencePath(commitment.publicPath)) {
      errors.push(`Semantic invariant failure: unsafe private-original commitment path: ${commitment.publicPath}`);
      continue;
    }
    if (commitmentMap.has(commitment.publicPath)) {
      errors.push(`Semantic invariant failure: duplicate private-original commitment for ${commitment.publicPath}`);
      continue;
    }
    if (commitment.algorithm !== "sha256" || !isValidSha256(commitment.originalSha256)) {
      errors.push(`Semantic invariant failure: invalid private-original SHA-256 commitment for ${commitment.publicPath}`);
    }
    if (!Array.isArray(commitment.redactedFields) || commitment.redactedFields.length === 0) {
      errors.push(`Semantic invariant failure: private-original commitment must list redactedFields for ${commitment.publicPath}`);
    }
    commitmentMap.set(commitment.publicPath, commitment);
  }

  const redactedManifestPaths = (manifest.files ?? [])
    .filter(entry => entry.classification === "REDACTED_DERIVATIVE")
    .map(entry => entry.path)
    .sort(compareCanonicalPaths);
  const commitmentPaths = [...commitmentMap.keys()].sort(compareCanonicalPaths);
  if (!equalJson(redactedManifestPaths, commitmentPaths)) {
    errors.push("Semantic invariant failure: REDACTED_DERIVATIVE manifest entries must exactly match privateOriginalCommitments");
  }
  for (const [publicPath, commitment] of commitmentMap) {
    try {
      const projection = await readJson(path.join(resolvedDir, publicPath));
      if (projection._projection?.kind !== REDACTED_PROJECTION_KIND) {
        errors.push(`Semantic invariant failure: ${publicPath} must be labeled ${REDACTED_PROJECTION_KIND}`);
      }
      if (projection._projection?.authority !== "NON_AUTHORITATIVE") {
        errors.push(`Semantic invariant failure: ${publicPath} projection authority must be NON_AUTHORITATIVE`);
      }
      if (projection._projection?.originalSha256 !== commitment.originalSha256) {
        errors.push(`Semantic invariant failure: ${publicPath} private-original commitment does not match its projection metadata`);
      }
      const projectionFields = projection._projection?.originalFieldsRedacted ?? [];
      if (!equalJson(projectionFields, commitment.redactedFields)) {
        errors.push(`Semantic invariant failure: ${publicPath} redactedFields do not match its private-original commitment`);
      }
    } catch (error) {
      errors.push(`Failed to validate redacted derivative ${publicPath}: ${error.message}`);
    }
  }

  const workState = await readJson(path.join(resolvedDir, "source/work-state.json"));
  const receipt = await readJson(path.join(resolvedDir, "source/execution-receipt.json"));
  const taskShow = await readJson(path.join(resolvedDir, "inspection/task-show.json"));
  const validateProtocol = await readJson(path.join(resolvedDir, "inspection/validate-protocol.json"));
  const validateReceipt = await readJson(path.join(resolvedDir, "inspection/validate-receipt.json"));
  const validateState = await readJson(path.join(resolvedDir, "inspection/validate-state.json"));
  const strictAudit = await readJson(path.join(resolvedDir, "inspection/audit-strict.json"));
  const publication = await readJson(path.join(resolvedDir, "publication.json"));
  const auditSummary = await readJson(path.join(resolvedDir, "audit-summary.json"));
  const privacy = await readJson(path.join(resolvedDir, "privacy-review.json"));

  if (workState.phase !== "COMPLETE" || validateState.state?.phase !== workState.phase) {
    errors.push(`Semantic invariant failure: source/work-state.json and inspection/validate-state.json must prove phase COMPLETE, got ${workState.phase}/${validateState.state?.phase}`);
  }
  if (workState.taskId !== manifest.taskId || validateState.state?.taskId !== manifest.taskId) {
    errors.push("Semantic invariant failure: work-state taskId does not match manifest.taskId");
  }
  if (taskShow.taskId !== manifest.taskId || taskShow.phase !== "COMPLETE" || taskShow.claimState !== "RELEASED_BY_COMPLETION") {
    errors.push("Semantic invariant failure: inspection/task-show.json must prove COMPLETE with RELEASED_BY_COMPLETION claims");
  }

  const expectedReceiptSnapshot = {
    status: "in-progress",
    taskStatus: "in-progress",
    verificationStatus: "not-verified"
  };
  for (const [field, expected] of Object.entries(expectedReceiptSnapshot)) {
    if (receipt[field] !== expected || validateReceipt[field] !== expected) {
      errors.push(`Semantic invariant failure: historicalReceiptSnapshot.${field} must be ${expected}, got ${receipt[field]}/${validateReceipt[field]}`);
    }
  }
  if (!Array.isArray(receipt.changedPaths) || receipt.changedPaths.length === 0) {
    errors.push("Semantic invariant failure: source/execution-receipt.json changedPaths must be a non-empty array");
  }
  if (receipt.taskId !== manifest.taskId || validateReceipt.taskId !== manifest.taskId) {
    errors.push("Semantic invariant failure: execution receipt taskId does not match manifest.taskId");
  }

  const ledgerValidation = await validateEventLedger(resolvedDir, REPO_ROOT, {
    eventsPath: "source/events.ndjson"
  });
  for (const finding of ledgerValidation.errors) {
    errors.push(`Event ledger validation failure (${finding.code}): ${finding.message}`);
  }
  const events = ledgerValidation.events;
  metrics.eventCount = events.length;
  const completionEvents = events.filter(event => event.event === "COMPLETION_VALIDATED");
  if (completionEvents.length !== 1) {
    errors.push(`Semantic invariant failure: source/events.ndjson must contain exactly one COMPLETION_VALIDATED event, got ${completionEvents.length}`);
  }
  const completionIndex = events.findIndex(event => event.event === "COMPLETION_VALIDATED");
  const completionTransaction = completionIndex >= 0 ? events[completionIndex + 1] : null;
  if (completionIndex !== events.length - 2
      || completionTransaction?.event !== "TRANSACTION_COMMITTED"
      || completionTransaction?.details?.operation !== "complete") {
    errors.push("Semantic invariant failure: COMPLETION_VALIDATED must be followed by the final complete TRANSACTION_COMMITTED event");
  }
  if (events.some(event => event.taskId !== manifest.taskId)) {
    errors.push("Event ledger validation failure (E_EVENT_INVALID): event task IDs must remain stable and match manifest.taskId");
  }
  const eventIndex = await readJson(path.join(resolvedDir, "source/events.ndjson.index.json"));
  if (eventIndex.seq !== events.length || eventIndex.lastHash !== events.at(-1)?.hash) {
    errors.push("Semantic invariant failure: events.ndjson.index.json does not match the verified event ledger tail");
  }
  if (ledgerValidation.valid && completionEvents.length === 1 && completionIndex === events.length - 2) {
    metrics.eventChainStatus = "VALID";
  }

  const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
  const publishedExecutionPaths = [...manifestFilesMap.keys()]
    .filter(filePath => /^source\/executions\/exec-[A-Za-z0-9_-]+\.json$/.test(filePath));
  const publishedExecutionRefs = new Set(publishedExecutionPaths.map(filePath => path.posix.basename(filePath, ".json")));
  const referencedExecutionRefs = [];
  const seenExecutionRefs = new Set();

  for (const check of checks) {
    const executionRef = check.executionRef;
    if (typeof executionRef !== "string" || !executionRef) {
      errors.push(`Semantic invariant failure: completion-relevant check ${check.id ?? "unknown"} is missing executionRef`);
      continue;
    }
    referencedExecutionRefs.push(executionRef);
    if (seenExecutionRefs.has(executionRef)) {
      errors.push(`Duplicate executionRef in receipt checks: ${executionRef}`);
    }
    seenExecutionRefs.add(executionRef);
    if (!publishedExecutionRefs.has(executionRef)) {
      errors.push(`Missing referenced execution provenance record: source/executions/${executionRef}.json`);
      continue;
    }

    const execution = await readJson(path.join(resolvedDir, `source/executions/${executionRef}.json`));
    if (execution.executionId !== executionRef) {
      errors.push(`Execution record identity mismatch: ${executionRef}`);
    }
    if (execution.taskId !== manifest.taskId || execution.checkId !== check.id || execution.requirement !== check.requirement) {
      errors.push(`Execution record ${executionRef} task/check/requirement linkage mismatch`);
    }
    if (check.kind !== "command" || check.evidenceKind !== "OBSERVED" || check.provenance !== "FORGELOOP_EXECUTED") {
      errors.push(`Execution record ${executionRef} has inconsistent FORGELOOP_EXECUTED provenance`);
    }
    const receiptExecution = check.details?.execution;
    if (!equalJson(execution.argv, receiptExecution?.argv)) {
      errors.push(`Execution record ${executionRef} argv mismatch between receipt and published provenance`);
    }
    if (check.source !== commandFromArgv(execution.argv)
        || check.details?.command !== commandFromArgv(execution.argv)) {
      errors.push(`Execution record ${executionRef} command/source mismatch with argv`);
    }
    if (check.status !== "passed" || check.exitCode !== 0
        || receiptExecution?.status !== "passed" || receiptExecution?.exitCode !== 0
        || execution.status !== "passed" || execution.exitCode !== 0) {
      errors.push(`Execution record ${executionRef} has inconsistent passed status or exitCode`);
    }
    if (execution.kind !== "COMMAND_EXECUTION" || execution.verificationCycle !== check.details?.verificationCycle) {
      errors.push(`Execution record ${executionRef} has inconsistent command kind or verification cycle`);
    }
    if (!isValidTimestamp(execution.startedAt) || !isValidTimestamp(execution.finishedAt)
        || !isValidTimestamp(check.timestamp)
        || Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)
        || execution.durationMs !== Date.parse(execution.finishedAt) - Date.parse(execution.startedAt)
        || Date.parse(check.timestamp) < Date.parse(execution.finishedAt)) {
      errors.push(`Execution record ${executionRef} has inconsistent timestamps or duration`);
    }
    if (execution._projection?.kind !== REDACTED_PROJECTION_KIND
        || execution._projection?.authority !== "NON_AUTHORITATIVE") {
      errors.push(`Execution record ${executionRef} must be a NON_AUTHORITATIVE ${REDACTED_PROJECTION_KIND}`);
    }
  }

  for (const executionRef of publishedExecutionRefs) {
    if (!seenExecutionRefs.has(executionRef)) {
      errors.push(`Semantic invariant failure: published execution record is not referenced by the receipt: ${executionRef}`);
    }
  }
  metrics.executionProvenanceCoverage = {
    referenced: referencedExecutionRefs.length,
    published: publishedExecutionRefs.size,
    missing: referencedExecutionRefs.filter(ref => !publishedExecutionRefs.has(ref)).length
  };

  if (publication.forgeloopTask?.taskId !== manifest.taskId) {
    errors.push(`Semantic invariant failure: publication.json taskId (${publication.forgeloopTask?.taskId}) does not match manifest.taskId (${manifest.taskId})`);
  }
  if (publication.forgeloopTask?.historicalLifecyclePhase !== "COMPLETE"
      || publication.forgeloopTask?.historicalCompletionValidation !== "VALID") {
    errors.push("Semantic invariant failure: publication.json historical completion is inconsistent");
  }
  if (publication.productionReadiness !== "not-verified") {
    errors.push(`Semantic invariant failure: publication.json productionReadiness must be not-verified, got ${publication.productionReadiness}`);
  }
  const mergeCommit = publication.subject?.mergeCommit;
  if (!/^[a-f0-9]{40}$/.test(mergeCommit ?? "")) {
    errors.push("Semantic invariant failure: publication.json subject.mergeCommit must be a full commit SHA");
  }

  const bundleFiles = await getAllFiles(resolvedDir);
  let privacyFindingCount = 0;
  for (const { fullPath, relPath } of bundleFiles) {
    let content;
    try {
      content = await readFile(fullPath, "utf8");
    } catch {
      continue;
    }
    for (const finding of publicPayloadPrivacyFindings(content)) {
      privacyFindingCount += 1;
      errors.push(`Privacy violation: ${relPath} contains ${finding}`);
    }
  }
  if (privacy.status !== "PASS") {
    errors.push(`Semantic invariant failure: privacy-review.json status must be PASS, got ${privacy.status}`);
  }
  if (privacy.secretsPublished !== false) {
    errors.push("Semantic invariant failure: privacy-review.json reports secretsPublished !== false");
  }
  if (privacy.localAbsolutePathsPublished !== false) {
    errors.push("Semantic invariant failure: privacy-review.json reports localAbsolutePathsPublished !== false");
  }
  if (privacy.credentialsOrTokensPublished !== false) {
    errors.push("Semantic invariant failure: privacy-review.json reports credentialsOrTokensPublished !== false");
  }
  const reviewedRedactedPaths = [...(privacy.redactedArtifacts ?? [])].sort(compareCanonicalPaths);
  if (!equalJson(reviewedRedactedPaths, commitmentPaths)) {
    errors.push("Semantic invariant failure: privacy-review.json redactedArtifacts must exactly match private-original commitments");
  }
  if (privacy.independentPublicPayloadScan !== "REQUIRED_AND_ENFORCED") {
    errors.push("Semantic invariant failure: privacy-review.json must require the independent public-payload scan");
  }
  if (privacyFindingCount === 0) metrics.privacyStatus = "PASS";

  const protocolReasons = sortedUniqueStrings(validateProtocol.stale?.reasons ?? []);
  const strictReasonCodes = sortedUniqueStrings((strictAudit.errors ?? []).map(error => error.code));
  const expectedProtocolReasons = ["REPOSITORY_CHANGED"];
  const expectedStrictReasonCodes = sortedUniqueStrings([
    "E_PHASE_ARTIFACT_STALE",
    "E_STATE_REVALIDATION_REQUIRED",
    "E_RECEIPT_PATH_MISMATCH"
  ]);
  if (validateProtocol.status !== "STALE"
      || validateProtocol.stale?.repositoryComparison !== "MISMATCH"
      || !equalJson(protocolReasons, expectedProtocolReasons)) {
    errors.push("Semantic invariant failure: publication-time validate-protocol must be STALE with REPOSITORY_CHANGED and repositoryComparison=MISMATCH");
  }
  if (strictAudit.status !== "STALE" || !equalJson(strictReasonCodes, expectedStrictReasonCodes)) {
    errors.push("Semantic invariant failure: publication-time strict audit status or reason codes do not match the preserved audit");
  }

  if (auditSummary.historicalCompletionState !== "COMPLETE") {
    errors.push(`Semantic invariant failure: audit-summary.json historicalCompletionState must be COMPLETE, got ${auditSummary.historicalCompletionState}`);
  }
  if (auditSummary.historicalCompletionValidation !== "VALID") {
    errors.push(`Semantic invariant failure: audit-summary.json historicalCompletionValidation must be VALID, got ${auditSummary.historicalCompletionValidation}`);
  }
  for (const [field, expected] of Object.entries(expectedReceiptSnapshot)) {
    if (auditSummary.historicalReceiptSnapshot?.[field] !== expected) {
      errors.push(`Semantic invariant failure: audit-summary.json historicalReceiptSnapshot.${field} must be ${expected}`);
    }
  }
  if (auditSummary.historicalReceiptSnapshot?.terminalCompletionProof !== false) {
    errors.push("Semantic invariant failure: audit-summary.json must not treat the historical receipt snapshot as terminal completion proof");
  }
  if (auditSummary.historicalEventLedger?.status !== metrics.eventChainStatus
      || auditSummary.historicalEventLedger?.eventCount !== metrics.eventCount
      || auditSummary.historicalEventLedger?.completionValidatedSeq !== completionEvents[0]?.seq
      || auditSummary.historicalEventLedger?.completionTransactionSeq !== completionTransaction?.seq
      || auditSummary.historicalEventLedger?.finalOperation !== "complete") {
    errors.push("Semantic invariant failure: audit-summary.json historical event-ledger summary does not match verified events");
  }
  if (!equalJson(auditSummary.executionProvenanceCoverage, {
    status: metrics.executionProvenanceCoverage.missing === 0 ? "COMPLETE" : "INCOMPLETE",
    ...metrics.executionProvenanceCoverage
  })) {
    errors.push("Semantic invariant failure: audit-summary.json execution provenance coverage does not match calculated referenced/published/missing counts");
  }
  if (auditSummary.publicationTimeProtocolValidation?.status !== validateProtocol.status
      || auditSummary.publicationTimeProtocolValidation?.repositoryComparison !== validateProtocol.stale?.repositoryComparison
      || !equalJson(sortedUniqueStrings(auditSummary.publicationTimeProtocolValidation?.reasons ?? []), protocolReasons)) {
    errors.push("Semantic invariant failure: audit-summary.json publication-time protocol reasons do not match inspection/validate-protocol.json");
  }
  if (auditSummary.publicationTimeStrictAudit?.status !== strictAudit.status
      || !equalJson(sortedUniqueStrings(auditSummary.publicationTimeStrictAudit?.reasonCodes ?? []), strictReasonCodes)) {
    errors.push("Semantic invariant failure: audit-summary.json strict audit reason codes do not exactly match inspection/audit-strict.json");
  }
  if (auditSummary.privacy?.status !== privacy.status
      || auditSummary.privacy?.independentPublicPayloadScan !== "PASS"
      || auditSummary.productionReadiness !== "NOT_VERIFIED") {
    errors.push("Semantic invariant failure: audit-summary.json privacy or production-readiness status is inconsistent");
  }
  if (auditSummary.protocolValidation === "VALID") {
    errors.push("Semantic invariant failure: audit-summary.json must not claim top-level protocolValidation=VALID");
  }

  const manifestPostReasons = sortedUniqueStrings(manifest.postPublicationAudit?.reasonCodes ?? []);
  const expectedManifestPostReasons = sortedUniqueStrings([...protocolReasons, ...strictReasonCodes]);
  if (manifest.postPublicationAudit?.status !== "STALE"
      || !equalJson(manifestPostReasons, expectedManifestPostReasons)) {
    errors.push("Semantic invariant failure: manifest postPublicationAudit must match protocol and strict-audit findings exactly");
  }

  return metrics;
}

export async function verifyEvidenceDirectory(evidenceDir = DEFAULT_EVIDENCE_DIR) {
  const resolvedDir = path.resolve(evidenceDir);
  const errors = [];
  const warnings = [];
  let maintenanceMetrics = null;

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

  // 4. Validate manifest entries for path safety, canonical separators, and duplicates
  const seenPaths = new Set();
  const manifestFilesMap = new Map();

  for (const entry of manifest.files ?? []) {
    const rawPath = entry.path;
    if (!rawPath) {
      errors.push("Manifest file entry missing 'path'");
      continue;
    }

    if (rawPath.includes("\\")) {
      errors.push(`Non-canonical manifest path separator: ${rawPath}`);
    }

    if (isUnsafeEvidencePath(rawPath)) {
      errors.push(`Path safety violation in manifest: ${rawPath}`);
      continue;
    }

    const relPath = normalizeEvidencePath(rawPath);
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

  // 7. Verify hashes.txt with exact parity, duplicate rejection, and strict set equality
  const hashesTxtPath = path.join(resolvedDir, "hashes.txt");
  const expectedHashPaths = new Set([
    ...manifestFilesMap.keys(),
    "manifest.json"
  ]);

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
      const [, hash, rawFilePath] = match;

      if (rawFilePath.includes("\\")) {
        errors.push(`Non-canonical path separator in hashes.txt: ${rawFilePath}`);
      }

      if (isUnsafeEvidencePath(rawFilePath)) {
        errors.push(`Path safety violation in hashes.txt: ${rawFilePath}`);
        continue;
      }

      const filePath = normalizeEvidencePath(rawFilePath);

      if (hashesMap.has(filePath)) {
        errors.push(`Duplicate path in hashes.txt: ${filePath}`);
        continue;
      }

      hashesMap.set(filePath, hash);
    }

    // 7.1 Check for self-referential entry in hashes.txt
    if (hashesMap.has("hashes.txt")) {
      errors.push("Self-referential hashing violation: hashes.txt contains entry for itself");
    }

    // 7.2 Check for unexpected extra paths in hashes.txt
    for (const filePath of hashesMap.keys()) {
      if (!expectedHashPaths.has(filePath)) {
        errors.push(`Unexpected path in hashes.txt: ${filePath}`);
      }
    }

    // 7.3 Check that all expected hash paths are present in hashes.txt
    for (const expectedPath of expectedHashPaths) {
      if (!hashesMap.has(expectedPath)) {
        errors.push(`Missing path in hashes.txt: ${expectedPath}`);
      }
    }

    // 7.4 Verify cryptographic checksum matches between manifest files and hashes.txt
    for (const [relPath, entry] of manifestFilesMap.entries()) {
      if (hashesMap.has(relPath) && hashesMap.get(relPath) !== entry.sha256) {
        errors.push(`Hash mismatch between manifest and hashes.txt for ${relPath}`);
      }
    }

    // 7.5 Verify manifest.json hash in hashes.txt
    const actualManifestHash = await computeSha256(manifestPath);
    if (hashesMap.has("manifest.json") && hashesMap.get("manifest.json") !== actualManifestHash) {
      errors.push("hashes.txt manifest.json hash does not match actual manifest.json SHA-256");
    }
  } catch (err) {
    errors.push(`Failed to read/verify hashes.txt: ${err.message}`);
  }

  // 8. Assert Semantic Invariants
  try {
    if (manifest.scope === "maintenance-execution-evidence") {
      maintenanceMetrics = await verifyMaintenanceEvidence({
        resolvedDir,
        manifest,
        manifestFilesMap,
        errors
      });
    } else {
      // 8.B Primary PoC Evidence Invariants
      if (manifest.executionCompletion?.status !== "VALID") {
        errors.push(`Semantic invariant failure: manifest.executionCompletion.status must be VALID, got ${manifest.executionCompletion?.status}`);
      }
      if (manifest.postPublicationAudit?.status !== "INVALID") {
        errors.push(`Semantic invariant failure: manifest.postPublicationAudit.status must be INVALID, got ${manifest.postPublicationAudit?.status}`);
      }
      if (!manifest.postPublicationAudit?.reasonCodes?.includes("E_RECEIPT_PATH_MISMATCH")) {
        errors.push("Semantic invariant failure: manifest.postPublicationAudit.reasonCodes must include E_RECEIPT_PATH_MISMATCH");
      }
      if (manifest.productionReadiness?.status !== "NOT_VERIFIED") {
        errors.push(`Semantic invariant failure: manifest.productionReadiness.status must be NOT_VERIFIED, got ${manifest.productionReadiness?.status}`);
      }

      // 8.B.2 validate-protocol.json
      const validateProtocolPath = path.join(resolvedDir, "validate-protocol.json");
      const valProto = JSON.parse(await readFile(validateProtocolPath, "utf8"));
      if (valProto.status !== "VALID") {
        errors.push(`Semantic invariant failure: validate-protocol.json status must be VALID, got ${valProto.status}`);
      }
      if (manifest.executionProtocolValidation?.status !== valProto.status) {
        errors.push(`Semantic invariant failure: manifest.executionProtocolValidation.status (${manifest.executionProtocolValidation?.status}) does not match validate-protocol.json (${valProto.status})`);
      }

      // 8.B.3 audit.json
      const auditPath = path.join(resolvedDir, "audit.json");
      const audit = JSON.parse(await readFile(auditPath, "utf8"));
      if (audit.status !== "INVALID") {
        errors.push(`Semantic invariant failure: audit.json status must be INVALID, got ${audit.status}`);
      }
      const auditErrorCodes = (audit.errors ?? []).map(e => e.code);
      if (!auditErrorCodes.includes("E_RECEIPT_PATH_MISMATCH")) {
        errors.push(`Semantic invariant failure: audit.json must report E_RECEIPT_PATH_MISMATCH, got ${auditErrorCodes.join(", ")}`);
      }
      if (manifest.postPublicationAudit?.status !== audit.status) {
        errors.push(`Semantic invariant failure: manifest.postPublicationAudit.status (${manifest.postPublicationAudit?.status}) does not match audit.json (${audit.status})`);
      }

      // 8.B.4 report.json
      const reportPath = path.join(resolvedDir, "report.json");
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      if (report.status !== "INVALID") {
        errors.push(`Semantic invariant failure: report.json status must be INVALID, got ${report.status}`);
      }

      // 8.B.5 task-state/work-state.json
      const workStatePath = path.join(resolvedDir, "task-state/work-state.json");
      const workState = JSON.parse(await readFile(workStatePath, "utf8"));
      if (workState.phase !== "COMPLETE") {
        errors.push(`Semantic invariant failure: work-state.json phase must be COMPLETE, got ${workState.phase}`);
      }

      // 8.B.6 task-state/events.ndjson
      const eventsPath = path.join(resolvedDir, "task-state/events.ndjson");
      const eventsContent = await readFile(eventsPath, "utf8");
      if (!eventsContent.includes("COMPLETION_VALIDATED")) {
        errors.push("Semantic invariant failure: events.ndjson must contain COMPLETION_VALIDATED event");
      }

      // 8.B.7 completion.json semantic and cross-file assertions
      const completionPath = path.join(resolvedDir, "completion.json");
      const completion = JSON.parse(await readFile(completionPath, "utf8"));
      if (completion.status !== "VALID") {
        errors.push(`Semantic invariant failure: completion.json status must be VALID, got ${completion.status}`);
      }
      if (completion.taskStatus !== "COMPLETE") {
        errors.push(`Semantic invariant failure: completion.json taskStatus must be COMPLETE, got ${completion.taskStatus}`);
      }
      if (completion.verificationStatus !== "VALID") {
        errors.push(`Semantic invariant failure: completion.json verificationStatus must be VALID, got ${completion.verificationStatus}`);
      }
      if (completion.publicationStatus !== "local-only") {
        errors.push(`Semantic invariant failure: completion.json publicationStatus must be local-only, got ${completion.publicationStatus}`);
      }
      if (completion.productionReadiness !== "not-verified") {
        errors.push(`Semantic invariant failure: completion.json productionReadiness must be not-verified, got ${completion.productionReadiness}`);
      }
      if (!Array.isArray(completion.errors) || completion.errors.length !== 0) {
        errors.push(`Semantic invariant failure: completion.json errors must be empty array, got ${JSON.stringify(completion.errors)}`);
      }
      if (completion.status !== manifest.executionCompletion?.status) {
        errors.push(`Semantic invariant failure: completion.json status (${completion.status}) does not match manifest.executionCompletion.status (${manifest.executionCompletion?.status})`);
      }
      if (completion.taskStatus !== workState.phase) {
        errors.push(`Semantic invariant failure: completion.json taskStatus (${completion.taskStatus}) does not match work-state phase (${workState.phase})`);
      }

      // 8.B.8 publication.json and productionReadiness cross-check
      const publicationPath = path.join(resolvedDir, "publication.json");
      const publication = JSON.parse(await readFile(publicationPath, "utf8"));
      if (publication.productionReadiness !== "not-verified") {
        errors.push(`Semantic invariant failure: publication.json productionReadiness must be not-verified, got ${publication.productionReadiness}`);
      }
      if (publication.productionReadiness !== completion.productionReadiness) {
        errors.push(`Semantic invariant failure: publication.json productionReadiness (${publication.productionReadiness}) does not match completion.json (${completion.productionReadiness})`);
      }

      const expectedManifestProductionReadiness =
        completion.productionReadiness === "not-verified"
          ? "NOT_VERIFIED"
          : null;

      if (
        expectedManifestProductionReadiness === null ||
        manifest.productionReadiness?.status !== expectedManifestProductionReadiness
      ) {
        errors.push(
          "Semantic invariant failure: production readiness disagrees across manifest.json, completion.json, and publication.json"
        );
      }
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
      eventChainStatus: maintenanceMetrics?.eventChainStatus ?? "unknown",
      eventCount: maintenanceMetrics?.eventCount ?? null,
      executionProvenanceCoverage: maintenanceMetrics?.executionProvenanceCoverage ?? null,
      privacyStatus: maintenanceMetrics?.privacyStatus ?? "unknown",
      publicationPackageIntegrity: errors.length === 0 ? "VALID" : "INVALID"
    }
  };
}

// CLI entrypoint execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const targetDirs = process.argv[2]
    ? [path.resolve(process.argv[2])]
    : [DEFAULT_EVIDENCE_DIR, MAINTENANCE_EVIDENCE_DIR];
  
  async function runAll() {
    let allValid = true;
    for (const targetDir of targetDirs) {
      const result = await verifyEvidenceDirectory(targetDir);
      if (result.valid) {
        console.log(`ForgeLoop PoC evidence [${path.basename(targetDir)}]: VALID`);
        console.log(`  run: ${result.summary.runId}`);
        console.log(`  task: ${result.summary.taskId}`);
        console.log(`  files: ${result.summary.totalVerifiedFiles}`);
        console.log(`  execution completion: ${result.summary.executionCompletionStatus}`);
        console.log(`  post-publication drift detection: ${result.summary.postPublicationAuditStatus} (expected and documented)`);
        console.log(`  publication package integrity: ${result.summary.publicationPackageIntegrity}`);
      } else {
        allValid = false;
        console.error(`ForgeLoop PoC evidence [${path.basename(targetDir)}] verification FAILED:`);
        for (const err of result.errors) {
          console.error(`  ✖ ${err}`);
        }
      }
    }
    process.exit(allValid ? 0 : 1);
  }

  runAll().catch((err) => {
    console.error("Unexpected error in verifier:", err);
    process.exit(1);
  });
}
