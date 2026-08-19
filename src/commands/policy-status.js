import { evaluateTargetPolicy } from "../core/policy-engine.js";

export async function runPolicyStatus({ target = process.cwd(), packageRoot, taskId = null } = {}) {
  return evaluateTargetPolicy({ target, packageRoot, taskId });
}

export function formatPolicyStatusResult(result) {
  const lines = [
    `FORGELOOP POLICY STATUS: ${result.status}`,
    `Lock: ${result.lock?.digest ?? "none"}`,
    `Rules: ${result.rules?.length ?? 0} total (Proven: ${result.provenRules}, Inert: ${result.inertRules}, Unsupported: ${result.unsupportedRules})`,
    `Baseline Violations: ${result.baselineViolations}`,
    `New Violations: ${result.newViolations?.length ?? 0}`,
    `Drift: ${result.drift?.detected ? `DETECTED (${result.drift.classification})` : "none"}`,
  ];

  if (result.errors?.length > 0) {
    lines.push("Errors:");
    for (const err of result.errors) {
      lines.push(`  - ${err.code}: ${err.why || err.message || err.ruleId}`);
      if (err.fix) lines.push(`    Fix: ${err.fix}`);
    }
  }

  if (result.warnings?.length > 0) {
    lines.push("Warnings:");
    for (const warn of result.warnings) {
      lines.push(`  - ${warn.code}: ${warn.message || warn.why}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
