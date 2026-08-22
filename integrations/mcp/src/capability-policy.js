import { INTEGRATION_RISK_CLASSES } from "@cassiomc1/forgeloop/integration";

export const SERVER_MODES = Object.freeze({
  READONLY: "readonly",
  SAFE: "safe",
  FULL: "full",
});

/**
 * Launch policy is process-scoped and immutable. Tool input can never
 * upgrade it. `acknowledgeRecovery` in tool input only satisfies the
 * canonical ForgeLoop command acknowledgement after the server was started
 * with recovery capability; it is never an authorization grant.
 */
export function resolveLaunchPolicy({
  mode = SERVER_MODES.SAFE,
  allowExternalExecution = false,
  allowMaintenance = false,
  allowRecovery = false,
  allowLegacyRepair = false,
  allowForceRecovery = false,
  maxExecutionTimeMs = 600000,
} = {}) {
  if (!Object.values(SERVER_MODES).includes(mode)) {
    throw new Error(`Unknown ForgeLoop MCP mode: ${mode}`);
  }
  for (const [flag, value] of [
    ["--allow-external-execution", allowExternalExecution],
    ["--allow-maintenance", allowMaintenance],
    ["--allow-recovery", allowRecovery],
    ["--allow-legacy-repair", allowLegacyRepair],
    ["--allow-force-recovery", allowForceRecovery],
  ]) {
    if (value && mode !== SERVER_MODES.FULL) {
      throw new Error(`${flag} requires --mode full`);
    }
  }
  if (!Number.isInteger(maxExecutionTimeMs) || maxExecutionTimeMs <= 0) {
    throw new Error("--max-execution-time-ms must be a positive integer");
  }
  return Object.freeze({
    mode,
    allowExternalExecution: allowExternalExecution === true,
    allowMaintenance: allowMaintenance === true,
    allowRecovery: allowRecovery === true,
    allowLegacyRepair: allowLegacyRepair === true,
    allowForceRecovery: allowForceRecovery === true,
    maxExecutionTimeMs,
  });
}

function capabilityFor(riskClass) {
  switch (riskClass) {
    case INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION:
      return "allowExternalExecution";
    case INTEGRATION_RISK_CLASSES.MAINTENANCE:
      return "allowMaintenance";
    case INTEGRATION_RISK_CLASSES.CLAIM_RELEASE_RECOVERY:
      return "allowRecovery";
    case INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION:
      return "allowLegacyRepair";
    case INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE:
      return "allowForceRecovery";
    default:
      return null;
  }
}

export function invocationAllowed(classification, policy) {
  const requiredCapability = capabilityFor(classification.riskClass);
  if (!requiredCapability) return { allowed: true };
  return {
    allowed: policy[requiredCapability] === true,
    requiredCapability,
    code: "E_MCP_CAPABILITY_DISABLED",
  };
}

export function toolEnabled(command, classification, policy) {
  if (classification.riskClass === INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION) {
    // Hidden by default in every release until deliberately enabled.
    return policy.allowLegacyRepair === true;
  }
  if (classification.riskClass === INTEGRATION_RISK_CLASSES.READ_ONLY) return true;
  if (
    classification.riskClass === INTEGRATION_RISK_CLASSES.LOOP_MUTATION
    || classification.riskClass === INTEGRATION_RISK_CLASSES.CLAIM_REACQUISITION
  ) {
    return policy.mode !== SERVER_MODES.READONLY;
  }
  return invocationAllowed(classification, policy).allowed;
}

export function annotationsFor(classification, policy) {
  const base = {
    readOnlyHint: classification.readOnly,
    destructiveHint: classification.destructive || !classification.readOnly,
    idempotentHint: classification.readOnly && classification.command !== "next",
    openWorldHint: classification.executesExternalProcess,
  };
  void policy;
  return Object.freeze(base);
}
