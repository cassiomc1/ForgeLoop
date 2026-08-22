#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDoctor } from "./commands/doctor.js";
import { formatStatusResult, runStatus } from "./commands/status.js";
import { formatValidateStateResult, runValidateState } from "./commands/validate-state.js";
import { formatClearStateResult, runClearState } from "./commands/clear-state.js";
import { formatInspectResult, inspectTarget } from "./commands/inspect.js";
import { runInit } from "./commands/init.js";
import { formatRouteResult, runRoute } from "./commands/route.js";
import { runValidateReceipt } from "./commands/validate-receipt.js";
import { formatValidateProtocolResult, runValidateProtocol } from "./commands/validate-protocol.js";
import { runUpdate } from "./commands/update.js";
import { formatActivateResult, runActivate } from "./commands/activate.js";
import { formatAdvanceResult, runAdvance } from "./commands/advance.js";
import { formatPreflightResult, runPreflight } from "./commands/preflight.js";
import { formatCompleteResult, runComplete } from "./commands/complete.js";
import { formatAuditResult, runAudit } from "./commands/audit.js";
import { formatReportResult, runReport } from "./commands/report.js";
import { formatPolicyResult, runPolicy } from "./commands/policy.js";
import { formatPolicyDiscoverResult, runPolicyDiscover } from "./commands/policy-discover.js";
import { formatPolicyStatusResult, runPolicyStatus } from "./commands/policy-status.js";
import { formatPolicyDiffResult, runPolicyDiff } from "./commands/policy-diff.js";
import { formatRuleVerifyResult, runRuleVerify } from "./commands/rule-verify.js";
import { formatBaselineResult, runBaseline } from "./commands/baseline.js";
import { formatProfileInterviewResult, runProfileInterview } from "./commands/profile-interview.js";
import { formatBundleResult, runBundle } from "./commands/bundle.js";
import { formatPrepareCompletionResult, runPrepareCompletion } from "./commands/prepare-completion.js";
import { formatRecordCheckResult, runRecordCheck } from "./commands/record-check.js";
import { formatRunCheckResult, runCheck } from "./commands/run-check.js";
import { formatReconcileClosureResult, reconcileClosure } from "./commands/reconcile-closure.js";
import { formatRecordTerminalResult, runRecordTerminalResult } from "./commands/record-terminal-result.js";
import { formatRecordDiagnosisResult, runRecordDiagnosis } from "./commands/record-diagnosis.js";
import { formatProgressResult, runProgress } from "./commands/progress.js";
import { formatRecordDecisionCriterionResult, runRecordDecisionCriterion } from "./commands/record-decision-criterion.js";
import { formatNextActionResult, runNext } from "./commands/next.js";
import { formatContinuityResult, runContinuity } from "./commands/continuity.js";
import { formatRecordContinuityResult, runRecordContinuity } from "./commands/record-continuity.js";
import { formatReconcileContinuityResult, runReconcileContinuity } from "./commands/reconcile-continuity.js";
import { formatClearContinuityResult, runClearContinuity } from "./commands/clear-continuity.js";
import { formatTaskCreateResult, runTaskCreate } from "./commands/task-create.js";
import { formatTaskListResult, runTaskList } from "./commands/task-list.js";
import { formatTaskShowResult, runTaskShow } from "./commands/task-show.js";
import { formatTaskScopeResult, runTaskScope } from "./commands/task-scope.js";
import { formatTaskMigrateResult, runTaskMigrate } from "./commands/task-migrate.js";
import { formatMigrateProtocolResult, runMigrateProtocol } from "./commands/migrate-protocol.js";
import { formatTaskUnlockResult, runTaskUnlock } from "./commands/task-unlock.js";
import { formatTaskRecoverResult, runTaskRecover } from "./commands/task-recover.js";
import { formatTaskResumeResult, runTaskResume } from "./commands/task-resume.js";
import {
  formatTaskRepairLegacyRecoveryResult,
  runTaskRepairLegacyRecovery,
} from "./commands/task-repair-legacy-recovery.js";
import { formatTaskLockStatusResult, runTaskLockStatus } from "./commands/task-lock-status.js";
import { formatProtocolInfoResult, runProtocolInfo } from "./commands/protocol-info.js";
import { continuityOptionDefaults, validateContinuityOptions } from "./core/continuity-cli-options.js";
import { resolveTarget } from "./core/filesystem.js";
import { getPackageRoot } from "./core/templates.js";
import { CLI_COMMAND_DEFINITIONS, buildOptionLookup, getPositionalDefinitions } from "./core/cli-command-definitions.js";

export const COMMANDS = Object.freeze(Object.keys(CLI_COMMAND_DEFINITIONS));

function formatOptionUsage(optKey, optDef) {
  let label = optKey;
  if (optDef.valueName) {
    label = optKey === "--" ? `-- <${optDef.valueName}>` : `${optKey} <${optDef.valueName}>`;
  }
  return `  ${label.padEnd(20)} ${optDef.description}`;
}

export function usage(command = null) {
  if (command && CLI_COMMAND_DEFINITIONS[command]) {
    const def = CLI_COMMAND_DEFINITIONS[command];
    const lines = Object.entries(def.options).map(([optKey, optDef]) => formatOptionUsage(optKey, optDef));
    return `Usage: forgeloop <${command}> [options]\n\nOptions:\n${lines.join("\n")}\n`;
  }

  const allOptions = new Map();
  for (const def of Object.values(CLI_COMMAND_DEFINITIONS)) {
    for (const [optKey, optDef] of Object.entries(def.options)) {
      if (!allOptions.has(optKey)) {
        allOptions.set(optKey, optDef);
      }
    }
  }

  const lines = [...allOptions.entries()].map(([optKey, optDef]) => formatOptionUsage(optKey, optDef));
  const commands = COMMANDS.join("|");
  return `Usage: forgeloop <${commands}> [options]\n\nOptions:\n${lines.join("\n")}\n`;
}

export function splitLongOption(argument) {
  if (!argument.startsWith("--")) {
    return { name: argument, inlineValue: undefined };
  }
  const index = argument.indexOf("=");
  if (index === -1) {
    return { name: argument, inlineValue: undefined };
  }
  return {
    name: argument.slice(0, index),
    inlineValue: argument.slice(index + 1),
  };
}

function applyOption({ canonicalName, optionDef, inlineValue, argv, index, options, suppliedFlags }) {
  const key = optionDef.targetKey;
  suppliedFlags.add(canonicalName);

  if (inlineValue !== undefined && !optionDef.takesValue) {
    throw new Error(`${canonicalName} does not accept a value`);
  }

  switch (optionDef.parseType) {
    case "boolean": {
      options[key] = true;
      return { index };
    }
    case "string": {
      const value = inlineValue ?? argv[index + 1];
      if (
        value === undefined ||
        (value.length === 0 && !optionDef.allowEmpty) ||
        (value.startsWith("-") && inlineValue === undefined && !optionDef.allowLeadingHyphen)
      ) {
        throw new Error(optionDef.missingValueMessage ?? `${canonicalName} requires a value`);
      }
      if (optionDef.repeatable) {
        if (!Array.isArray(options[key])) options[key] = [];
        options[key].push(value);
      } else {
        options[key] = value;
      }
      return { index: inlineValue === undefined ? index + 1 : index };
    }
    case "non-negative-integer": {
      const value = inlineValue ?? argv[index + 1];
      if (value === undefined || !/^\d+$/.test(value)) {
        throw new Error(optionDef.missingValueMessage ?? `${canonicalName} requires a non-negative integer`);
      }
      options[key] = Number(value);
      return { index: inlineValue === undefined ? index + 1 : index };
    }
    case "json-object": {
      const raw = inlineValue ?? argv[index + 1];
      if (!raw || (raw.startsWith("-") && inlineValue === undefined)) {
        throw new Error(optionDef.missingValueMessage ?? `${canonicalName} requires a JSON object`);
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`${canonicalName} must be valid JSON`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${canonicalName} must be a JSON object`);
      }
      options[key] = parsed;
      return { index: inlineValue === undefined ? index + 1 : index };
    }
    case "argv": {
      const remaining = argv.slice(index + 1);
      options[key] = remaining;
      return { index: argv.length, stop: true };
    }
    default:
      throw new Error(`Unsupported option type: ${optionDef.parseType}`);
  }
}

const ALL_VALUE_TAKING_FLAGS = new Set();
for (const def of Object.values(CLI_COMMAND_DEFINITIONS)) {
  for (const [optName, optDef] of Object.entries(def.options)) {
    if (optDef.takesValue && optName.startsWith("-")) {
      ALL_VALUE_TAKING_FLAGS.add(optName);
    }
  }
}

export function discoverCommand(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") break;

    if (arg.startsWith("-")) {
      const eqIdx = arg.indexOf("=");
      const optName = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
      if (eqIdx === -1 && ALL_VALUE_TAKING_FLAGS.has(optName)) {
        i += 1; // Skip the option's value so it is never scanned as a candidate command
      }
      continue;
    }

    if (COMMANDS.includes(arg)) {
      return arg;
    }
  }
  return null;
}

export function parseCliSyntax(argv) {
  const options = {
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
    ...continuityOptionDefaults(),
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
  };

  const command = discoverCommand(argv);
  const bootstrapLookup = buildOptionLookup(null);
  const commandLookup = buildOptionLookup(command);
  const positionalDefs = getPositionalDefinitions(command);
  let positionalCursor = 0;
  const suppliedFlags = new Set();
  let commandSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === command && !commandSeen) {
      commandSeen = true;
      continue;
    }

    if (argument === "--") {
      if (!commandSeen) {
        throw new Error("-- is not valid before a command");
      }
      const passthrough = commandLookup.get("--");
      if (!passthrough) {
        throw new Error(`Unknown option: --`);
      }
      options[passthrough.optionDef.targetKey] = argv.slice(index + 1);
      suppliedFlags.add("--");
      break;
    }

    const { name: optName, inlineValue } = splitLongOption(argument);
    const activeLookup = commandSeen ? commandLookup : bootstrapLookup;
    const matched = activeLookup.get(optName);

    if (matched) {
      const res = applyOption({
        canonicalName: matched.canonicalName,
        optionDef: matched.optionDef,
        inlineValue,
        argv,
        index,
        options,
        suppliedFlags,
      });
      index = res.index;
      if (res.stop) break;
      continue;
    }

    if (commandSeen && command && !argument.startsWith("-")) {
      const positional = positionalDefs[positionalCursor];
      if (positional) {
        options[positional.targetKey] = argument;
        positionalCursor += 1;
        continue;
      }
    }

    if (!commandSeen) {
      if (!command) {
        throw new Error(`Unknown option: ${argument}`);
      }
      throw new Error(`Option ${argument} is not valid before a command`);
    }

    if (command) {
      throw new Error(`Option ${argument} is not valid for ${command}`);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { command, options };
}

export function validateCliSemantics({ command, options } = {}) {
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

  if (command === "record-check" && !options.help) {
    if (!options.checkId) throw new Error("record-check requires --id");
    if (!options.checkRequirement) throw new Error("record-check requires --requirement");
    if (!options.checkStatus) throw new Error("record-check requires --status");
    if (!options.checkEvidenceKind) throw new Error("record-check requires --evidence-kind");
    if (!options.checkCommand && !options.checkResult) throw new Error("record-check requires --command or --result");
  }
  if (command === "run-check" && !options.help) {
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
  if (command === "reconcile-closure" && !options.help) {
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

export function parseArgs(argv) {
  const parsed = parseCliSyntax(argv);
  validateCliSemantics(parsed);
  return parsed;
}

async function packageVersion(packageRoot) {
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  return packageJson.version;
}

function printActions(actions) {
  for (const item of actions) {
    const reason = item.reason ? ` (${item.reason})` : "";
    console.log(`${item.action.replaceAll("-", " ")}: ${item.path}${reason}`);
  }
}

export const COMMAND_HANDLERS = Object.freeze({
  "protocol-info": async ({ packageVersion, options }) => {
    const result = await runProtocolInfo({ packageVersion });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatProtocolInfoResult(result));
    return 0;
  },
  init: async ({ target, packageRoot, packageVersion, options }) => {
    const result = await runInit({ target, dryRun: options.dryRun, packageRoot, packageVersion });
    printActions(result.actions);
    return 0;
  },
  doctor: async ({ target, packageRoot, options }) => {
    const result = await runDoctor({
      target,
      packageRoot,
      adoptPaths: options.adopt,
      strict: options.strict,
      fix: options.fix,
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const item of result.findings) {
        console.log(`${item.severity}: ${item.code}: ${item.path} - ${item.message}`);
      }
      console.log(result.ok ? "healthy: ForgeLoop target is ready" : "unhealthy: ForgeLoop target needs attention");
    }
    return result.ok ? 0 : 1;
  },
  route: async ({ target, packageRoot, options }) => {
    const result = await runRoute({
      target,
      packageRoot,
      workType: options.work,
      surfaces: options.surfaces,
      risks: options.risks,
      platforms: options.platforms,
      behaviorChange: options.behaviorChange,
      executableChange: options.executableChange,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRouteResult(result));
    return 0;
  },
  activate: async ({ target, packageRoot, options }) => {
    const result = await runActivate({ target, packageRoot });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatActivateResult(result));
    return 0;
  },
  preflight: async ({ target, packageRoot, options }) => {
    const result = await runPreflight({ target, packageRoot, strict: options.strict, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPreflightResult(result));
    return result.status === "READY" ? 0 : 1;
  },
  advance: async ({ target, packageRoot, options }) => {
    const result = await runAdvance({ target, packageRoot, to: options.to, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatAdvanceResult(result));
    return 0;
  },
  next: async ({ target, packageRoot, options }) => {
    const result = await runNext({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatNextActionResult(result));
    return 0;
  },
  continuity: async ({ target, packageRoot, options }) => {
    const result = await runContinuity({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatContinuityResult(result));
    return 0;
  },
  "record-continuity": async ({ target, packageRoot, options }) => {
    const result = await runRecordContinuity({
      target, packageRoot,
      focusId: options.continuityFocusId,
      focusSummary: options.continuityFocusSummary,
      remaining: options.continuityRemaining,
      knownIssues: options.continuityKnownIssues,
      changedAreas: options.continuityChangedAreas,
      inspectFirst: options.continuityInspectFirst,
      resumeNote: options.continuityResumeNote,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordContinuityResult(result));
    return 0;
  },
  "reconcile-continuity": async ({ target, packageRoot, options }) => {
    const result = await runReconcileContinuity({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReconcileContinuityResult(result));
    return 0;
  },
  "clear-continuity": async ({ target, options }) => {
    const result = await runClearContinuity({ target, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatClearContinuityResult(result));
    return 0;
  },
  "prepare-completion": async ({ target, packageRoot, options }) => {
    const result = await runPrepareCompletion({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPrepareCompletionResult(result));
    return 0;
  },
  "run-check": async ({ target, packageRoot, options }) => {
    const result = await runCheck({
      target,
      packageRoot,
      id: options.checkId,
      requirement: options.checkRequirement,
      argv: options.commandArgv,
      details: options.checkDetails ?? undefined,
      timeoutMs: options.timeoutMs ?? undefined,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRunCheckResult(result));
    return result.check.status === "passed" ? 0 : 1;
  },
  "record-check": async ({ target, packageRoot, options }) => {
    const result = await runRecordCheck({
      target,
      packageRoot,
      id: options.checkId,
      kind: options.checkKind ?? "command",
      requirement: options.checkRequirement,
      status: options.checkStatus,
      evidenceKind: options.checkEvidenceKind,
      command: options.checkCommand ?? undefined,
      result: options.checkResult ?? undefined,
      ...(options.checkExitCode === null ? {} : { exitCode: options.checkExitCode }),
      details: options.checkDetails ?? undefined,
      executionRef: options.checkExecutionRef ?? undefined,
      provenance: options.checkProvenance ?? undefined,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordCheckResult(result));
    return 0;
  },
  "record-terminal-result": async ({ target, packageRoot, options }) => {
    const result = await runRecordTerminalResult({
      target,
      packageRoot,
      requirement: options.checkRequirement,
      type: options.checkType,
      status: options.checkStatus,
      source: options.checkSource ?? options.checkCommand,
      result: options.checkResult,
      details: options.checkDetails ?? undefined,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordTerminalResult(result));
    return 0;
  },
  "record-diagnosis": async ({ target, packageRoot, options }) => {
    const result = await runRecordDiagnosis({
      target,
      packageRoot,
      hypothesis: options.hypothesis,
      failureClass: options.failureClass,
      evidenceRefs: options.evidenceRefs,
      settledBy: options.settledBy,
      nextSafeAction: options.nextSafeAction,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordDiagnosisResult(result));
    return 0;
  },
  progress: async ({ target, packageRoot, options }) => {
    const result = await runProgress({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatProgressResult(result));
    return result.status === "STALLED" ? 1 : 0;
  },
  "record-decision-criterion": async ({ target, packageRoot, options }) => {
    const result = await runRecordDecisionCriterion({
      target,
      packageRoot,
      decision: options.decision,
      settledBy: options.settledBy,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordDecisionCriterionResult(result));
    return 0;
  },
  complete: async ({ target, packageRoot, options }) => {
    const result = await runComplete({ target, packageRoot, strict: options.strict, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatCompleteResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  audit: async ({ target, packageRoot, options }) => {
    const result = await runAudit({ target, packageRoot, strict: options.strict, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatAuditResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  report: async ({ target, packageRoot, options }) => {
    const result = await runReport({ target, packageRoot, strict: options.strict, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReportResult(result));
    return result.verdict === "VALID" ? 0 : 1;
  },
  policy: async ({ target, packageRoot, options }) => {
    const result = await runPolicy({ target, packageRoot, name: options.policy, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPolicyResult(result));
    return 0;
  },
  "policy-discover": async ({ target, packageRoot, options }) => {
    const result = await runPolicyDiscover({ target, packageRoot, write: options.write });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPolicyDiscoverResult(result));
    return 0;
  },
  "policy-status": async ({ target, packageRoot, options }) => {
    const result = await runPolicyStatus({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPolicyStatusResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  "policy-diff": async ({ target, packageRoot, options }) => {
    const result = await runPolicyDiff({ target, packageRoot, taskId: options.task, before: options.before, after: options.after });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPolicyDiffResult(result));
    return 0;
  },
  "rule-verify": async ({ target, packageRoot, options }) => {
    const result = await runRuleVerify({ target, packageRoot, rule: options.rule });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRuleVerifyResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  baseline: async ({ target, packageRoot, options }) => {
    const result = await runBaseline({
      target,
      packageRoot,
      record: options.record,
      update: options.update,
      policyResetAuthorized: options.policyResetAuthorized,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatBaselineResult(result));
    return 0;
  },
  "profile-interview": async ({ target, packageRoot, options }) => {
    const result = await runProfileInterview({ target, packageRoot, dryRun: options.dryRun });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatProfileInterviewResult(result));
    return 0;
  },
  bundle: async ({ target, packageRoot, options }) => {
    const result = await runBundle({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatBundleResult(result));
    return 0;
  },
  inspect: async ({ target, packageRoot, options }) => {
    const result = await inspectTarget({ target, packageRoot, contractFile: options.contractFile, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatInspectResult(result));
    return result.ok ? 0 : 1;
  },
  "validate-receipt": async ({ target, packageRoot, options }) => {
    const result = await runValidateReceipt({ target, packageRoot, file: options.file, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : "valid: execution receipt");
    return 0;
  },
  "validate-protocol": async ({ target, packageRoot, options }) => {
    const result = await runValidateProtocol({
      target,
      packageRoot,
      stateFile: options.stateFile,
      receiptFile: options.receiptFile,
      routeFile: options.routeFile,
      contractFile: options.contractFile,
      continuityFile: options.continuityFile,
      taskBriefFiles: options.taskBriefFiles,
      delegatedResultFiles: options.delegatedResultFiles,
      taskId: options.task,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatValidateProtocolResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  status: async ({ target, packageRoot, options }) => {
    const result = await runStatus({ target, packageRoot, contractFile: options.contractFile, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatStatusResult(result));
    return 0;
  },
  "validate-state": async ({ target, packageRoot, options }) => {
    const result = await runValidateState({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatValidateStateResult(result));
    return result.ok ? 0 : 1;
  },
  "clear-state": async ({ target, options }) => {
    const result = await runClearState({ target, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatClearStateResult(result));
    return 0;
  },
  "task-create": async ({ target, packageRoot, options }) => {
    const result = await runTaskCreate({
      target,
      packageRoot,
      taskId: options.task,
      claims: options.claims,
      contractFile: options.contractFile,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskCreateResult(result));
    return 0;
  },
  "task-list": async ({ target, packageRoot, options }) => {
    const result = await runTaskList({ target, packageRoot });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskListResult(result));
    return 0;
  },
  "task-show": async ({ target, packageRoot, options }) => {
    const result = await runTaskShow({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskShowResult(result));
    return 0;
  },
  "task-lock-status": async ({ target, packageRoot, options }) => {
    const result = await runTaskLockStatus({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskLockStatusResult(result));
    return 0;
  },
  "task-scope": async ({ target, packageRoot, options }) => {
    const result = await runTaskScope({
      target,
      packageRoot,
      taskId: options.task,
      claims: options.claims,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskScopeResult(result));
    return 0;
  },
  "task-migrate": async ({ target, packageRoot, options }) => {
    const result = await runTaskMigrate({ target, packageRoot, dryRun: options.dryRun });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskMigrateResult(result));
    return 0;
  },
  "migrate-protocol": async ({ target, packageRoot, options }) => {
    const result = await runMigrateProtocol({ target, packageRoot, to: options.to, dryRun: options.dryRun });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatMigrateProtocolResult(result));
    return 0;
  },
  "task-unlock": async ({ target, packageRoot, options }) => {
    const result = await runTaskUnlock({ target, packageRoot, taskId: options.task, force: options.force, staleOnly: options.staleOnly });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskUnlockResult(result));
    return 0;
  },
  "task-recover": async ({ target, packageRoot, options }) => {
    if (options.operatorAuthorized && !options.acknowledgeRecovery) {
      console.error("DEPRECATION: --operator-authorized is caller acknowledgement, not host attestation; use --acknowledge-recovery.");
    }
    const result = await runTaskRecover({
      target,
      packageRoot,
      taskId: options.task,
      acknowledgeRecovery: options.acknowledgeRecovery,
      operatorAuthorized: options.operatorAuthorized,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskRecoverResult(result));
    return 0;
  },
  "task-resume": async ({ target, packageRoot, options }) => {
    const result = await runTaskResume({ target, packageRoot, taskId: options.task, claims: options.claims });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskResumeResult(result));
    return 0;
  },
  "task-repair-legacy-recovery": async ({ target, packageRoot, options }) => {
    const result = await runTaskRepairLegacyRecovery({
      target,
      packageRoot,
      taskId: options.task,
      acknowledgeRecovery: options.acknowledgeRecovery,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTaskRepairLegacyRecoveryResult(result));
    return 0;
  },
  "reconcile-closure": async ({ target, packageRoot, options }) => {
    const result = await reconcileClosure({
      target,
      packageRoot,
      taskId: options.task,
      checkId: options.checkId,
      checkRequirement: options.checkRequirement,
      checkDetails: options.checkDetails,
      commandArgv: options.commandArgv,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReconcileClosureResult(result));
    return 0;
  },
  update: async ({ target, packageRoot, packageVersion, options }) => {
    const result = await runUpdate({ target, dryRun: options.dryRun, packageRoot, packageVersion });
    printActions(result.actions);
    for (const conflict of result.conflicts) {
      const code = conflict.code ? `${conflict.code}: ` : "";
      console.log(`conflict: ${code}${conflict.path} - ${conflict.message}`);
    }
    return result.conflicts.length === 0 ? 0 : 1;
  },
});

export const COMMAND_TABLE = Object.freeze(
  COMMANDS.map((name) => Object.freeze({
    name,
    handler: COMMAND_HANDLERS[name],
    usage: usage(name),
  })),
);

export async function main(argv = process.argv.slice(2)) {
  try {
    const { command, options } = parseArgs(argv);
    if (options.version) {
      console.log(await packageVersion(getPackageRoot()));
      return 0;
    }
    if (!command || options.help) {
      console.log(usage(command));
      return options.help ? 0 : 1;
    }

    const target = await resolveTarget(process.cwd(), options.path);
    const packageRoot = getPackageRoot();
    const version = await packageVersion(packageRoot);

    const handler = COMMAND_HANDLERS[command];
    if (typeof handler !== "function") {
      throw new Error(`Unsupported command: ${command}`);
    }
    return await handler({
      target,
      packageRoot,
      packageVersion: version,
      options,
    });
  } catch (error) {
    console.error(`error: ${error.code ? `${error.code}: ` : ""}${error.message}`);
    return 1;
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
