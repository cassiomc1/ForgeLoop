import { discoverPolicy } from "../core/policy-discovery.js";
import {
  computePolicyLockData,
  readBaseline,
  writeDiscoveryReport,
  writePolicyLock,
} from "../core/policy-engine.js";

export async function runPolicyDiscover({ target = process.cwd(), packageRoot, write = false } = {}) {
  const discovery = await discoverPolicy({ target });
  let lock = null;

  if (write) {
    await writeDiscoveryReport(target, discovery, packageRoot);
    const baseline = await readBaseline(target, packageRoot);
    lock = computePolicyLockData(discovery.discoveredRules, baseline);
    await writePolicyLock(target, lock, packageRoot);
  }

  return {
    ...discovery,
    written: Boolean(write),
    lock: lock?.digest ?? null,
  };
}

export function formatPolicyDiscoverResult(result) {
  const lines = [
    "FORGELOOP POLICY DISCOVERY:",
    `Languages: ${result.languages?.join(", ") || "none detected"}`,
    `Testing: ${result.testing?.detected ? `detected (${result.testing.framework || result.testing.command?.join(" ")}) [${result.testing.confidence}]` : "none"}`,
    `Linting: ${result.linting?.detected ? `detected (${result.linting.tool || result.linting.command?.join(" ")}) [${result.linting.confidence}]` : "none"}`,
    `Architecture: ${result.architecture?.value ? `${result.architecture.value} [${result.architecture.confidence}]` : "none [UNKNOWN]"}`,
    `Discovered Rules: ${result.discoveredRules?.length ?? 0}`,
  ];
  for (const rule of result.discoveredRules ?? []) {
    lines.push(`  - ${rule.id} (${rule.severity}${rule.blocking ? ", BLOCKING" : ", ADVISORY"}): ${rule.why}`);
  }
  return `${lines.join("\n")}\n`;
}
