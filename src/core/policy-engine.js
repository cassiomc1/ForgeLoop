import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./filesystem.js";
import { PROJECT_ARTIFACT_PATHS, taskArtifactPath } from "./task-paths.js";
import { assertJsonLimits } from "./json-safety.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { canonicalFingerprint, writeJsonArtifact } from "./artifacts.js";
import { sha256 } from "./manifest.js";
import { BUILTIN_POLICY_RULES, discoverPolicy } from "./policy-discovery.js";
import { getPolicyAdapter } from "./policy-adapters.js";
import { evaluateBaselineViolations, readBaseline, writeBaseline } from "./policy-baseline.js";
import { verifyRuleMutation } from "./policy-mutation.js";
import { diffPolicies } from "./policy-diff.js";

export { readBaseline, writeBaseline, evaluateBaselineViolations };

export async function readProjectRules(target, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyRules;
  const fullPath = path.join(target, relPath);
  if (!(await fileExists(fullPath))) {
    return null;
  }
  const raw = await readFile(fullPath, "utf8");
  assertJsonLimits(raw, relPath);
  const parsed = JSON.parse(raw);
  const schema = await readSchema("policy-rules", packageRoot);
  assertSchema(parsed, schema, "policy-rules");
  return parsed.rules ?? [];
}

export async function writeProjectRules(target, rules, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyRules;
  const payload = { schemaVersion: 1, rules };
  const schema = await readSchema("policy-rules", packageRoot);
  assertSchema(payload, schema, "policy-rules");
  await writeJsonArtifact(target, relPath, payload, "policy-rules", packageRoot);
  return payload;
}

export async function readDiscoveryReport(target, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyDiscovery;
  const fullPath = path.join(target, relPath);
  if (!(await fileExists(fullPath))) {
    return null;
  }
  const raw = await readFile(fullPath, "utf8");
  assertJsonLimits(raw, relPath);
  const parsed = JSON.parse(raw);
  const schema = await readSchema("policy-discovery", packageRoot);
  assertSchema(parsed, schema, "policy-discovery");
  return parsed;
}

export async function writeDiscoveryReport(target, discovery, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyDiscovery;
  const schema = await readSchema("policy-discovery", packageRoot);
  assertSchema(discovery, schema, "policy-discovery");
  await writeJsonArtifact(target, relPath, discovery, "policy-discovery", packageRoot);
  return discovery;
}

export async function readPolicyLock(target, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyLock;
  const fullPath = path.join(target, relPath);
  if (!(await fileExists(fullPath))) {
    return null;
  }
  const raw = await readFile(fullPath, "utf8");
  assertJsonLimits(raw, relPath);
  const parsed = JSON.parse(raw);
  const schema = await readSchema("policy-lock", packageRoot);
  assertSchema(parsed, schema, "policy-lock");
  return parsed;
}

export async function writePolicyLock(target, lock, packageRoot) {
  const relPath = PROJECT_ARTIFACT_PATHS.policyLock;
  const schema = await readSchema("policy-lock", packageRoot);
  assertSchema(lock, schema, "policy-lock");
  await writeJsonArtifact(target, relPath, lock, "policy-lock", packageRoot);
  return lock;
}

export async function readTaskPolicySnapshot(target, taskId, packageRoot) {
  const relPath = taskArtifactPath(taskId, "policySnapshot");
  const fullPath = path.join(target, relPath);
  if (!(await fileExists(fullPath))) {
    return null;
  }
  const raw = await readFile(fullPath, "utf8");
  assertJsonLimits(raw, relPath);
  const parsed = JSON.parse(raw);
  const schema = await readSchema("policy-snapshot", packageRoot);
  assertSchema(parsed, schema, "policy-snapshot");
  return parsed;
}

export async function writeTaskPolicySnapshot(target, taskId, snapshot, packageRoot) {
  const relPath = taskArtifactPath(taskId, "policySnapshot");
  const schema = await readSchema("policy-snapshot", packageRoot);
  assertSchema(snapshot, schema, "policy-snapshot");
  await writeJsonArtifact(target, relPath, snapshot, "policy-snapshot", packageRoot);
  return snapshot;
}

export async function loadEffectiveRules(target, packageRoot) {
  const ruleMap = new Map();

  // 1. Built-in rules
  for (const rule of BUILTIN_POLICY_RULES) {
    ruleMap.set(rule.id, { ...rule });
  }

  // 2. Discovered rules
  let discovery = await readDiscoveryReport(target, packageRoot);
  if (!discovery) {
    discovery = await discoverPolicy({ target });
  }
  for (const rule of discovery.discoveredRules ?? []) {
    ruleMap.set(rule.id, { ...rule });
  }

  // 3. Project rules (highest precedence)
  const projectRules = await readProjectRules(target, packageRoot);
  if (projectRules) {
    for (const rule of projectRules) {
      ruleMap.set(rule.id, { ...rule, source: "project" });
    }
  }

  return [...ruleMap.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function detectPolicyCapability(target, packageRoot) {
  const rulesRel = PROJECT_ARTIFACT_PATHS.policyRules;
  const baselineRel = PROJECT_ARTIFACT_PATHS.policyBaseline;
  const discoveryRel = PROJECT_ARTIFACT_PATHS.policyDiscovery;
  const lockRel = PROJECT_ARTIFACT_PATHS.policyLock;

  const hasRules = await fileExists(path.join(target, rulesRel));
  const hasBaseline = await fileExists(path.join(target, baselineRel));
  const hasDiscovery = await fileExists(path.join(target, discoveryRel));
  const hasLock = await fileExists(path.join(target, lockRel));

  if (!hasRules && !hasBaseline && !hasDiscovery && !hasLock) {
    return "NOT_PRESENT";
  }

  try {
    if (hasRules) await readProjectRules(target, packageRoot);
    if (hasBaseline) await readBaseline(target, packageRoot);
    if (hasDiscovery) await readDiscoveryReport(target, packageRoot);
    if (hasLock) await readPolicyLock(target, packageRoot);
    return "AVAILABLE";
  } catch {
    return "INVALID";
  }
}

export function canonicalizeRules(rules) {
  const seenIds = new Set();
  const sorted = [...(rules ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  for (const r of sorted) {
    if (seenIds.has(r.id)) {
      throw new Error(`Duplicate rule ID detected: ${r.id}`);
    }
    seenIds.add(r.id);
  }
  return sorted;
}

export function canonicalizeBaseline(baseline) {
  if (!baseline || !Array.isArray(baseline.entries)) {
    return { schemaVersion: 1, entries: [] };
  }
  const entries = baseline.entries.map((entry) => {
    const fps = entry.fingerprints ?? [];
    if (new Set(fps).size !== fps.length) {
      throw new Error(`Duplicate fingerprint detected for rule ${entry.ruleId}`);
    }
    return {
      ruleId: entry.ruleId,
      fingerprints: [...fps].sort(),
      ...(entry.reviewBy ? { reviewBy: entry.reviewBy } : {}),
    };
  });
  return {
    schemaVersion: baseline.schemaVersion ?? 1,
    entries: entries.sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
  };
}

export function computePolicyLockData(rules, baseline) {
  const canonicalRules = canonicalizeRules(rules);
  const canonicalBase = canonicalizeBaseline(baseline);
  const rulesDigest = sha256(canonicalFingerprint(canonicalRules));
  const baselineDigest = sha256(canonicalFingerprint(canonicalBase));
  const fullDigest = sha256(`${rulesDigest}:${baselineDigest}`);

  return {
    schemaVersion: 1,
    algorithm: "sha256",
    digest: `sha256:${fullDigest}`,
    rulesDigest: `sha256:${rulesDigest}`,
    baselineDigest: `sha256:${baselineDigest}`,
    capturedAt: new Date().toISOString(),
  };
}

export async function verifyPolicyLock(target, packageRoot) {
  const capability = await detectPolicyCapability(target, packageRoot);
  if (capability === "NOT_PRESENT") {
    return { status: "NOT_APPLICABLE" };
  }
  if (capability === "INVALID") {
    return { status: "INVALID", error: "Policy artifacts are malformed" };
  }

  const persistedLock = await readPolicyLock(target, packageRoot);
  if (!persistedLock) {
    return { status: "MISMATCH", error: "Policy lockfile is missing" };
  }

  const rules = await loadEffectiveRules(target, packageRoot);
  const baseline = await readBaseline(target, packageRoot);
  const expectedLock = computePolicyLockData(rules, baseline);

  if (persistedLock.digest !== expectedLock.digest) {
    return {
      status: "MISMATCH",
      expected: expectedLock.digest,
      observed: persistedLock.digest,
    };
  }

  return {
    status: "VALID",
    digest: expectedLock.digest,
  };
}

export async function evaluateTargetPolicy({
  target = process.cwd(),
  packageRoot,
  taskId = null,
  files = null,
  now = new Date().toISOString(),
} = {}) {
  const capability = await detectPolicyCapability(target, packageRoot);
  if (capability === "NOT_PRESENT") {
    return {
      status: "VALID",
      capability: "NOT_PRESENT",
      rules: [],
      provenRules: 0,
      inertRules: 0,
      unsupportedRules: 0,
      baselineViolations: 0,
      newViolations: [],
      resolvedViolations: [],
      ratchetedBaseline: null,
      lock: { status: "NOT_APPLICABLE" },
      drift: { detected: false },
      errors: [],
      warnings: [],
    };
  }

  if (capability === "INVALID") {
    return {
      status: "INVALID",
      capability: "INVALID",
      rules: [],
      provenRules: 0,
      inertRules: 0,
      unsupportedRules: 0,
      baselineViolations: 0,
      newViolations: [],
      resolvedViolations: [],
      ratchetedBaseline: null,
      lock: { status: "INVALID" },
      drift: { detected: false },
      errors: [
        {
          code: "E_POLICY_INVALID",
          why: "Policy configuration or baseline artifacts are malformed or fail schema validation.",
          fix: "Validate and repair rules.json, baseline.json, or discovery.json against schemas.",
        },
      ],
      warnings: [],
    };
  }

  const rules = await loadEffectiveRules(target, packageRoot);
  const baseline = await readBaseline(target, packageRoot);
  const errors = [];
  const warnings = [];
  const evaluatedRules = [];
  const rawViolations = [];

  // Active lock verification
  const lockVerification = await verifyPolicyLock(target, packageRoot);
  if (lockVerification.status === "MISMATCH") {
    errors.push({
      code: "POLICY_LOCK_MISMATCH",
      why: `Persisted policy lock does not match current effective policy: expected ${lockVerification.expected}, observed ${lockVerification.observed}`,
      fix: "Re-evaluate effective rules and update policy.lock or restore modified rules.",
    });
  }

  for (const rule of rules) {
    const adapterId = rule.check?.adapter ?? (typeof rule.check === "string" ? rule.check : null);
    const adapter = getPolicyAdapter(adapterId);

    if (!adapter) {
      evaluatedRules.push({
        ruleId: rule.id,
        rule,
        status: "UNSUPPORTED",
        why: `No policy adapter found for ${adapterId}`,
        fix: "Configure an existing adapter or remove the rule.",
      });
      continue;
    }

    let checkResult;
    try {
      checkResult = await adapter.check({ target, rule, files });
    } catch (error) {
      errors.push({
        code: "POLICY_EVALUATION_FAILED",
        ruleId: rule.id,
        why: `Policy evaluation threw an unexpected error for rule ${rule.id}: ${error.message}`,
        fix: "Inspect adapter check logic and target files for unhandled exceptions.",
      });
      checkResult = { passed: false, isInert: false, violations: [], error: error.message };
    }

    // Handle inert checks
    if (checkResult.isInert) {
      if (rule.source === "discovered") {
        // Gracefully downgrade discovered rules
        evaluatedRules.push({
          ruleId: rule.id,
          rule,
          status: "UNSUPPORTED",
          isInert: true,
          why: "Discovered rule is currently inert (no applicable files in repository).",
          fix: "Rule will automatically activate when matching files are present.",
        });
        continue;
      } else if (rule.source === "project" && rule.blocking) {
        errors.push({
          code: "CHECK_INERT",
          ruleId: rule.id,
          why: `Configured blocking check ${rule.id} has no effective target scope.`,
          fix: "Provide an applicable target scope or mark rule non-blocking.",
        });
        evaluatedRules.push({
          ruleId: rule.id,
          rule,
          status: "INERT",
          isInert: true,
          errorCode: "CHECK_INERT",
          why: `Configured blocking check ${rule.id} has no effective target scope.`,
          fix: "Provide an applicable target scope or mark rule non-blocking.",
        });
        continue;
      } else {
        evaluatedRules.push({
          ruleId: rule.id,
          rule,
          status: "INERT",
          isInert: true,
          why: "Check is enabled but has no effective target.",
          fix: "Configure an applicable scope or mark the rule as unsupported.",
        });
        continue;
      }
    }

    // Verify mutation for blocking rules
    let mutationProof = null;
    if (rule.blocking) {
      mutationProof = await verifyRuleMutation({ target, rule, adapter });
      if (mutationProof.status !== "PROVEN") {
        if (mutationProof.errorCode === "CHECK_MUTATION_EXECUTION_ERROR") {
          errors.push({
            code: "CHECK_MUTATION_EXECUTION_ERROR",
            ruleId: rule.id,
            why: mutationProof.why,
            fix: mutationProof.fix,
          });
        } else {
          errors.push({
            code: "CHECK_MUTATION_NOT_DETECTED",
            ruleId: rule.id,
            why: mutationProof.why,
            fix: mutationProof.fix,
          });
        }
      }
    }

    if (checkResult.violations && checkResult.violations.length > 0) {
      rawViolations.push(...checkResult.violations);
    }

    evaluatedRules.push({
      ruleId: rule.id,
      rule,
      status: rule.blocking
        ? mutationProof?.status === "PROVEN" ? "PROVEN" : "UNPROVEN"
        : "ACTIVE",
      mutationProof,
      violations: checkResult.violations ?? [],
    });
  }

  // Baseline evaluation
  const baselineEval = evaluateBaselineViolations(baseline, rawViolations, { now });
  warnings.push(...baselineEval.warnings);

  for (const newViolation of baselineEval.newViolations) {
    const matchingRule = rules.find((r) => r.id === newViolation.ruleId);
    if (matchingRule?.blocking) {
      errors.push({
        code: "NEW_VIOLATION",
        ruleId: newViolation.ruleId,
        file: newViolation.file,
        line: newViolation.line,
        fingerprint: newViolation.fingerprint,
        why: `New policy violation detected not present in baseline: ${newViolation.message}`,
        fix: matchingRule.fix || "Resolve the violation before completing the task.",
      });
    } else {
      warnings.push({
        code: "NEW_ADVISORY_VIOLATION",
        ruleId: newViolation.ruleId,
        file: newViolation.file,
        message: newViolation.message,
      });
    }
  }

  // Drift evaluation against task policy snapshot
  let drift = null;
  if (taskId) {
    const taskSnapshot = await readTaskPolicySnapshot(target, taskId, packageRoot);
    if (taskSnapshot) {
      const currentLock = computePolicyLockData(rules, baseline);
      if (taskSnapshot.policyDigest !== currentLock.digest) {
        const policyDiff = diffPolicies(
          { rules: taskSnapshot.rules, baseline: taskSnapshot.baseline, baselineDigest: taskSnapshot.baselineDigest },
          { rules, baseline, baselineDigest: currentLock.baselineDigest },
        );
        drift = {
          detected: true,
          classification: policyDiff.classification,
          snapshotDigest: taskSnapshot.policyDigest,
          currentDigest: currentLock.digest,
          changes: policyDiff.changes,
        };

        if (policyDiff.classification === "WEAKEN") {
          errors.push({
            code: "POLICY_WEAKENING",
            why: "Policy weakening detected relative to task activation snapshot.",
            fix: "Restore the original policy rules or obtain explicit project authority.",
          });
        } else if (policyDiff.classification === "UNKNOWN") {
          errors.push({
            code: "POLICY_DRIFT_UNKNOWN",
            why: "Policy drift detected against task snapshot but baseline state cannot be semantically compared.",
            fix: "Re-verify the task under the current policy state.",
          });
        } else if (policyDiff.classification === "TIGHTEN") {
          warnings.push({
            code: "POLICY_TIGHTENING",
            why: "Policy tightened after task activation. Re-verification required.",
            fix: "Re-run verification checks under the tightened policy.",
          });
        }
      }
    }
  }

  const currentLock = computePolicyLockData(rules, baseline);

  return {
    status: errors.length === 0 ? "VALID" : "INVALID",
    rules: evaluatedRules,
    provenRules: evaluatedRules.filter((r) => r.status === "PROVEN").length,
    inertRules: evaluatedRules.filter((r) => r.status === "INERT").length,
    unsupportedRules: evaluatedRules.filter((r) => r.status === "UNSUPPORTED").length,
    baselineViolations: baselineEval.baselinedViolations.length,
    newViolations: baselineEval.newViolations,
    resolvedViolations: baselineEval.resolvedViolations,
    ratchetedBaseline: baselineEval.ratchetedBaseline,
    lock: currentLock,
    drift: drift ?? { detected: false },
    errors,
    warnings,
  };
}
