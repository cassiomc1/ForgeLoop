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
import { formatBundleResult, runBundle } from "./commands/bundle.js";
import { formatPrepareCompletionResult, runPrepareCompletion } from "./commands/prepare-completion.js";
import { formatRecordCheckResult, runRecordCheck } from "./commands/record-check.js";
import { formatRunCheckResult, runCheck } from "./commands/run-check.js";
import { formatRecordTerminalResult, runRecordTerminalResult } from "./commands/record-terminal-result.js";
import { formatNextActionResult, runNext } from "./commands/next.js";
import { formatContinuityResult, runContinuity } from "./commands/continuity.js";
import { formatRecordContinuityResult, runRecordContinuity } from "./commands/record-continuity.js";
import { formatReconcileContinuityResult, runReconcileContinuity } from "./commands/reconcile-continuity.js";
import { formatClearContinuityResult, runClearContinuity } from "./commands/clear-continuity.js";
import { continuityOptionDefaults, consumeContinuityOption, validateContinuityOptions } from "./core/continuity-cli-options.js";
import { resolveTarget } from "./core/filesystem.js";
import { getPackageRoot } from "./core/templates.js";
import { ARTIFACT_PATHS } from "./core/artifacts.js";

export const COMMANDS = Object.freeze([
  "init",
  "doctor",
  "update",
  "activate",
  "route",
  "preflight",
  "advance",
  "next",
  "continuity",
  "record-continuity",
  "reconcile-continuity",
  "clear-continuity",
  "prepare-completion",
  "run-check",
  "record-check",
  "record-terminal-result",
  "complete",
  "audit",
  "report",
  "policy",
  "bundle",
  "inspect",
  "status",
  "validate-state",
  "clear-state",
  "validate-receipt",
  "validate-protocol",
]);

// Commands whose usage blocks already describe --json (doctor, route) or that
// accept no --json at all (init, update).
const GENERIC_JSON_EXCLUDED_COMMANDS = new Set(["init", "doctor", "update", "route"]);

function usage(command = null) {
  const commands = COMMANDS.join("|");
  const options = ["  --path <directory>  target project directory (default: current directory)"];
  if (!command || command === "init" || command === "update") {
    options.push("  --dry-run           show planned writes without changing files");
  }
  if (!command || command === "doctor") {
    options.push("  --json              emit doctor findings as JSON");
    options.push("  --strict            treat warnings as unhealthy");
    options.push("  --adopt <path>      preserve an existing adapter in the manifest");
  }
  if (!command || command === "route") {
    options.push("  --work <type>       declared work type");
    options.push("  --surface <value>   affected surface (repeatable)");
    options.push("  --risk <value>      task risk (repeatable)");
    options.push("  --platform <value>  affected platform (repeatable)");
    options.push("  --behavior-change   declare behavior change");
    options.push("  --executable-change declare executable/configuration change");
    options.push("  --json              emit route result as JSON");
  }
  if (!command || command === "advance") {
    options.push("  --to <phase>        destination workflow phase");
  }
  if (!command || command === "record-continuity") {
    options.push("  --focus-id <id>            current implementation focus ID");
    options.push("  --focus-summary <text>    current implementation focus summary");
    options.push("  --remaining <id:summary>  remaining implementation item (repeatable)");
    options.push("  --known-issue <id:summary> known implementation issue (repeatable)");
    options.push("  --changed-area <path>     changed project area (repeatable)");
    options.push("  --inspect-first <path>    suggested inspection path (repeatable)");
    options.push("  --resume-note <text>      bounded operational resume note");
  }
  if (!command || !GENERIC_JSON_EXCLUDED_COMMANDS.has(command)) {
    options.push("  --json              emit structured output as JSON");
  }
  if (!command || ["preflight", "complete", "audit", "report"].includes(command)) {
    options.push("  --strict            require strict protocol compliance");
  }
  if (!command || command === "policy") {
    options.push("  <name>              policy pack name");
  }
  if (!command || command === "bundle") {
    options.push("  --task <id>         task ID to export as a portable bundle");
  }
  if (!command || ["status", "inspect", "validate-protocol"].includes(command)) {
    options.push("  --contract-file <path>  current JSON contract used for freshness comparison");
  }
  if (!command || command === "validate-protocol") {
    options.push("  --route-file <path>  routing-result JSON relative to target");
    options.push("  --state-file <path>  work-state JSON relative to target");
    options.push("  --receipt-file <path>  execution-receipt JSON relative to target");
    options.push("  --continuity-file <path>  optional execution-continuity JSON relative to target");
    options.push("  --task-brief-file <path>  task brief JSON (repeatable)");
    options.push("  --delegated-result-file <path>  delegated result JSON (repeatable)");
  }
  if (!command || command === "validate-receipt") {
    options.push("  --file <path>       receipt file relative to target");
  }
  if (!command || command === "record-check" || command === "run-check") {
    options.push("  --id <id>            stable check identifier");
    options.push("  --requirement <id>   completion requirement covered by the check");
    options.push("  --details <json>     additional structured check details");
  }
  if (!command || command === "record-check") {
    options.push("  --kind <kind>        check kind (default: command; use manual-review for manual evidence)");
    options.push("  --status <status>    passed, failed, blocked, or not-run");
    options.push("  --evidence-kind <kind> OBSERVED, INFERRED, NOT_VERIFIED, or BLOCKED");
    options.push("  --command <text>     recorded only as metadata; it is never executed");
    options.push("  --result <text>      observed result supplied by the actor");
    options.push("  --exit-code <number> observed process exit code");
    options.push("  --execution-ref <id> ForgeLoop execution artifact reference");
    options.push("  --provenance <value> FORGELOOP_EXECUTED, ACTOR_REPORTED, or MANUAL_OBSERVATION");
  }
  if (!command || command === "run-check") {
    options.push("  -- <argv>            exact command argv to classify, execute, and attest");
  }
  if (!command || command === "record-terminal-result") {
    options.push("  --requirement <id>   terminal requirement covered by the result");
    options.push("  --type <type>        PUBLICATION or PRODUCTION_READINESS");
    options.push("  --status <status>    observed terminal status");
    options.push("  --source <text>      external action source (e.g. npm publish, git push)");
    options.push("  --result <text>      observed external result description");
    options.push("  --details <json>     additional structured result details");
  }
  options.push("  --version           show the installed package version");
  options.push("  --help              show this help");

  return `Usage: forgeloop <${command ?? commands}> [options]\n\nOptions:\n${options.join("\n")}\n`;
}

export function parseArgs(argv) {
  const options = {
    path: ".",
    dryRun: false,
    json: false,
    strict: false,
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
  let command = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (COMMANDS.includes(argument)) {
      if (command) throw new Error(`Multiple commands are not supported: ${argument}`);
      command = argument;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--strict") {
      options.strict = true;
    } else if (argument === "--adopt") {
      const relativePath = argv[index + 1];
      if (!relativePath || relativePath.startsWith("-")) throw new Error("--adopt requires a path");
      options.adopt.push(relativePath);
      index += 1;
    } else if (argument === "--work") {
      const workType = argv[index + 1];
      if (!workType || workType.startsWith("-")) throw new Error("--work requires a type");
      options.work = workType;
      index += 1;
    } else if (argument === "--surface") {
      const surface = argv[index + 1];
      if (!surface || surface.startsWith("-")) throw new Error("--surface requires a value");
      options.surfaces.push(surface);
      index += 1;
    } else if (argument === "--risk") {
      const risk = argv[index + 1];
      if (!risk || risk.startsWith("-")) throw new Error("--risk requires a value");
      options.risks.push(risk);
      index += 1;
    } else if (argument === "--platform") {
      const platform = argv[index + 1];
      if (!platform || platform.startsWith("-")) throw new Error("--platform requires a value");
      options.platforms.push(platform);
      index += 1;
    } else if (argument === "--behavior-change") {
      options.behaviorChange = true;
    } else if (argument === "--executable-change") {
      options.executableChange = true;
    } else if (argument === "--to") {
      const phase = argv[index + 1];
      if (!phase || phase.startsWith("-")) throw new Error("--to requires a phase");
      options.to = phase;
      index += 1;
    } else if (argument === "--task") {
      const task = argv[index + 1];
      if (!task || task.startsWith("-")) throw new Error("--task requires an ID");
      options.task = task;
      index += 1;
    } else if (argument === "--file") {
      const file = argv[index + 1];
      if (!file || file.startsWith("-")) throw new Error("--file requires a path");
      options.file = file;
      index += 1;
    } else if (argument === "--contract-file") {
      const contractFile = argv[index + 1];
      if (!contractFile || contractFile.startsWith("-")) throw new Error("--contract-file requires a path");
      options.contractFile = contractFile;
      index += 1;
    } else if (["--route-file", "--state-file", "--receipt-file", "--continuity-file"].includes(argument)) {
      const file = argv[index + 1];
      if (!file || file.startsWith("-")) throw new Error(`${argument} requires a path`);
      if (argument === "--route-file") options.routeFile = file;
      if (argument === "--state-file") options.stateFile = file;
      if (argument === "--receipt-file") options.receiptFile = file;
      if (argument === "--continuity-file") options.continuityFile = file;
      index += 1;
    } else if (argument === "--task-brief-file") {
      const file = argv[index + 1];
      if (!file || file.startsWith("-")) throw new Error("--task-brief-file requires a path");
      options.taskBriefFiles.push(file);
      index += 1;
    } else if (argument === "--delegated-result-file") {
      const file = argv[index + 1];
      if (!file || file.startsWith("-")) throw new Error("--delegated-result-file requires a path");
      options.delegatedResultFiles.push(file);
      index += 1;
    } else if (argument === "--id") {
      const id = argv[index + 1];
      if (!id || id.startsWith("-")) throw new Error("--id requires a check ID");
      options.checkId = id;
      index += 1;
    } else if (argument.startsWith("--id=")) {
      const id = argument.slice("--id=".length);
      if (!id || id.startsWith("-")) throw new Error("--id requires a check ID");
      options.checkId = id;
    } else if (argument === "--kind") {
      const kind = argv[index + 1];
      if (!kind || kind.startsWith("-")) throw new Error("--kind requires a check kind");
      options.checkKind = kind;
      index += 1;
    } else if (argument === "--requirement") {
      const requirement = argv[index + 1];
      if (!requirement || requirement.startsWith("-")) throw new Error("--requirement requires an evidence target");
      options.checkRequirement = requirement;
      index += 1;
    } else if (argument.startsWith("--requirement=")) {
      const requirement = argument.slice("--requirement=".length);
      if (!requirement) throw new Error("--requirement requires an evidence target");
      options.checkRequirement = requirement;
    } else if (argument === "--status") {
      const status = argv[index + 1];
      if (!status || status.startsWith("-")) throw new Error("--status requires a check status");
      options.checkStatus = status;
      index += 1;
    } else if (argument === "--evidence-kind") {
      const evidenceKind = argv[index + 1];
      if (!evidenceKind || evidenceKind.startsWith("-")) throw new Error("--evidence-kind requires an evidence kind");
      options.checkEvidenceKind = evidenceKind;
      index += 1;
    } else if (argument === "--command") {
      const commandText = argv[index + 1];
      if (!commandText || commandText.startsWith("-")) throw new Error("--command requires recorded text");
      options.checkCommand = commandText;
      index += 1;
    } else if (argument === "--source") {
      const sourceText = argv[index + 1];
      if (!sourceText || sourceText.startsWith("-")) throw new Error("--source requires recorded text");
      options.checkSource = sourceText;
      index += 1;
    } else if (argument.startsWith("--source=")) {
      const sourceText = argument.slice("--source=".length);
      if (!sourceText) throw new Error("--source requires recorded text");
      options.checkSource = sourceText;
    } else if (argument === "--type") {
      const typeValue = argv[index + 1];
      if (!typeValue || typeValue.startsWith("-")) throw new Error("--type requires a terminal type");
      options.checkType = typeValue;
      index += 1;
    } else if (argument.startsWith("--type=")) {
      const typeValue = argument.slice("--type=".length);
      if (!typeValue) throw new Error("--type requires a terminal type");
      options.checkType = typeValue;
    } else if (argument === "--result") {
      const resultText = argv[index + 1];
      if (!resultText || resultText.startsWith("-")) throw new Error("--result requires recorded text");
      options.checkResult = resultText;
      index += 1;
    } else if (argument.startsWith("--result=")) {
      const resultText = argument.slice("--result=".length);
      if (!resultText) throw new Error("--result requires recorded text");
      options.checkResult = resultText;
    } else if (argument === "--exit-code") {
      const exitCode = argv[index + 1];
      if (!exitCode || exitCode.startsWith("-")) throw new Error("--exit-code requires a non-negative integer");
      if (!/^\d+$/.test(exitCode)) throw new Error("--exit-code requires a non-negative integer");
      options.checkExitCode = Number(exitCode);
      index += 1;
    } else if (argument === "--details") {
      const details = argv[index + 1];
      if (!details || details.startsWith("-")) throw new Error("--details requires a JSON object");
      try {
        options.checkDetails = JSON.parse(details);
      } catch {
        throw new Error("--details must be valid JSON");
      }
      if (!options.checkDetails || typeof options.checkDetails !== "object" || Array.isArray(options.checkDetails)) {
        throw new Error("--details must be a JSON object");
      }
      index += 1;
    } else if (argument === "--execution-ref") {
      const executionRef = argv[index + 1];
      if (!executionRef || executionRef.startsWith("-")) throw new Error("--execution-ref requires an execution ID");
      options.checkExecutionRef = executionRef;
      index += 1;
    } else if (argument === "--provenance") {
      const provenance = argv[index + 1];
      if (!provenance || provenance.startsWith("-")) throw new Error("--provenance requires a provenance value");
      options.checkProvenance = provenance;
      index += 1;
    } else if (argument === "--" && command === "run-check") {
      options.commandArgv = argv.slice(index + 1);
      break;
    } else if ([
      "--focus-id",
      "--focus-summary",
      "--remaining",
      "--known-issue",
      "--changed-area",
      "--inspect-first",
      "--resume-note",
    ].includes(argument)) {
      const consumed = consumeContinuityOption({ argument, argv, index, options });
      index = consumed.index;
    } else if (argument === "--path") {
      options.path = argv[index + 1];
      if (!options.path || options.path.startsWith("-")) throw new Error("--path requires a directory");
      index += 1;
    } else if (argument.startsWith("--path=")) {
      options.path = argument.slice("--path=".length);
      if (!options.path || options.path.startsWith("-")) throw new Error("--path requires a directory");
    } else if (argument === "--version" || argument === "-v") {
      options.version = true;
    } else if (!argument.startsWith("-") && command === "policy" && !options.policy) {
      options.policy = argument;
    } else if (!argument.startsWith("-") && !command) {
      command = argument;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!command) return { command: null, options };

  const jsonCommands = ["doctor", "route", "activate", "advance", "next", "continuity", "record-continuity", "reconcile-continuity", "clear-continuity", "prepare-completion", "run-check", "record-check", "record-terminal-result", "preflight", "complete", "audit", "report", "policy", "bundle", "inspect", "status", "validate-state", "clear-state", "validate-receipt", "validate-protocol"];
  if (!jsonCommands.includes(command) && options.json) {
    throw new Error(`Option --json is not valid for ${command}`);
  }
  if (![
    "init",
    "update",
  ].includes(command) && options.dryRun) {
    throw new Error(`Option --dry-run is not valid for ${command}`);
  }
  if (!["doctor", "preflight", "complete", "audit", "report"].includes(command) && options.strict) {
    throw new Error(`Option --strict is not valid for ${command}`);
  }
  if (command !== "doctor" && options.adopt.length > 0) {
    throw new Error(`Option --adopt is not valid for ${command}`);
  }
  if (command !== "route" && (options.work || options.surfaces.length || options.risks.length || options.platforms.length || options.behaviorChange || options.executableChange)) {
    throw new Error(`Route options are not valid for ${command}`);
  }
  if (command !== "advance" && options.to) {
    throw new Error(`Option --to is not valid for ${command}`);
  }
  if (command === "policy" && !options.policy) {
    throw new Error("policy requires a name");
  }
  if (command !== "policy" && options.policy) {
    throw new Error(`Policy name is not valid for ${command}`);
  }
  if (command === "bundle" && !options.task) {
    throw new Error("bundle requires --task");
  }
  if (command !== "bundle" && options.task) {
    throw new Error(`--task is not valid for ${command}`);
  }
  if (command !== "validate-receipt" && options.file) {
    throw new Error(`Option --file is not valid for ${command}`);
  }
  if (!["status", "inspect", "validate-protocol"].includes(command) && options.contractFile) {
    throw new Error(`Option --contract-file is not valid for ${command}`);
  }
  if (command !== "validate-protocol" && (options.routeFile || options.stateFile || options.receiptFile || options.continuityFile || options.taskBriefFiles.length > 0 || options.delegatedResultFiles.length > 0)) {
    throw new Error(`Protocol artifact options are not valid for ${command}`);
  }
  const checkOptions = [
    options.checkId,
    options.checkKind,
    options.checkRequirement,
    options.checkStatus,
    options.checkEvidenceKind,
    options.checkCommand,
    options.checkResult,
    options.checkExitCode,
    options.checkDetails,
    options.checkExecutionRef,
    options.checkProvenance,
  ];
  if (!["record-check", "run-check"].includes(command) && checkOptions.some((value) => value !== null)) {
    throw new Error(`Check recording options are not valid for ${command}`);
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
      throw new Error("run-check accepts only --id, --requirement, --details, and -- <argv>");
    }
    if (!Array.isArray(options.commandArgv) || options.commandArgv.length === 0) {
      throw new Error("run-check requires -- followed by an exact command argv");
    }
  }
  return { command, options };
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
    const result = await runPreflight({ target, packageRoot, strict: options.strict });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPreflightResult(result));
    return result.status === "READY" ? 0 : 1;
  },
  advance: async ({ target, packageRoot, options }) => {
    const result = await runAdvance({ target, packageRoot, to: options.to });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatAdvanceResult(result));
    return 0;
  },
  next: async ({ target, packageRoot, options }) => {
    const result = await runNext({ target, packageRoot });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatNextActionResult(result));
    return 0;
  },
  continuity: async ({ target, packageRoot, options }) => {
    const result = await runContinuity({ target, packageRoot });
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
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordContinuityResult(result));
    return 0;
  },
  "reconcile-continuity": async ({ target, packageRoot, options }) => {
    const result = await runReconcileContinuity({ target, packageRoot });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReconcileContinuityResult(result));
    return 0;
  },
  "clear-continuity": async ({ target, options }) => {
    const result = await runClearContinuity({ target });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatClearContinuityResult(result));
    return 0;
  },
  "prepare-completion": async ({ target, packageRoot, options }) => {
    const result = await runPrepareCompletion({ target, packageRoot });
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
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordTerminalResult(result));
    return 0;
  },
  complete: async ({ target, packageRoot, options }) => {
    const result = await runComplete({ target, packageRoot, strict: options.strict });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatCompleteResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  audit: async ({ target, packageRoot, options }) => {
    const result = await runAudit({ target, packageRoot, strict: options.strict });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatAuditResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  report: async ({ target, packageRoot, options }) => {
    const result = await runReport({ target, packageRoot, strict: options.strict });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReportResult(result));
    return result.verdict === "VALID" ? 0 : 1;
  },
  policy: async ({ target, packageRoot, options }) => {
    const result = await runPolicy({ target, packageRoot, name: options.policy });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPolicyResult(result));
    return 0;
  },
  bundle: async ({ target, packageRoot, options }) => {
    const result = await runBundle({ target, packageRoot, taskId: options.task });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatBundleResult(result));
    return 0;
  },
  inspect: async ({ target, packageRoot, options }) => {
    const result = await inspectTarget({ target, packageRoot, contractFile: options.contractFile });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatInspectResult(result));
    return result.ok ? 0 : 1;
  },
  "validate-receipt": async ({ target, packageRoot, options }) => {
    const result = await runValidateReceipt({ target, packageRoot, file: options.file });
    console.log(options.json ? JSON.stringify(result, null, 2) : "valid: execution receipt");
    return 0;
  },
  "validate-protocol": async ({ target, packageRoot, options }) => {
    const result = await runValidateProtocol({
      target,
      packageRoot,
      stateFile: options.stateFile ?? ARTIFACT_PATHS.state,
      receiptFile: options.receiptFile ?? ARTIFACT_PATHS.receipt,
      routeFile: options.routeFile ?? ARTIFACT_PATHS.route,
      contractFile: options.contractFile,
      continuityFile: options.continuityFile,
      taskBriefFiles: options.taskBriefFiles,
      delegatedResultFiles: options.delegatedResultFiles,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatValidateProtocolResult(result));
    return result.status === "VALID" ? 0 : 1;
  },
  status: async ({ target, packageRoot, options }) => {
    const result = await runStatus({ target, packageRoot, contractFile: options.contractFile });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatStatusResult(result));
    return 0;
  },
  "validate-state": async ({ target, packageRoot, options }) => {
    const result = await runValidateState({ target, packageRoot });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatValidateStateResult(result));
    return result.ok ? 0 : 1;
  },
  "clear-state": async ({ target, options }) => {
    const result = await runClearState({ target });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatClearStateResult(result));
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
