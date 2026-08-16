import { PROTOCOL_VERSION } from "./protocol.js";
import { sha256 } from "./manifest.js";

export const NEXT_ACTIONS = Object.freeze({
  DISCOVER: "DISCOVER",
  CREATE_CONTRACT: "CREATE_CONTRACT",
  ROUTE: "ROUTE",
  SATISFY_GATES: "SATISFY_GATES",
  RUN_PREFLIGHT: "RUN_PREFLIGHT",
  PLAN: "PLAN",
  START_EXECUTION: "START_EXECUTION",
  ENTER_VERIFYING: "ENTER_VERIFYING",
  CONTINUE_IMPLEMENTATION: "CONTINUE_IMPLEMENTATION",
  RECORD_VERIFICATION: "RECORD_VERIFICATION",
  DIAGNOSE: "DIAGNOSE",
  CORRECT: "CORRECT",
  ENTER_REVIEWING: "ENTER_REVIEWING",
  RECORD_TERMINAL_RESULT: "RECORD_TERMINAL_RESULT",
  PREPARE_COMPLETION: "PREPARE_COMPLETION",
  RUN_COMPLETE: "RUN_COMPLETE",
  RESOLVE_STALE_ROUTE: "RESOLVE_STALE_ROUTE",
  RESOLVE_BLOCKER: "RESOLVE_BLOCKER",
  NONE: "NONE",
});

export function result({
  taskId = "unknown",
  currentPhase = "RECEIVED",
  nextAction,
  reasons = [],
  commands = [],
  commandSpecs = [],
  requiredArtifacts = [],
  missingArtifacts = [],
}) {
  const normalizedReasons = reasons
    .map((reason) => ({
      code: reason.code ?? "E_NEXT_ACTION_BLOCKED",
      message: reason.message ?? String(reason),
      artifacts: uniqueSorted(reason.artifacts ?? []),
    }))
    .sort((left, right) => left.code.localeCompare(right.code)
      || left.artifacts.join("\0").localeCompare(right.artifacts.join("\0"))
      || left.message.localeCompare(right.message));

  return {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    taskId,
    currentPhase,
    nextAction,
    terminal: nextAction === NEXT_ACTIONS.NONE,
    reasonCodes: uniqueSorted(normalizedReasons.map((reason) => reason.code)),
    reasons: normalizedReasons,
    commands: uniqueSorted(commands),
    commandSpecs: [...new Map(commandSpecs.map((spec) => [JSON.stringify(spec), spec])).values()]
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    requiredArtifacts: uniqueSorted(requiredArtifacts),
    missingArtifacts: uniqueSorted(missingArtifacts),
  };
}

export function commandFor(action) {
  return {
    [NEXT_ACTIONS.PLAN]: "forgeloop advance --to PLANNED",
    [NEXT_ACTIONS.RUN_PREFLIGHT]: "forgeloop preflight --json",
    [NEXT_ACTIONS.START_EXECUTION]: "forgeloop advance --to EXECUTING",
    [NEXT_ACTIONS.ENTER_VERIFYING]: "forgeloop advance --to VERIFYING",
    [NEXT_ACTIONS.DIAGNOSE]: "forgeloop advance --to DIAGNOSING",
    [NEXT_ACTIONS.CORRECT]: "forgeloop advance --to CORRECTING",
    [NEXT_ACTIONS.ENTER_REVIEWING]: "forgeloop advance --to REVIEWING",
    [NEXT_ACTIONS.RECORD_TERMINAL_RESULT]: "forgeloop record-terminal-result",
    [NEXT_ACTIONS.PREPARE_COMPLETION]: "forgeloop prepare-completion --json",
    [NEXT_ACTIONS.RUN_COMPLETE]: "forgeloop complete --json",
  }[action];
}

export function recordCheckCommandSpec(requirement) {
  const checkId = `requirement-${sha256(Buffer.from(requirement)).slice(0, 16)}`;
  return {
    commandId: "record-check",
    executable: "forgeloop",
    subcommand: "record-check",
    argv: ["record-check", `--id=${checkId}`, `--requirement=${requirement}`],
    requiredInputs: [
      { name: "status", option: "--status=<passed|failed|blocked|not-run>" },
      { name: "evidenceKind", option: "--evidence-kind=<OBSERVED|INFERRED|NOT_VERIFIED|BLOCKED>" },
      { name: "result", option: "--result=<text>" },
      { name: "exitCode", option: "--exit-code=<number>", optional: true },
    ],
  };
}

export function recordTerminalResultCommandSpec(requirement) {
  const reqId = requirement.id ?? requirement;
  const type = requirement.type ?? "PUBLICATION";
  const status = requirement.requiredPublicationStatus ?? (type === "PUBLICATION" ? "published" : "ready");
  return {
    commandId: "record-terminal-result",
    executable: "forgeloop",
    subcommand: "record-terminal-result",
    argv: ["record-terminal-result", `--requirement=${reqId}`, `--type=${type}`, `--status=${status}`],
    requiredInputs: [
      { name: "source", option: "--source=<text>" },
      { name: "result", option: "--result=<text>" },
      { name: "details", option: "--details=<json>", optional: true },
    ],
  };
}

export function decision(input, action, reason, requiredArtifacts = [], missingArtifacts = []) {
  const command = commandFor(action);
  return result({
    ...input,
    nextAction: action,
    reasons: [reason],
    ...(command ? { commands: [command] } : {}),
    requiredArtifacts,
    missingArtifacts,
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export { uniqueSorted };
