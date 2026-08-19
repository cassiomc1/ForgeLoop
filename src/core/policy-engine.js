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

export function computePolicyLockData(rules, baseline) {
  const canonicalRules = [...(rules ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const rulesDigest = sha256(canonicalFingerprint(canonicalRules));
  const baselineDigest = sha256(canonicalFingerprint(baseline ?? {}));
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

export async function evaluateTargetPolicy({
  target = process.cwd(),
  packageRoot,
  taskId = null,
  files = null,
  now = new Date().toISOString(),
} = {}) {
  const rules = await loadEffectiveRules(target, packageRoot);
  const baseline = await readBaseline(target, packageRoot);
  const errors = [];
  const warnings = [];
  const evaluatedRules = [];
  const rawViolations = [];

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
        errors.push({
          code: "CHECK_MUTATION_NOT_DETECTED",
          ruleId: rule.id,
          why: mutationProof.why,
          fix: mutationProof.fix,
        });
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
          { rules: taskSnapshot.rules, baseline: { entries: [] } },
          { rules, baseline },
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
