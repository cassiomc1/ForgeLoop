import {
  computePolicyLockData,
  evaluateTargetPolicy,
  loadEffectiveRules,
  writePolicyLock,
} from "../core/policy-engine.js";
import {
  createBaselineFromViolations,
  readBaseline,
  writeBaseline,
} from "../core/policy-baseline.js";

export async function runBaseline({
  target = process.cwd(),
  packageRoot,
  record = false,
  update = false,
} = {}) {
  const policyEval = await evaluateTargetPolicy({ target, packageRoot });
  let baseline = await readBaseline(target, packageRoot);

  if (record) {
    const allViolations = [];
    for (const r of policyEval.rules) {
      if (r.violations) allViolations.push(...r.violations);
    }
    baseline = createBaselineFromViolations(allViolations);
    await writeBaseline(target, baseline, packageRoot);

    const rules = await loadEffectiveRules(target, packageRoot);
    const lock = computePolicyLockData(rules, baseline);
    await writePolicyLock(target, lock, packageRoot);

    return {
      status: "RECORDED",
      baseline,
      violationCount: allViolations.length,
      lock: lock.digest,
    };
  }

  if (update && policyEval.ratchetedBaseline) {
    baseline = policyEval.ratchetedBaseline;
    await writeBaseline(target, baseline, packageRoot);

    const rules = await loadEffectiveRules(target, packageRoot);
    const lock = computePolicyLockData(rules, baseline);
    await writePolicyLock(target, lock, packageRoot);

    return {
      status: "UPDATED",
      baseline,
      resolvedCount: policyEval.resolvedViolations?.length ?? 0,
      remainingCount: baseline.entries.reduce((sum, e) => sum + e.fingerprints.length, 0),
      lock: lock.digest,
    };
  }

  return {
    status: baseline ? "VALID" : "NOT_PRESENT",
    baseline,
    baselinedViolations: policyEval.baselineViolations,
    newViolations: policyEval.newViolations?.length ?? 0,
    resolvedViolations: policyEval.resolvedViolations?.length ?? 0,
  };
}

export function formatBaselineResult(result) {
  const lines = [
    `FORGELOOP POLICY BASELINE: ${result.status}`,
    `Baselined Debt: ${result.baselinedViolations ?? (result.baseline?.entries?.reduce((sum, e) => sum + e.fingerprints.length, 0) ?? 0)}`,
    `New Violations: ${result.newViolations ?? 0}`,
    `Resolved Debt: ${result.resolvedViolations ?? result.resolvedCount ?? 0}`,
  ];
  if (result.lock) {
    lines.push(`Lock: ${result.lock}`);
  }
  return `${lines.join("\n")}\n`;
}
