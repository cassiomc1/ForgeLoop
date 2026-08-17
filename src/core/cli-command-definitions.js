/**
 * Canonical, declarative definition of all 27 ForgeLoop CLI commands.
 * This is the machine source of truth for CLI option parsing, help text,
 * metadata, documentation generation, and conformance validation.
 *
 * All value-taking long options accept both:
 *   --option value
 *   --option=value
 *
 * Boolean options reject =value syntax.
 */

/**
 * Canonical common options present on every ForgeLoop command.
 */
export const CLI_COMMON_OPTIONS = Object.freeze({
  "--path": Object.freeze({
    targetKey: "path",
    parseType: "string",
    takesValue: true,
    valueName: "directory",
    missingValueMessage: "--path requires a directory",
    description: "target project directory (default: current directory)",
  }),
  "--help": Object.freeze({
    targetKey: "help",
    parseType: "boolean",
    takesValue: false,
    aliases: ["-h"],
    description: "show this help",
  }),
  "--version": Object.freeze({
    targetKey: "version",
    parseType: "boolean",
    takesValue: false,
    aliases: ["-v"],
    description: "show the installed package version",
  }),
});

/**
 * Bootstrap options accepted before a command is discovered.
 */
export const CLI_BOOTSTRAP_OPTIONS = CLI_COMMON_OPTIONS;

export const CLI_COMMAND_DEFINITIONS = Object.freeze({
  init: Object.freeze({
    name: "init",
    category: "project-maintenance",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--dry-run": Object.freeze({ targetKey: "dryRun", parseType: "boolean", takesValue: false, description: "show planned writes without changing files" }),
    }),
    writes: [".forgeloop/*", "AGENTS.md", "CLAUDE.md", ".cursor/rules/project-loop.mdc", ".github/copilot-instructions.md"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Initializes a target project directory with ForgeLoop discovery adapters, schemas, and templates.",
  }),
  doctor: Object.freeze({
    name: "doctor",
    category: "diagnostics",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit doctor findings as JSON" }),
      "--strict": Object.freeze({ targetKey: "strict", parseType: "boolean", takesValue: false, description: "treat warnings as unhealthy" }),
      "--fix": Object.freeze({ targetKey: "fix", parseType: "boolean", takesValue: false, description: "restore missing managed template files" }),
      "--adopt": Object.freeze({ targetKey: "adopt", parseType: "string", takesValue: true, repeatable: true, valueName: "path", missingValueMessage: "--adopt requires a path", description: "preserve an existing adapter in the manifest" }),
    }),
    writes: [".forgeloop/.manifest.json"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Diagnoses project health, discovers adapters, and optionally repairs missing template files.",
  }),
  update: Object.freeze({
    name: "update",
    category: "project-maintenance",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--dry-run": Object.freeze({ targetKey: "dryRun", parseType: "boolean", takesValue: false, description: "show planned writes without changing files" }),
    }),
    writes: [".forgeloop/*", "AGENTS.md", "CLAUDE.md", ".cursor/rules/project-loop.mdc", ".github/copilot-instructions.md"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Updates installed templates, discovery adapters, and canonical engineering guides to the latest version.",
  }),
  activate: Object.freeze({
    name: "activate",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/session.json"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Emits an active session marker recording sessionId and activationMarker.",
  }),
  route: Object.freeze({
    name: "route",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--work": Object.freeze({ targetKey: "work", parseType: "string", takesValue: true, valueName: "type", missingValueMessage: "--work requires a type", description: "declared work type" }),
      "--surface": Object.freeze({ targetKey: "surfaces", parseType: "string", takesValue: true, valueName: "value", repeatable: true, missingValueMessage: "--surface requires a value", description: "affected surface" }),
      "--risk": Object.freeze({ targetKey: "risks", parseType: "string", takesValue: true, valueName: "value", repeatable: true, missingValueMessage: "--risk requires a value", description: "task risk" }),
      "--platform": Object.freeze({ targetKey: "platforms", parseType: "string", takesValue: true, valueName: "value", repeatable: true, missingValueMessage: "--platform requires a value", description: "affected platform" }),
      "--behavior-change": Object.freeze({ targetKey: "behaviorChange", parseType: "boolean", takesValue: false, description: "declare behavior change" }),
      "--executable-change": Object.freeze({ targetKey: "executableChange", parseType: "boolean", takesValue: false, description: "declare executable/configuration change" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit route result as JSON" }),
    }),
    writes: [".forgeloop/routing-result.json"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Evaluates task characteristics and deterministically routes required engineering guides.",
  }),
  preflight: Object.freeze({
    name: "preflight",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--strict": Object.freeze({ targetKey: "strict", parseType: "boolean", takesValue: false, description: "require strict protocol compliance" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/preflight.json", ".forgeloop/work-state.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Evaluates pre-implementation contract, routing, and gates; synchronizes work state when READY.",
  }),
  advance: Object.freeze({
    name: "advance",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--to": Object.freeze({ targetKey: "to", parseType: "string", takesValue: true, valueName: "phase", missingValueMessage: "--to requires a phase", description: "destination workflow phase" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/work-state.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Transitions the canonical lifecycle work state to an allowed target phase.",
  }),
  next: Object.freeze({
    name: "next",
    category: "lifecycle",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Returns deterministic next-action guidance and command recommendations based on active state.",
  }),
  continuity: Object.freeze({
    name: "continuity",
    category: "continuity",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Reads and displays current cross-harness continuity handoff notes.",
  }),
  "record-continuity": Object.freeze({
    name: "record-continuity",
    category: "continuity",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--focus-id": Object.freeze({ targetKey: "continuityFocusId", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--focus-id requires a value", description: "current implementation focus ID" }),
      "--focus-summary": Object.freeze({ targetKey: "continuityFocusSummary", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--focus-summary requires a value", description: "current implementation focus summary" }),
      "--remaining": Object.freeze({ targetKey: "continuityRemaining", parseType: "string", takesValue: true, valueName: "id:summary", repeatable: true, missingValueMessage: "--remaining requires a value", description: "remaining implementation item" }),
      "--known-issue": Object.freeze({ targetKey: "continuityKnownIssues", parseType: "string", takesValue: true, valueName: "id:summary", repeatable: true, missingValueMessage: "--known-issue requires a value", description: "known implementation issue" }),
      "--changed-area": Object.freeze({ targetKey: "continuityChangedAreas", parseType: "string", takesValue: true, valueName: "path", repeatable: true, missingValueMessage: "--changed-area requires a value", description: "changed project area" }),
      "--inspect-first": Object.freeze({ targetKey: "continuityInspectFirst", parseType: "string", takesValue: true, valueName: "path", repeatable: true, missingValueMessage: "--inspect-first requires a value", description: "suggested inspection path" }),
      "--resume-note": Object.freeze({ targetKey: "continuityResumeNote", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--resume-note requires a value", description: "bounded operational resume note" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/continuity.json"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Persists cross-harness operational continuity handoff notes bound to current state fingerprints.",
  }),
  "reconcile-continuity": Object.freeze({
    name: "reconcile-continuity",
    category: "continuity",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Reconciles continuity handoff notes with active work state and checkout state.",
  }),
  "clear-continuity": Object.freeze({
    name: "clear-continuity",
    category: "continuity",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [".forgeloop/continuity.json"],
    mayExecuteExternalProcess: false,
    description: "Removes .forgeloop/continuity.json without affecting lifecycle work state.",
  }),
  "prepare-completion": Object.freeze({
    name: "prepare-completion",
    category: "verification",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/execution-receipt.json"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Initializes execution-receipt.json with empty requirement evidence slots for the active cycle.",
  }),
  "run-check": Object.freeze({
    name: "run-check",
    category: "verification",
    mutation: "EXTERNAL_EXECUTION",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--id": Object.freeze({ targetKey: "checkId", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--id requires a check ID", description: "stable check identifier" }),
      "--requirement": Object.freeze({ targetKey: "checkRequirement", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--requirement requires an evidence target", description: "completion requirement covered by the check" }),
      "--details": Object.freeze({ targetKey: "checkDetails", parseType: "json-object", takesValue: true, valueName: "json", missingValueMessage: "--details requires a JSON object", description: "additional structured check details" }),
      "--": Object.freeze({ targetKey: "commandArgv", parseType: "argv", takesValue: true, valueName: "argv...", description: "exact command argv to classify, execute, and attest" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/executions/exec-<id>.json", ".forgeloop/work-state.json", ".forgeloop/execution-receipt.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: true,
    description: "Runs an exact command, records the execution provenance artifact, and binds observed check evidence.",
  }),
  "record-check": Object.freeze({
    name: "record-check",
    category: "verification",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--id": Object.freeze({ targetKey: "checkId", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--id requires a check ID", description: "stable check identifier" }),
      "--requirement": Object.freeze({ targetKey: "checkRequirement", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--requirement requires an evidence target", description: "completion requirement covered by the check" }),
      "--kind": Object.freeze({ targetKey: "checkKind", parseType: "string", takesValue: true, valueName: "kind", missingValueMessage: "--kind requires a check kind", description: "check kind (default: command; use manual-review for manual evidence)" }),
      "--status": Object.freeze({ targetKey: "checkStatus", parseType: "string", takesValue: true, valueName: "status", missingValueMessage: "--status requires a check status", description: "passed, failed, blocked, or not-run" }),
      "--evidence-kind": Object.freeze({ targetKey: "checkEvidenceKind", parseType: "string", takesValue: true, valueName: "kind", missingValueMessage: "--evidence-kind requires an evidence kind", description: "OBSERVED, INFERRED, NOT_VERIFIED, or BLOCKED" }),
      "--command": Object.freeze({ targetKey: "checkCommand", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--command requires recorded text", description: "recorded only as metadata; it is never executed" }),
      "--result": Object.freeze({ targetKey: "checkResult", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--result requires recorded text", description: "observed result supplied by the actor" }),
      "--exit-code": Object.freeze({ targetKey: "checkExitCode", parseType: "non-negative-integer", takesValue: true, valueName: "number", missingValueMessage: "--exit-code requires a non-negative integer", description: "observed process exit code" }),
      "--execution-ref": Object.freeze({ targetKey: "checkExecutionRef", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--execution-ref requires an execution ID", description: "ForgeLoop execution artifact reference" }),
      "--provenance": Object.freeze({ targetKey: "checkProvenance", parseType: "string", takesValue: true, valueName: "value", missingValueMessage: "--provenance requires a provenance value", description: "FORGELOOP_EXECUTED, ACTOR_REPORTED, or MANUAL_OBSERVATION" }),
      "--details": Object.freeze({ targetKey: "checkDetails", parseType: "json-object", takesValue: true, valueName: "json", missingValueMessage: "--details requires a JSON object", description: "additional structured check details" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/work-state.json", ".forgeloop/execution-receipt.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Records structured verification evidence (command, manual review, or test output) against a requirement.",
  }),
  "record-terminal-result": Object.freeze({
    name: "record-terminal-result",
    category: "verification",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--requirement": Object.freeze({ targetKey: "checkRequirement", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--requirement requires an evidence target", description: "terminal requirement covered by the result" }),
      "--type": Object.freeze({ targetKey: "checkType", parseType: "string", takesValue: true, valueName: "type", missingValueMessage: "--type requires a terminal type", description: "PUBLICATION or PRODUCTION_READINESS" }),
      "--status": Object.freeze({ targetKey: "checkStatus", parseType: "string", takesValue: true, valueName: "status", missingValueMessage: "--status requires a check status", description: "observed terminal status" }),
      "--source": Object.freeze({ targetKey: "checkSource", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--source requires recorded text", description: "external action source (e.g. npm publish, git push)" }),
      "--result": Object.freeze({ targetKey: "checkResult", parseType: "string", takesValue: true, valueName: "text", missingValueMessage: "--result requires recorded text", description: "observed external result description" }),
      "--details": Object.freeze({ targetKey: "checkDetails", parseType: "json-object", takesValue: true, valueName: "json", missingValueMessage: "--details requires a JSON object", description: "additional structured result details" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/work-state.json", ".forgeloop/execution-receipt.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Records external terminal result evidence (PUBLICATION or PRODUCTION_READINESS) into receipt.",
  }),
  complete: Object.freeze({
    name: "complete",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--strict": Object.freeze({ targetKey: "strict", parseType: "boolean", takesValue: false, description: "require strict protocol compliance" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [".forgeloop/work-state.json", ".forgeloop/events.ndjson"],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Evaluates verification receipt coverage, gates, and ledger integrity to authorize task completion.",
  }),
  audit: Object.freeze({
    name: "audit",
    category: "verification",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--strict": Object.freeze({ targetKey: "strict", parseType: "boolean", takesValue: false, description: "require strict protocol compliance" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Performs read-only evaluation of verification receipt coverage and gate satisfaction.",
  }),
  report: Object.freeze({
    name: "report",
    category: "verification",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--strict": Object.freeze({ targetKey: "strict", parseType: "boolean", takesValue: false, description: "require strict protocol compliance" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Emits a human-readable or structured JSON summary report of protocol state.",
  }),
  policy: Object.freeze({
    name: "policy",
    category: "policy-audit",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "<name>": Object.freeze({ targetKey: "policy", parseType: "string", takesValue: true, isPositional: true, valueName: "name", description: "policy pack name" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Evaluates active task state against named enterprise policy packs.",
  }),
  bundle: Object.freeze({
    name: "bundle",
    category: "policy-audit",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--task": Object.freeze({ targetKey: "task", parseType: "string", takesValue: true, valueName: "id", missingValueMessage: "--task requires an ID", description: "task ID to export as a portable bundle" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Exports current task artifacts into a portable task bundle archive.",
  }),
  inspect: Object.freeze({
    name: "inspect",
    category: "diagnostics",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--contract-file": Object.freeze({ targetKey: "contractFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--contract-file requires a path", description: "current JSON contract used for freshness comparison" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Inspects target repository health, dirty files, active branch, and artifact freshness.",
  }),
  status: Object.freeze({
    name: "status",
    category: "diagnostics",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--contract-file": Object.freeze({ targetKey: "contractFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--contract-file requires a path", description: "current JSON contract used for freshness comparison" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Displays current lifecycle phase, active checks, blockers, and artifact freshness bindings.",
  }),
  "validate-state": Object.freeze({
    name: "validate-state",
    category: "diagnostics",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Validates schema adherence and internal consistency of work-state.json.",
  }),
  "clear-state": Object.freeze({
    name: "clear-state",
    category: "lifecycle",
    mutation: "MUTATING",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [".forgeloop/work-state.json"],
    mayExecuteExternalProcess: false,
    description: "Removes .forgeloop/work-state.json only, preserving sibling contract, routing, and ledger files.",
  }),
  "validate-receipt": Object.freeze({
    name: "validate-receipt",
    category: "verification",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--file": Object.freeze({ targetKey: "file", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--file requires a path", description: "receipt file relative to target" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Validates schema conformance and cryptographic bounds of an execution receipt file.",
  }),
  "validate-protocol": Object.freeze({
    name: "validate-protocol",
    category: "diagnostics",
    mutation: "READ_ONLY",
    options: Object.freeze({
      ...CLI_COMMON_OPTIONS,
      "--contract-file": Object.freeze({ targetKey: "contractFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--contract-file requires a path", description: "current JSON contract used for freshness comparison" }),
      "--route-file": Object.freeze({ targetKey: "routeFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--route-file requires a path", description: "routing-result JSON relative to target" }),
      "--state-file": Object.freeze({ targetKey: "stateFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--state-file requires a path", description: "work-state JSON relative to target" }),
      "--receipt-file": Object.freeze({ targetKey: "receiptFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--receipt-file requires a path", description: "execution-receipt JSON relative to target" }),
      "--continuity-file": Object.freeze({ targetKey: "continuityFile", parseType: "string", takesValue: true, valueName: "path", missingValueMessage: "--continuity-file requires a path", description: "optional execution-continuity JSON relative to target" }),
      "--task-brief-file": Object.freeze({ targetKey: "taskBriefFiles", parseType: "string", takesValue: true, valueName: "path", repeatable: true, missingValueMessage: "--task-brief-file requires a path", description: "task brief JSON file" }),
      "--delegated-result-file": Object.freeze({ targetKey: "delegatedResultFiles", parseType: "string", takesValue: true, valueName: "path", repeatable: true, missingValueMessage: "--delegated-result-file requires a path", description: "delegated result JSON file" }),
      "--json": Object.freeze({ targetKey: "json", parseType: "boolean", takesValue: false, description: "emit structured output as JSON" }),
    }),
    writes: [],
    removes: [],
    mayExecuteExternalProcess: false,
    description: "Validates end-to-end cryptographic freshness, fingerprint bindings, and ledger integrity.",
  }),
});

/**
 * Builds an option lookup map for a given command or bootstrap options, resolving aliases to canonical options.
 * Excludes positional definitions so pseudo-options never enter flag lookup.
 * @param {string|null} command - Command name, or null for bootstrap options
 * @returns {Map<string, { canonicalName: string, optionDef: Object }>}
 */
export function buildOptionLookup(command = null) {
  const definition = command ? CLI_COMMAND_DEFINITIONS[command] : { options: CLI_BOOTSTRAP_OPTIONS };
  if (!definition) return new Map();

  const lookup = new Map();
  for (const [canonicalName, optionDef] of Object.entries(definition.options)) {
    if (optionDef.isPositional) {
      continue;
    }
    lookup.set(canonicalName, { canonicalName, optionDef });
    for (const alias of optionDef.aliases ?? []) {
      lookup.set(alias, { canonicalName, optionDef });
    }
  }
  return lookup;
}

/**
 * Gets positional parameter definitions for a command.
 * @param {string} command - Command name
 * @returns {Array<Object>} List of positional option definitions
 */
export function getPositionalDefinitions(command) {
  const definition = CLI_COMMAND_DEFINITIONS[command];
  if (!definition) return [];

  return Object.entries(definition.options)
    .filter(([, optDef]) => optDef.isPositional)
    .map(([name, optDef]) => ({ name, ...optDef }));
}
