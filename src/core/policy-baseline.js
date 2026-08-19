import { readFile } from "node:fs/promises";
import { fileExists } from "./filesystem.js";
import { PROJECT_ARTIFACT_PATHS } from "./task-paths.js";
import { assertJsonLimits } from "./json-safety.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { writeJsonArtifact } from "./artifacts.js";
import { sha256 } from "./manifest.js";

export function computeViolationFingerprint(violation) {
  if (violation.fingerprint) {
    return violation.fingerprint.startsWith("sha256:") ? violation.fingerprint : `sha256:${violation.fingerprint}`;
  }
  const raw = `${violation.ruleId}:${violation.file || ""}:${violation.line || ""}:${violation.snippet || violation.message || ""}`;
  return `sha256:${sha256(raw)}`;
}

export async function readBaseline(target, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyBaseline;
  const fullPath = `${target}/${relPath}`;
  if (!(await fileExists(fullPath))) {
    return null;
  }
  const raw = await readFile(fullPath, "utf8");
  assertJsonLimits(raw, relPath);
  const parsed = JSON.parse(raw);
  const schema = await readSchema("policy-baseline", packageRoot);
  assertSchema(parsed, schema, "policy-baseline");
  return parsed;
}

export async function writeBaseline(target, baseline, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyBaseline;
  const schema = await readSchema("policy-baseline", packageRoot);
  assertSchema(baseline, schema, "policy-baseline");
  await writeJsonArtifact(target, relPath, baseline, "policy-baseline", packageRoot);
  return baseline;
}

export function createBaselineFromViolations(violations, { createdAt = new Date().toISOString() } = {}) {
  const ruleGroups = new Map();
  for (const v of violations) {
    const ruleId = v.ruleId;
    if (!ruleGroups.has(ruleId)) {
      ruleGroups.set(ruleId, []);
    }
    const fp = computeViolationFingerprint(v);
    ruleGroups.get(ruleId).push(fp);
  }

  const entries = [];
  for (const [ruleId, fingerprints] of ruleGroups.entries()) {
    entries.push({
      ruleId,
      fingerprints: [...new Set(fingerprints)].sort(),
    });
  }

  return {
    schemaVersion: 1,
    createdAt,
    entries: entries.sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
  };
}

export function evaluateBaselineViolations(baseline, currentViolations, { now = new Date().toISOString() } = {}) {
  if (!baseline || !baseline.entries) {
    return {
      newViolations: currentViolations,
      baselinedViolations: [],
      resolvedViolations: [],
      ratchetedBaseline: null,
      warnings: [],
    };
  }

  const baselineMap = new Map();
  for (const entry of baseline.entries) {
    baselineMap.set(entry.ruleId, new Set(entry.fingerprints));
  }

  const newViolations = [];
  const baselinedViolations = [];
  const matchedFingerprintsPerRule = new Map();

  for (const v of currentViolations) {
    const fp = computeViolationFingerprint(v);
    const existing = baselineMap.get(v.ruleId);
    if (existing && existing.has(fp)) {
      baselinedViolations.push(v);
      if (!matchedFingerprintsPerRule.has(v.ruleId)) {
        matchedFingerprintsPerRule.set(v.ruleId, new Set());
      }
      matchedFingerprintsPerRule.get(v.ruleId).add(fp);
    } else {
      newViolations.push(v);
    }
  }

  // Determine resolved debt and ratcheted baseline
  const resolvedViolations = [];
  const ratchetedEntries = [];
  const warnings = [];

  for (const entry of baseline.entries) {
    const matched = matchedFingerprintsPerRule.get(entry.ruleId) ?? new Set();
    const remaining = entry.fingerprints.filter((fp) => matched.has(fp));
    const resolved = entry.fingerprints.filter((fp) => !matched.has(fp));

    for (const r of resolved) {
      resolvedViolations.push({ ruleId: entry.ruleId, fingerprint: r });
    }

    if (entry.reviewBy && entry.reviewBy <= now.slice(0, 10)) {
      warnings.push({
        code: "BASELINE_REVIEW_DUE",
        ruleId: entry.ruleId,
        reviewBy: entry.reviewBy,
        message: `Baseline review date ${entry.reviewBy} for rule ${entry.ruleId} has expired.`,
      });
    }

    if (remaining.length > 0) {
      ratchetedEntries.push({
        ruleId: entry.ruleId,
        fingerprints: remaining.sort(),
        ...(entry.reviewBy ? { reviewBy: entry.reviewBy } : {}),
      });
    }
  }

  const ratchetedBaseline = {
    schemaVersion: baseline.schemaVersion ?? 1,
    createdAt: baseline.createdAt,
    entries: ratchetedEntries.sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
  };

  return {
    newViolations,
    baselinedViolations,
    resolvedViolations,
    ratchetedBaseline,
    warnings,
  };
}
