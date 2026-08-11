import { createConfig, writeConfig } from "../core/config.js";
import { getPolicy, validatePolicy } from "../core/policies.js";

export async function runPolicy({ target, packageRoot, name }) {
  const policy = getPolicy(name);
  await validatePolicy(policy, packageRoot);
  const config = createConfig({
    complianceMode: policy.complianceMode,
    policy: policy.name,
    requiredGates: policy.requiredGates,
    requiredEvidence: policy.requiredEvidence,
  });
  await writeConfig(target, config, packageRoot);
  return { policy, config };
}

export function formatPolicyResult(result) {
  return `policy: ${result.policy.name}\nmode: ${result.policy.complianceMode}\n`;
}
