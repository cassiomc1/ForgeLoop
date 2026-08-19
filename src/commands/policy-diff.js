import { readFile } from "node:fs/promises";
import path from "node:path";
import { diffPolicies } from "../core/policy-diff.js";
import {
  loadEffectiveRules,
  readBaseline,
  readTaskPolicySnapshot,
} from "../core/policy-engine.js";

export async function runPolicyDiff({
  target = process.cwd(),
  packageRoot,
  taskId = null,
  before = null,
  after = null,
} = {}) {
  let beforePolicy;
  let afterPolicy;

  if (before) {
    const rawBefore = await readFile(path.resolve(target, before), "utf8");
    beforePolicy = JSON.parse(rawBefore);
  } else if (taskId) {
    const snapshot = await readTaskPolicySnapshot(target, taskId, packageRoot);
    beforePolicy = snapshot ? { rules: snapshot.rules, baseline: { entries: [] } } : { rules: [], baseline: { entries: [] } };
  } else {
    beforePolicy = { rules: [], baseline: { entries: [] } };
  }

  if (after) {
    const rawAfter = await readFile(path.resolve(target, after), "utf8");
    afterPolicy = JSON.parse(rawAfter);
  } else {
    const rules = await loadEffectiveRules(target, packageRoot);
    const baseline = await readBaseline(target, packageRoot);
    afterPolicy = { rules, baseline };
  }

  return diffPolicies(beforePolicy, afterPolicy);
}

export function formatPolicyDiffResult(result) {
  const lines = [
    `FORGELOOP POLICY DIFF: ${result.classification}`,
    `Changes: ${result.changes?.length ?? 0}`,
  ];
  for (const c of result.changes ?? []) {
    lines.push(`  - [${c.type}] ${c.path}: ${c.description}`);
  }
  return `${lines.join("\n")}\n`;
}
