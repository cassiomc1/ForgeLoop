import { continuityOptionDefaults, validateContinuityOptions } from "./continuity-cli-options.js";
import { E_CLI_INVOCATION_INVALID } from "./error-codes.js";

function inputError(message) {
  const error = new Error(message);
  error.code = E_CLI_INVOCATION_INVALID;
  return error;
}

/**
 * Transport-neutral option defaults shared by the CLI parser and the
 * programmatic command runtime so every executor observes the same
 * normalized input shape regardless of transport.
 */
export function defaultCommandInputValues() {
  return {
    path: ".",
    dryRun: false,
    json: false,
    strict: false,
    fix: false,
    adopt: [],
    workType: null,
    surfaces: [],
    risks: [],
    platforms: [],
    behaviorChange: false,
    executableChange: false,
    to: null,
    file: null,
    contractFile: null,
    routeFile: null,
    stateFile: null,
    receiptFile: null,
    continuityFile: null,
    taskBriefFiles: [],
    delegatedResultFiles: [],
    checkId: null,
    checkKind: null,
    checkRequirement: null,
    checkStatus: null,
    checkEvidenceKind: null,
    checkCommand: null,
    checkResult: null,
    checkExitCode: null,
    checkDetails: null,
    checkExecutionRef: null,
    checkProvenance: null,
    timeoutMs: null,
    scopeRef: null,
    commandArgv: [],
    checkType: null,
    checkSource: null,
    policy: null,
    taskId: null,
    recipientHint: null,
    handoffNote: null,
    handoffId: null,
    responsibilityLabel: null,
    responsibilityAllowedPaths: [],
    responsibilityReadOnlyPaths: [],
    responsibilityRequiredChecks: [],
    responsibilityFreezeContract: false,
    responsibilityFreezeRoute: false,
    responsibilityFreezeClaims: false,
    verificationScopeMode: null,
    revisionProvider: null,
    signingProvider: null,
    trustedRoot: null,
    baseRevision: null,
    headRevision: null,
    requireCompleteCoverage: false,
    requireSignature: false,
    attestationRef: null,
    attestationBundle: null,
    attestationIdentity: null,
    attestationIssuer: null,
    help: false,
    version: false,
    ...continuityOptionDefaults(),
  };
}

/**
 * Canonical semantic validation shared by the CLI argv parser and
 * programmatic integrations. JSON-Schema style checks cannot express these
 * cross-field rules, so every transport must run this after its own parsing.
 */
export function validateForgeLoopCommandInput({ command, input, help = false } = {}) {
  const options = input ?? {};
  if (!command) return;

  if (command === "policy" && !options.policy) {
    throw inputError("policy requires a name");
  }
  if (command !== "policy" && options.policy) {
    throw inputError(`Policy name is not valid for ${command}`);
  }
  if (command === "bundle" && !options.taskId) {
    throw inputError("bundle requires --task");
  }
  if (command === "task-create" && !options.taskId) {
    throw inputError("task-create requires --task");
  }
  if (["workspace-bind", "workspace-status", "handoff-create", "handoff-list", "handoff-show", "responsibility-set", "responsibility-status", "verify-scope", "attestation-create", "attestation-status", "attestation-verify"].includes(command)
    && !options.taskId) {
    throw inputError(`${command} requires --task`);
  }
  if (command === "handoff-show" && !help && !options.handoffId) {
    throw inputError("handoff-show requires --id");
  }
  if (command === "responsibility-set" && !help && !options.responsibilityLabel) {
    throw inputError("responsibility-set requires --label");
  }
  if (command === "verify-scope" && !help) {
    const mode = String(options.verificationScopeMode ?? "AUTO").toUpperCase();
    if (!["AUTO", "CHANGED", "CLAIMED", "FULL"].includes(mode)) {
      throw inputError("verify-scope --mode must be AUTO, CHANGED, CLAIMED, or FULL");
    }
  }
  if (command === "attestation-verify-range" && !help) {
    if (!options.baseRevision) throw inputError("attestation-verify-range requires --base");
    if (!options.headRevision) throw inputError("attestation-verify-range requires --head");
  }

  validateContinuityOptions(command, options);

  if (command === "record-check" && !help) {
    if (!options.checkId) throw inputError("record-check requires --id");
    if (!options.checkRequirement) throw inputError("record-check requires --requirement");
    if (!options.checkStatus) throw inputError("record-check requires --status");
    if (!options.checkEvidenceKind) throw inputError("record-check requires --evidence-kind");
    if (!options.checkCommand && !options.checkResult) throw inputError("record-check requires --command or --result");
  }
  if (command === "run-check" && !help) {
    if (!options.checkId) throw inputError("run-check requires --id");
    if (!options.checkRequirement) throw inputError("run-check requires --requirement");
    if (options.checkKind || options.checkStatus || options.checkEvidenceKind || options.checkCommand
      || options.checkResult || options.checkExitCode !== null || options.checkExecutionRef || options.checkProvenance) {
      throw inputError("run-check accepts only --id, --requirement, --details, --timeout-ms, --scope-ref, and -- <argv>");
    }
    if (!Array.isArray(options.commandArgv) || options.commandArgv.length === 0) {
      throw inputError("run-check requires -- followed by an exact command argv");
    }
  }
  if (command === "reconcile-closure" && !help) {
    if (!options.taskId) throw inputError("reconcile-closure requires --task");
    if (!options.checkId) throw inputError("reconcile-closure requires --id");
    if (!options.checkRequirement) throw inputError("reconcile-closure requires --requirement");
    if (options.checkKind || options.checkStatus || options.checkEvidenceKind || options.checkCommand
      || options.checkResult || options.checkExitCode !== null || options.checkExecutionRef || options.checkProvenance) {
      throw inputError("reconcile-closure accepts only --id, --requirement, --details, and -- <argv>");
    }
    if (!Array.isArray(options.commandArgv) || options.commandArgv.length === 0) {
      throw inputError("reconcile-closure requires -- followed by an exact command argv");
    }
  }
}
