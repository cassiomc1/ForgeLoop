#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

EXPECTED_HEAD = "7430f378cc04b9d960df7f677c224afdb00be3a4"
ROOT = Path.cwd()
PAYLOAD = Path(__file__).resolve().parent / "payload"


def die(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def read(path: str) -> str:
    p = ROOT / path
    if not p.is_file():
        die(f"missing expected file: {path}")
    return p.read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        die(f"{path}: expected replacement anchor exactly once, found {count}")
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith("\n"):
        text += "\n"
    write(path, text + "\n" + block.strip() + "\n")


def copy_payload() -> None:
    for source in PAYLOAD.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(PAYLOAD)
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and destination.read_bytes() == source.read_bytes():
            continue
        shutil.copy2(source, destination)


def git_head() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return None


def patch_core() -> None:
    replace_once(
        "src/core/artifacts.js",
        '  state: ".forgeloop/work-state.json",\n  receipt: ".forgeloop/execution-receipt.json",',
        '  state: ".forgeloop/work-state.json",\n  continuity: ".forgeloop/continuity.json",\n  receipt: ".forgeloop/execution-receipt.json",',
    )
    replace_once(
        "src/core/schema-validation.js",
        '  "work-state",\n  "execution-receipt",',
        '  "work-state",\n  "continuity",\n  "execution-receipt",',
    )
    replace_once(
        "src/core/templates.js",
        '  "schemas/work-state.schema.json",\n  "schemas/execution-receipt.schema.json",',
        '  "schemas/work-state.schema.json",\n  "schemas/continuity.schema.json",\n  "schemas/execution-receipt.schema.json",',
    )
    replace_once(
        "src/core/protocol.js",
        '  "E_VERIFICATION_TOOL_UNAVAILABLE",\n]);',
        '  "E_VERIFICATION_TOOL_UNAVAILABLE",\n'
        '  "E_CONTINUITY_INVALID",\n'
        '  "E_CONTINUITY_SCHEMA_UNSUPPORTED",\n'
        '  "E_CONTINUITY_STATE_MISSING",\n'
        '  "E_CONTINUITY_TASK_MISMATCH",\n'
        '  "E_CONTINUITY_CONTRACT_MISMATCH",\n'
        '  "E_CONTINUITY_PHASE_MISMATCH",\n'
        '  "E_CONTINUITY_RECONCILIATION_REQUIRED",\n]);',
    )
    replace_once(
        "src/core/next-action-model.js",
        '  ENTER_VERIFYING: "ENTER_VERIFYING",\n  RECORD_VERIFICATION: "RECORD_VERIFICATION",',
        '  ENTER_VERIFYING: "ENTER_VERIFYING",\n  CONTINUE_IMPLEMENTATION: "CONTINUE_IMPLEMENTATION",\n  RECORD_VERIFICATION: "RECORD_VERIFICATION",',
    )
    replace_once(
        "src/core/next-action.js",
        'import { PHASES_REQUIRING_EXECUTION_CHRONOLOGY } from "./next-action-phases.js";\n',
        'import { PHASES_REQUIRING_EXECUTION_CHRONOLOGY } from "./next-action-phases.js";\n'
        'import { evaluateContinuityNextAction } from "./next-action-continuity.js";\n',
    )
    replace_once(
        "src/core/next-action.js",
        '  if (state.phase === "EXECUTING") {\n'
        '    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_EXECUTING", "Execution is complete enough to enter verification"));\n'
        '  }',
        '  if (state.phase === "EXECUTING") {\n'
        '    const continuityAction = await evaluateContinuityNextAction({ target, packageRoot, context });\n'
        '    if (continuityAction) return continuityAction;\n'
        '    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_EXECUTING", "Execution is complete enough to enter verification"));\n'
        '  }',
    )


def patch_status_and_inspect() -> None:
    replace_once(
        "src/commands/status.js",
        'import { inspectSchemaHealth } from "../core/schema-validation.js";\n',
        'import { inspectSchemaHealth } from "../core/schema-validation.js";\n'
        'import { reconcileContinuity } from "../core/continuity-reconciliation.js";\n',
    )
    replace_once(
        "src/commands/status.js",
        '  const protocol = await inspectSchemaHealth(target);\n  return {\n    ...state,\n    protocol,',
        '  const [protocol, continuity] = await Promise.all([\n'
        '    inspectSchemaHealth(target),\n'
        '    reconcileContinuity({ target, packageRoot }),\n'
        '  ]);\n'
        '  return {\n    ...state,\n    protocol,\n    continuity,',
    )
    replace_once(
        "src/commands/status.js",
        '  if (result.protocol) lines.push(`Schemas: ${result.protocol.status}`);\n  if (result.error) lines.push(`Error: ${result.error}`);',
        '  if (result.protocol) lines.push(`Schemas: ${result.protocol.status}`);\n'
        '  if (result.continuity) {\n'
        '    const continuity = result.continuity.continuity;\n'
        '    lines.push(`Continuity: ${result.continuity.classification}`);\n'
        '    lines.push(`Continuity focus: ${continuity?.currentFocus?.id ?? "none"}`);\n'
        '    lines.push(`Continuity remaining: ${continuity?.remainingWork?.length ?? 0}`);\n'
        '    lines.push(`Continuity known issues: ${continuity?.knownIssues?.length ?? 0}`);\n'
        '    lines.push(`Continuity authority: ${result.continuity.authority ?? "OPERATIONAL_CONTEXT_ONLY"}`);\n'
        '  }\n'
        '  if (result.error) lines.push(`Error: ${result.error}`);',
    )
    replace_once(
        "src/core/inspect.js",
        'import { trustedAuthorityConfiguration } from "./trusted-authority.js";\n',
        'import { trustedAuthorityConfiguration } from "./trusted-authority.js";\n'
        'import { reconcileContinuity } from "./continuity-reconciliation.js";\n'
        'import { continuityFinding, continuityIsHealthy } from "./continuity-observability.js";\n',
    )
    replace_once(
        "src/core/inspect.js",
        '  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile });\n  const schemaRoot =',
        '  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile });\n'
        '  const continuity = await reconcileContinuity({ target, packageRoot });\n'
        '  const schemaRoot =',
    )
    replace_once(
        "src/core/inspect.js",
        '  if (state.status === "INVALID") {\n',
        '  const continuityIssue = continuityFinding(continuity);\n'
        '  if (continuityIssue) findings.push(continuityIssue);\n\n'
        '  if (state.status === "INVALID") {\n',
    )
    replace_once(
        "src/core/inspect.js",
        '    state: { ...state, path: WORK_STATE_PATH, present: statePresent },\n    compatibility:',
        '    state: { ...state, path: WORK_STATE_PATH, present: statePresent },\n    continuity,\n    compatibility:',
    )
    replace_once(
        "src/core/inspect.js",
        '      && schemaHealth.status === "valid"\n      && !["INVALID", "REVALIDATION_REQUIRED"].includes(state.status),',
        '      && schemaHealth.status === "valid"\n'
        '      && !["INVALID", "REVALIDATION_REQUIRED"].includes(state.status)\n'
        '      && continuityIsHealthy(continuity),',
    )


def patch_conformance_and_bundle() -> None:
    replace_once(
        "src/core/conformance.js",
        'import { canonicalFingerprint } from "./artifacts.js";\n',
        'import { canonicalFingerprint } from "./artifacts.js";\n'
        'import { evaluateContinuityConformance } from "./continuity-conformance.js";\n',
    )
    replace_once(
        "src/core/conformance.js",
        '  delegatedResults = [],\n  events = [],\n} = {}) {\n  const errors = [];\n  const incomplete = [];',
        '  delegatedResults = [],\n  events = [],\n  continuity = null,\n  continuityContext = {},\n} = {}) {\n'
        '  const errors = [];\n  const incomplete = [];\n'
        '  const continuityResult = evaluateContinuityConformance({ continuity, state, ...continuityContext });\n'
        '  errors.push(...continuityResult.errors);',
    )
    replace_once(
        "src/core/conformance.js",
        '  if (sortedErrors.some((item) => item.code === "UNSUPPORTED_PROTOCOL_VERSION")) {\n    status = "INVALID";\n  } else if (sortedErrors.length > 0) {\n    status = "INCONSISTENT";\n  } else if (stateClassification?.status === "REVALIDATION_REQUIRED") {\n    status = "STALE";',
        '  if (sortedErrors.some((item) => item.code === "UNSUPPORTED_PROTOCOL_VERSION") || continuityResult.status === "INVALID") {\n'
        '    status = "INVALID";\n'
        '  } else if (sortedErrors.length > 0) {\n'
        '    status = "INCONSISTENT";\n'
        '  } else if (stateClassification?.status === "REVALIDATION_REQUIRED" || continuityResult.status === "STALE") {\n'
        '    status = "STALE";',
    )
    replace_once(
        "src/core/conformance.js",
        '    delegation,\n    evidence: [createEvidence({',
        '    delegation,\n    continuity: continuityResult,\n    evidence: [createEvidence({',
    )

    replace_once(
        "src/core/bundles.js",
        'import { readExecutionArtifact } from "./execution.js";\n',
        'import { readExecutionArtifact } from "./execution.js";\n'
        'import { assertContinuitySemantics } from "./continuity.js";\n',
    )
    replace_once(
        "src/core/bundles.js",
        '    [ARTIFACT_PATHS.config, "config.json", "config"],\n  ];',
        '    [ARTIFACT_PATHS.config, "config.json", "config"],\n'
        '    [ARTIFACT_PATHS.continuity, "continuity.json", "continuity"],\n  ];',
    )
    replace_once(
        "src/core/bundles.js",
        '    "config.json": ["config", "config"],\n  };',
        '    "config.json": ["config", "config"],\n'
        '    "continuity.json": ["continuity", "continuity"],\n  };',
    )
    replace_once(
        "src/core/bundles.js",
        '    if (mapping[1] === "current-contract") {\n      await validateContract(loadedArtifact.value, packageRoot);\n    }\n    loaded[mapping[0]] = loadedArtifact.value;',
        '    if (mapping[1] === "current-contract") {\n'
        '      await validateContract(loadedArtifact.value, packageRoot);\n'
        '    }\n'
        '    if (mapping[1] === "continuity") {\n'
        '      assertContinuitySemantics(loadedArtifact.value);\n'
        '    }\n'
        '    loaded[mapping[0]] = loadedArtifact.value;',
    )


def patch_validate_protocol() -> None:
    replace_once(
        "src/commands/validate-protocol.js",
        'import { validateChecksExecutionProvenance } from "../core/completion-artifacts.js";\n',
        'import { validateChecksExecutionProvenance } from "../core/completion-artifacts.js";\n'
        'import { assertContinuitySemantics } from "../core/continuity.js";\n'
        'import { currentChangedPaths, currentRepositoryFingerprint } from "../core/repository.js";\n',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '  contractFile = null,\n  taskBriefFiles = [],',
        '  contractFile = null,\n  continuityFile = null,\n  taskBriefFiles = [],',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '    ["receipt", receiptFile],\n    ...taskBriefFiles.map',
        '    ["receipt", receiptFile],\n    ["continuity", continuityFile],\n    ...taskBriefFiles.map',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '  const receipt = loaded.find((item) => item.label === "receipt")?.value ?? null;\n  const taskBriefs =',
        '  const receipt = loaded.find((item) => item.label === "receipt")?.value ?? null;\n'
        '  const continuity = loaded.find((item) => item.label === "continuity")?.value ?? null;\n'
        '  const taskBriefs =',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '  await validateLoaded(loaded.find((item) => item.label === "receipt"), "execution-receipt", async (value) => validateReceipt(value, packageRoot));\n  for (const [value, artifactPath] of [',
        '  await validateLoaded(loaded.find((item) => item.label === "receipt"), "execution-receipt", async (value) => validateReceipt(value, packageRoot));\n'
        '  await validateLoaded(loaded.find((item) => item.label === "continuity"), "continuity", async (value) => assertContinuitySemantics(value));\n'
        '  for (const [value, artifactPath] of [',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '  const result = validateTaskArtifactSet({\n    route,\n    state,\n    stateClassification,\n    receipt,',
        '  const continuityContext = continuity && state && !stateValidationError\n'
        '    ? {\n'
        '      contractFingerprint: state.contractFingerprint,\n'
        '      repositoryFingerprint: await currentRepositoryFingerprint(target),\n'
        '      changedPaths: await currentChangedPaths(target),\n'
        '    }\n'
        '    : {};\n'
        '  const result = validateTaskArtifactSet({\n'
        '    route,\n    state,\n    stateClassification,\n    receipt,\n'
        '    continuity,\n    continuityContext,',
    )
    replace_once(
        "src/commands/validate-protocol.js",
        '  if (result.stale) {\n',
        '  if (result.continuity) {\n'
        '    lines.push(`Continuity: ${result.continuity.status}`);\n'
        '    lines.push(`Continuity authority: ${result.continuity.authority}`);\n'
        '  }\n'
        '  if (result.stale) {\n',
    )


def patch_cli() -> None:
    replace_once(
        "src/cli.js",
        'import { formatNextActionResult, runNext } from "./commands/next.js";\n',
        'import { formatNextActionResult, runNext } from "./commands/next.js";\n'
        'import { formatContinuityResult, runContinuity } from "./commands/continuity.js";\n'
        'import { formatRecordContinuityResult, runRecordContinuity } from "./commands/record-continuity.js";\n'
        'import { formatReconcileContinuityResult, runReconcileContinuity } from "./commands/reconcile-continuity.js";\n'
        'import { formatClearContinuityResult, runClearContinuity } from "./commands/clear-continuity.js";\n'
        'import { continuityOptionDefaults, consumeContinuityOption, validateContinuityOptions } from "./core/continuity-cli-options.js";\n',
    )
    replace_once(
        "src/cli.js",
        '  "next",\n  "prepare-completion",',
        '  "next",\n  "continuity",\n  "record-continuity",\n  "reconcile-continuity",\n  "clear-continuity",\n  "prepare-completion",',
    )
    replace_once(
        "src/cli.js",
        '  if (!command || command === "advance") {\n    options.push("  --to <phase>        destination workflow phase");\n  }',
        '  if (!command || command === "advance") {\n'
        '    options.push("  --to <phase>        destination workflow phase");\n'
        '  }\n'
        '  if (!command || command === "record-continuity") {\n'
        '    options.push("  --focus-id <id>            current implementation focus ID");\n'
        '    options.push("  --focus-summary <text>    current implementation focus summary");\n'
        '    options.push("  --remaining <id:summary>  remaining implementation item (repeatable)");\n'
        '    options.push("  --known-issue <id:summary> known implementation issue (repeatable)");\n'
        '    options.push("  --changed-area <path>     changed project area (repeatable)");\n'
        '    options.push("  --inspect-first <path>    suggested inspection path (repeatable)");\n'
        '    options.push("  --resume-note <text>      bounded operational resume note");\n'
        '  }',
    )
    replace_once(
        "src/cli.js",
        '    options.push("  --receipt-file <path>  execution-receipt JSON relative to target");\n',
        '    options.push("  --receipt-file <path>  execution-receipt JSON relative to target");\n'
        '    options.push("  --continuity-file <path>  optional execution-continuity JSON relative to target");\n',
    )
    replace_once(
        "src/cli.js",
        '    receiptFile: null,\n    taskBriefFiles: [],',
        '    receiptFile: null,\n    continuityFile: null,\n    ...continuityOptionDefaults(),\n    taskBriefFiles: [],',
    )
    replace_once(
        "src/cli.js",
        '} else if (["--route-file", "--state-file", "--receipt-file"].includes(argument)) {',
        '} else if (["--route-file", "--state-file", "--receipt-file", "--continuity-file"].includes(argument)) {',
    )
    replace_once(
        "src/cli.js",
        '      if (argument === "--receipt-file") options.receiptFile = file;\n      index += 1;',
        '      if (argument === "--receipt-file") options.receiptFile = file;\n'
        '      if (argument === "--continuity-file") options.continuityFile = file;\n'
        '      index += 1;',
    )
    replace_once(
        "src/cli.js",
        '    } else if (argument === "--path") {\n',
        '    } else if ([\n'
        '      "--focus-id",\n      "--focus-summary",\n      "--remaining",\n      "--known-issue",\n'
        '      "--changed-area",\n      "--inspect-first",\n      "--resume-note",\n    ].includes(argument)) {\n'
        '      const consumed = consumeContinuityOption({ argument, argv, index, options });\n'
        '      index = consumed.index;\n'
        '    } else if (argument === "--path") {\n',
    )
    replace_once(
        "src/cli.js",
        '  const jsonCommands = ["doctor", "route", "activate", "advance", "next", "prepare-completion",',
        '  const jsonCommands = ["doctor", "route", "activate", "advance", "next", "continuity", "record-continuity", "reconcile-continuity", "clear-continuity", "prepare-completion",',
    )
    replace_once(
        "src/cli.js",
        '  if (command !== "validate-protocol" && (options.routeFile || options.stateFile || options.receiptFile || options.taskBriefFiles.length > 0 || options.delegatedResultFiles.length > 0)) {',
        '  if (command !== "validate-protocol" && (options.routeFile || options.stateFile || options.receiptFile || options.continuityFile || options.taskBriefFiles.length > 0 || options.delegatedResultFiles.length > 0)) {',
    )
    replace_once(
        "src/cli.js",
        '  if (command === "record-check" && !options.help) {',
        '  validateContinuityOptions(command, options);\n'
        '  if (command === "record-check" && !options.help) {',
    )
    replace_once(
        "src/cli.js",
        '  next: async ({ target, packageRoot, options }) => {\n    const result = await runNext({ target, packageRoot });\n    console.log(options.json ? JSON.stringify(result, null, 2) : formatNextActionResult(result));\n    return 0;\n  },\n  "prepare-completion":',
        '  next: async ({ target, packageRoot, options }) => {\n'
        '    const result = await runNext({ target, packageRoot });\n'
        '    console.log(options.json ? JSON.stringify(result, null, 2) : formatNextActionResult(result));\n'
        '    return 0;\n'
        '  },\n'
        '  continuity: async ({ target, packageRoot, options }) => {\n'
        '    const result = await runContinuity({ target, packageRoot });\n'
        '    console.log(options.json ? JSON.stringify(result, null, 2) : formatContinuityResult(result));\n'
        '    return 0;\n'
        '  },\n'
        '  "record-continuity": async ({ target, packageRoot, options }) => {\n'
        '    const result = await runRecordContinuity({\n'
        '      target, packageRoot,\n'
        '      focusId: options.continuityFocusId,\n'
        '      focusSummary: options.continuityFocusSummary,\n'
        '      remaining: options.continuityRemaining,\n'
        '      knownIssues: options.continuityKnownIssues,\n'
        '      changedAreas: options.continuityChangedAreas,\n'
        '      inspectFirst: options.continuityInspectFirst,\n'
        '      resumeNote: options.continuityResumeNote,\n'
        '    });\n'
        '    console.log(options.json ? JSON.stringify(result, null, 2) : formatRecordContinuityResult(result));\n'
        '    return 0;\n'
        '  },\n'
        '  "reconcile-continuity": async ({ target, packageRoot, options }) => {\n'
        '    const result = await runReconcileContinuity({ target, packageRoot });\n'
        '    console.log(options.json ? JSON.stringify(result, null, 2) : formatReconcileContinuityResult(result));\n'
        '    return 0;\n'
        '  },\n'
        '  "clear-continuity": async ({ target, options }) => {\n'
        '    const result = await runClearContinuity({ target });\n'
        '    console.log(options.json ? JSON.stringify(result, null, 2) : formatClearContinuityResult(result));\n'
        '    return 0;\n'
        '  },\n'
        '  "prepare-completion":',
    )
    replace_once(
        "src/cli.js",
        '      contractFile: options.contractFile,\n      taskBriefFiles: options.taskBriefFiles,',
        '      contractFile: options.contractFile,\n      continuityFile: options.continuityFile,\n      taskBriefFiles: options.taskBriefFiles,',
    )


def patch_tests_and_docs() -> None:
    replace_once(
        "tests/core-module-boundaries.test.js",
        '    "src/core/next-action-phases.js",\n',
        '    "src/core/next-action-phases.js",\n    "src/core/next-action-continuity.js",\n',
    )
    append_once(
        "LOOP_ENGINEERING.md",
        "## Cross-harness execution continuity",
        '''## Cross-harness execution continuity

A change of model, provider, IDE, process, terminal, or context window does not
create a new task when a valid resumable ForgeLoop task already exists.
`work-state.json` remains the sole owner of lifecycle progress. An optional
`.forgeloop/continuity.json` may record bounded granular implementation context
such as current focus, remaining implementation work, known issues, and paths
to inspect first.

`CONTINUITY_CONTEXT_IS_NOT_EVIDENCE`: continuity may guide inspection but can
never satisfy verification coverage, publication, production readiness, or
completion. `CONTINUITY_CANNOT_GRANT_AUTHORITY`: continuity cannot authorize an
installation or external action. The receiving harness MUST reconcile
continuity against the current work state and checkout before acting on it.''',
    )
    append_once(
        "PROTOCOL_INTEGRATION.md",
        "## Harness and session continuity",
        '''## Harness and session continuity

Harness identity is not task identity. Session identity is not task identity.
A compatible environment reopening a resumable task SHOULD inspect the current
work state, reconcile optional execution continuity, inspect the checkout, and
continue the existing lifecycle instead of replacing the contract merely
because the executor changed.''',
    )
    append_once(
        "EXECUTION_STATE.md",
        "## Execution continuity companion",
        '''## Execution continuity companion

`.forgeloop/work-state.json` remains the canonical checkpoint and owns phase,
`completedSteps`, `pendingSteps`, failures, blockers, verification cycles, and
required artifact fingerprints. `.forgeloop/continuity.json` is an optional
companion containing only granular implementation-resume context. It is bound
to the current task, contract fingerprint, work-state fingerprint, phase, and
repository context and is always operational context rather than evidence.''',
    )
    append_once(
        "LOOP_SYSTEM_DESIGN.md",
        "## Cross-harness continuity boundary",
        '''## Cross-harness continuity boundary

Execution continuity is intentionally a companion artifact, not a second state
machine and not a general memory subsystem. Work state owns lifecycle truth;
the checkout owns implementation truth; checks/executions own verification
truth; completion owns certification. Continuity only narrows what a receiving
executor should inspect and continue.''',
    )
    append_once(
        "THREAT_MODEL.md",
        "## Stale or malicious execution continuity",
        '''## Stale or malicious execution continuity

A stale or malicious continuity artifact may claim unfinished work is complete,
point at misleading files, claim verification/publication occurred, encode
secret material, attempt path traversal, or imply authority. Mitigations are a
bounded strict schema, secret-free writes, relative safe paths, task/contract/
work-state fingerprint binding, current-checkout reconciliation, explicit
non-evidence semantics, and complete separation from authority grants.''',
    )
    append_once(
        "TERMINOLOGY.md",
        "| Execution continuity |",
        '''| Execution continuity | Bounded current-task implementation context used to resume the same ForgeLoop task across sessions or harnesses. |
| Continuity artifact | `.forgeloop/continuity.json`; non-evidence operational context bound to canonical work state. |
| Continuity reconciliation | Read-only comparison of continuity bindings and path hints against current canonical state and checkout. |''',
    )
    replace_once(
        "QUALITY_SCORECARD.md",
        '| Resume/checkpoint | Atomic local state, contract/HEAD/artifact freshness, age warning, schema/secret validation, status, safe validation, and bounded clearing without persisting derived freshness fields. |',
        '| Resume/checkpoint | Atomic local state, contract/HEAD/artifact freshness, age warning, schema/secret validation, status, safe validation, and bounded clearing without persisting derived freshness fields. |\n'
        '| Cross-harness execution continuity — structural | Optional bounded continuity artifact, task/contract/work-state binding, deterministic reconciliation, current-checkout precedence, non-evidence/non-authority semantics, next/status/inspect integration, bundle portability, and cross-process regression coverage. |\n'
        '| Cross-harness live continuity | A fresh Harness B resumes an interrupted Harness A task with no manual user summary and reaches validator-backed completion; structural coverage alone does not prove this dimension. |',
    )
    replace_once(
        "README.md",
        '## Release and maintenance\n',
        '''## Cross-harness continuity

ForgeLoop can optionally persist bounded execution-continuity context for a
resumable task so another compatible harness can reconcile the current checkout
and continue without replacing the task contract. Continuity is operational
context only; it is never verification evidence or authority. See
[`EXECUTION_STATE.md`](./EXECUTION_STATE.md) and
[`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md).

## Release and maintenance
''',
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply ForgeLoop cross-harness continuity implementation")
    parser.add_argument("--allow-drift", action="store_true", help="allow a different HEAD; exact snippet guards still apply")
    args = parser.parse_args()
    if not (ROOT / "package.json").is_file() or not (ROOT / "src/core").is_dir():
        die("run this script from the ForgeLoop repository root")
    head = git_head()
    if head and head != EXPECTED_HEAD and not args.allow_drift:
        die(f"expected HEAD {EXPECTED_HEAD}, found {head}; rerun with --allow-drift only after reviewing upstream changes")
    copy_payload()
    patch_core()
    patch_status_and_inspect()
    patch_conformance_and_bundle()
    patch_validate_protocol()
    patch_cli()
    patch_tests_and_docs()
    print("Applied ForgeLoop cross-harness continuity implementation.")
    print("Next: npm test && npm run lint && npm run coverage && npm run pack:check")
    print("Also run the existing Python validators and docs checks before merge.")


if __name__ == "__main__":
    main()
