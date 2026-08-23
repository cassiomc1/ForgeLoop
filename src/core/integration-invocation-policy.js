import { CLI_COMMAND_DEFINITIONS } from "./cli-command-definitions.js";
import { COMMAND_EXECUTORS } from "./command-executors.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { FORGELOOP_INTEGRATION_RUNTIME_VERSION } from "./command-runtime.js";

/**
 * Integration risk classes. They classify the *invocation*, not only the
 * command name: input-dependent commands (doctor --fix, task-unlock --force,
 * policy-discover --write, baseline mutations) are refined by the sparse
 * override table below.
 */
export const INTEGRATION_RISK_CLASSES = Object.freeze({
  READ_ONLY: "READ_ONLY",
  LOOP_MUTATION: "LOOP_MUTATION",
  CLAIM_REACQUISITION: "CLAIM_REACQUISITION",
  EXTERNAL_EXECUTION: "EXTERNAL_EXECUTION",
  MAINTENANCE: "MAINTENANCE",
  CLAIM_RELEASE_RECOVERY: "CLAIM_RELEASE_RECOVERY",
  LEGACY_MIGRATION: "LEGACY_MIGRATION",
  FORCE_DESTRUCTIVE: "FORCE_DESTRUCTIVE",
});

const READ_ONLY_COMMANDS = Object.freeze(new Set([
  "protocol-info", "status", "next", "continuity", "reconcile-continuity",
  "task-list", "task-show", "task-lock-status", "progress", "audit", "report",
  "inspect", "validate-state", "validate-protocol", "validate-receipt",
  "policy-status", "policy-diff", "rule-verify", "policy",
]));

const LOOP_MUTATION_COMMANDS = Object.freeze(new Set([
  "route", "preflight", "advance", "task-create", "task-scope",
  "record-continuity", "clear-continuity", "prepare-completion",
  "record-check", "record-diagnosis", "record-decision-criterion",
  "record-terminal-result", "complete",
]));

const STATIC_RISK_CLASSES = Object.freeze({
  ...Object.fromEntries([...READ_ONLY_COMMANDS].map((name) => [name, INTEGRATION_RISK_CLASSES.READ_ONLY])),
  ...Object.fromEntries([...LOOP_MUTATION_COMMANDS].map((name) => [name, INTEGRATION_RISK_CLASSES.LOOP_MUTATION])),
  "task-resume": INTEGRATION_RISK_CLASSES.CLAIM_REACQUISITION,
  "run-check": INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION,
  "reconcile-closure": INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION,
  init: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  update: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  activate: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "task-migrate": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "migrate-protocol": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "clear-state": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  doctor: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "policy-discover": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  baseline: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "task-unlock": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  // bundle writes a bundle artifact set under the task namespace; it is not
  // read-only despite producing no protocol-state mutations.
  bundle: INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "profile-interview": INTEGRATION_RISK_CLASSES.MAINTENANCE,
  "task-recover": INTEGRATION_RISK_CLASSES.CLAIM_RELEASE_RECOVERY,
  "task-repair-legacy-recovery": INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION,
});

// Sparse input-dependent refinements over the static table.
function refineRiskClass(command, input) {
  if (command === "task-unlock" && input?.force === true) {
    return INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE;
  }
  // Fail closed: every canonical command must be explicitly classified.
  return baseRiskClass(command);
}

export function baseRiskClass(command) {
  const riskClass = STATIC_RISK_CLASSES[command];
  if (!riskClass) {
    throw new Error(`Command ${command} has no integration risk classification`);
  }
  return riskClass;
}

export function getForgeLoopCapabilities({ packageVersion = null } = {}) {
  const commands = Object.keys(CLI_COMMAND_DEFINITIONS).sort().map((name) => {
    const def = CLI_COMMAND_DEFINITIONS[name];
    return {
      name,
      category: def.category,
      mutation: def.mutation,
      baseRiskClass: baseRiskClass(name),
      mayExecuteExternalProcess: def.mayExecuteExternalProcess === true,
      description: def.description,
    };
  });
  return {
    packageVersion,
    protocolVersion: PROTOCOL_VERSION,
    integrationApiVersion: FORGELOOP_INTEGRATION_RUNTIME_VERSION,
    executorParity: Object.keys(COMMAND_EXECUTORS).length === Object.keys(CLI_COMMAND_DEFINITIONS).length,
    features: {
      taskClaimRecovery: {
        version: 1,
        durableRecoveryState: true,
        explicitResume: true,
        validatedClaimProjection: true,
      },
    },
    commands,
    resources: [
      { name: "protocol/info", scope: "PROJECT" },
      { name: "project/tasks", scope: "PROJECT" },
      { name: "task/status", scope: "TASK" },
      { name: "task/ownership", scope: "TASK" },
      { name: "task/contract", scope: "TASK" },
      { name: "task/continuity", scope: "TASK" },
    ],
  };
}

/**
 * Classify a concrete command invocation (command + structured input).
 * Tool-provided input can never elevate a launch-level capability; this
 * classifier only describes what the invocation would do.
 */
export function classifyForgeLoopInvocation(command, input = {}) {
  const definition = CLI_COMMAND_DEFINITIONS[command];
  if (!definition) {
    throw new Error(`Unknown ForgeLoop command: ${command}`);
  }
  const riskClass = refineRiskClass(command, input);
  const readOnly = riskClass === INTEGRATION_RISK_CLASSES.READ_ONLY;
  const requiredCapability = (() => {
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
  })();
  return Object.freeze({
    command,
    riskClass,
    readOnly,
    mutatesProtocol: !readOnly && [
      INTEGRATION_RISK_CLASSES.LOOP_MUTATION,
      INTEGRATION_RISK_CLASSES.CLAIM_REACQUISITION,
      INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION,
      INTEGRATION_RISK_CLASSES.MAINTENANCE,
      INTEGRATION_RISK_CLASSES.CLAIM_RELEASE_RECOVERY,
      INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION,
      INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE,
    ].includes(riskClass),
    removesArtifacts: definition.removes.length > 0,
    executesExternalProcess: definition.mayExecuteExternalProcess === true,
    affectsClaimAuthority: [
      "task-resume", "task-recover", "task-repair-legacy-recovery",
      "task-create", "task-scope", "complete",
    ].includes(command),
    destructive: [
      INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE,
      INTEGRATION_RISK_CLASSES.CLAIM_RELEASE_RECOVERY,
      INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION,
      INTEGRATION_RISK_CLASSES.MAINTENANCE,
    ].includes(riskClass),
    requiredCapability,
  });
}
