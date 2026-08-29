import { setResponsibilityContract } from "../core/responsibility.js";

export async function runResponsibilitySet(options = {}) {
  return setResponsibilityContract(options.target, {
    ...options,
    allowedPaths: options.responsibilityAllowedPaths?.length ? options.responsibilityAllowedPaths : undefined,
    readOnlyPaths: options.responsibilityReadOnlyPaths?.length ? options.responsibilityReadOnlyPaths : undefined,
    requiredCheckIds: options.responsibilityRequiredChecks?.length ? options.responsibilityRequiredChecks : undefined,
    label: options.responsibilityLabel,
    frozenInputs: {
      contract: options.responsibilityFreezeContract,
      route: options.responsibilityFreezeRoute,
      claims: options.responsibilityFreezeClaims,
    },
  });
}

export function formatResponsibilitySetResult(result) {
  return `FORGELOOP RESPONSIBILITY SET\ntask: ${result.taskId}\nlabel: ${result.responsibility.label}\nfingerprint: ${result.fingerprint}\npath: ${result.path}\n\n`;
}
