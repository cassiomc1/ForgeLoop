import { loadEffectiveRules } from "../core/policy-engine.js";
import { verifyRuleMutation } from "../core/policy-mutation.js";

export async function runRuleVerify({
  target = process.cwd(),
  packageRoot,
  rule = null,
} = {}) {
  const rules = await loadEffectiveRules(target, packageRoot);
  const targetRules = rule ? rules.filter((r) => r.id === rule) : rules;

  const verifications = [];
  for (const r of targetRules) {
    const res = await verifyRuleMutation({ target, rule: r });
    verifications.push(res);
  }

  const allProven = verifications.every((v) => v.status === "PROVEN" || v.status === "UNSUPPORTED");

  return {
    status: allProven ? "VALID" : "UNPROVEN",
    verifications,
  };
}

export function formatRuleVerifyResult(result) {
  const lines = [
    `FORGELOOP RULE VERIFICATION: ${result.status}`,
  ];
  for (const v of result.verifications ?? []) {
    lines.push(`  - ${v.ruleId}: ${v.status} (Mutation: ${v.mutation ?? "none"}, Expected: ${v.expected ?? "n/a"}, Observed: ${v.observed ?? "n/a"})`);
    if (v.why) lines.push(`    Why: ${v.why}`);
    if (v.fix && v.status !== "PROVEN") lines.push(`    Fix: ${v.fix}`);
  }
  return `${lines.join("\n")}\n`;
}
