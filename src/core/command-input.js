import { continuityOptionDefaults, validateContinuityOptions } from "./continuity-cli-options.js";

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
    work: null,
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
    commandArgv: [],
    checkType: null,
    checkSource: null,
    policy: null,
    task: null,
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
    throw new Error("policy requires a name");
  }
  if (command !== "policy" && options.policy) {
    throw new Error(`Policy name is not valid for ${command}`);
  }
  if (command === "bundle" && !options.task) {
    throw new Error("bundle requires --task");
  }
  if (command === "task-create" && !options.task) {
    throw new Error("task-create requires --task");
  }

  validateContinuityOptions(command, options);

  if (command === "record-check" && !help) {
    if (!options.checkId) throw new Error("record-check requires --id");
    if (!options.checkRequirement) throw new Error("record-check requires --requirement");
    if (!options.checkStatus) throw new Error("record-check requires --status");
    if (!options.checkEvidenceKind) throw new Error("record-check requires --evidence-kind");
    if (!options.checkCommand && !options.checkResult) throw new Error("record-check requires --command or --result");
  }
  if (command === "run-check" && !help) {
    if (!options.checkId) throw new Error("run-check requires --id");
    if (!options.checkRequirement) throw new Error("run-check requires --requirement");
    if (options.checkKind || options.checkStatus || options.checkEvidenceKind || options.checkCommand
      || options.checkResult || options.checkExitCode !== null || options.checkExecutionRef || options.checkProvenance) {
      throw new Error("run-check accepts only --id, --requirement, --details, --timeout-ms, and -- <argv>");
    }
    if (!Array.isArray(options.commandArgv) || options.commandArgv.length === 0) {
      throw new Error("run-check requires -- followed by an exact command argv");
    }
  }
  if (command === "reconcile-closure" && !help) {
    if (!options.task) throw new Error("reconcile-closure requires --task");
    if (!options.checkId) throw new Error("reconcile-closure requires --id");
    if (!options.checkRequirement) throw new Error("reconcile-closure requires --requirement");
    if (options.checkKind || options.checkStatus || options.checkEvidenceKind || options.checkCommand
      || options.checkResult || options.checkExitCode !== null || options.checkExecutionRef || options.checkProvenance) {
      throw new Error("reconcile-closure accepts only --id, --requirement, --details, and -- <argv>");
    }
    if (!Array.isArray(options.commandArgv) || options.commandArgv.length === 0) {
      throw new Error("reconcile-closure requires -- followed by an exact command argv");
    }
  }
}
