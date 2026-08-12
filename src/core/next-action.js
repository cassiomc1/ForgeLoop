import { ARTIFACT_PATHS, readJsonArtifact } from "./artifacts.js";
import { completionIdentityErrors, evaluateCompletion } from "./completion.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
import { coverageForRequirements } from "./coverage.js";
import { readContract } from "./contract.js";
import { validateEventLedger } from "./events.js";
import { evaluatePreflight } from "./preflight.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { validateReceipt } from "./receipt.js";
import { readPersistedRoute } from "./route-artifact.js";
import { readWorkState } from "./work-state.js";

export const NEXT_ACTIONS = Object.freeze({
  DISCOVER: "DISCOVER",
  CREATE_CONTRACT: "CREATE_CONTRACT",
  ROUTE: "ROUTE",
  SATISFY_GATES: "SATISFY_GATES",
  RUN_PREFLIGHT: "RUN_PREFLIGHT",
  PLAN: "PLAN",
  START_EXECUTION: "START_EXECUTION",
  ENTER_VERIFYING: "ENTER_VERIFYING",
  RECORD_VERIFICATION: "RECORD_VERIFICATION",
  DIAGNOSE: "DIAGNOSE",
  CORRECT: "CORRECT",
  ENTER_REVIEWING: "ENTER_REVIEWING",
  PREPARE_COMPLETION: "PREPARE_COMPLETION",
  RUN_COMPLETE: "RUN_COMPLETE",
  RESOLVE_STALE_ROUTE: "RESOLVE_STALE_ROUTE",
  RESOLVE_BLOCKER: "RESOLVE_BLOCKER",
  NONE: "NONE",
});

const PHASES_REQUIRING_EXECUTION_CHRONOLOGY = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

const EXECUTION_EVENTS = Object.freeze([
  "CONTRACT_VALIDATED",
  "ROUTE_VALIDATED",
  "PREFLIGHT_READY",
  "EXECUTION_STARTED",
]);

function artifactError(code, message, artifacts = []) {
  return { code, message, artifacts };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function result({
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

function commandFor(action) {
  return {
    [NEXT_ACTIONS.PLAN]: "forgeloop advance --to PLANNED",
    [NEXT_ACTIONS.RUN_PREFLIGHT]: "forgeloop preflight --json",
    [NEXT_ACTIONS.START_EXECUTION]: "forgeloop advance --to EXECUTING",
    [NEXT_ACTIONS.ENTER_VERIFYING]: "forgeloop advance --to VERIFYING",
    [NEXT_ACTIONS.DIAGNOSE]: "forgeloop advance --to DIAGNOSING",
    [NEXT_ACTIONS.CORRECT]: "forgeloop advance --to CORRECTING",
    [NEXT_ACTIONS.ENTER_REVIEWING]: "forgeloop advance --to REVIEWING",
    [NEXT_ACTIONS.PREPARE_COMPLETION]: "forgeloop prepare-completion --json",
    [NEXT_ACTIONS.RUN_COMPLETE]: "forgeloop complete --json",
  }[action];
}

function recordCheckCommandSpec(requirement) {
  return {
    commandId: "record-check",
    executable: "forgeloop",
    subcommand: "record-check",
    argv: ["record-check", "--id", requirement, "--requirement", requirement, "--status", "passed", "--evidence-kind", "OBSERVED"],
    requiredInputs: [{
      name: "result",
      option: "--result",
      description: "Observed result supplied by the agent",
    }],
  };
}

function decision(input, action, reason, requiredArtifacts = [], missingArtifacts = []) {
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

function missingArtifact(error, fallback) {
  return error?.code === "ARTIFACT_MISSING"
    ? (error.artifacts?.length ? error.artifacts : [fallback])
    : [];
}

function savedPreflightStatus(preflightArtifact) {
  return preflightArtifact?.value?.status === "READY" ? "READY" : "NOT_READY";
}

function allCoverageCovered(coverage) {
  return coverage.every((item) => item.status === "COVERED");
}

function staleReasons(state, contract, route) {
  const reasons = [];
  if (state.contractFingerprint !== contract.fingerprint) {
    reasons.push(artifactError(
      "E_CONTRACT_STALE",
      "Work state references a different current contract",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract],
    ));
  }
  if (route.value.contractFingerprint !== undefined && route.value.contractFingerprint !== contract.fingerprint) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Routing result references a different current contract",
      [ARTIFACT_PATHS.route, ARTIFACT_PATHS.contract],
    ));
  }
  if (state.routeFingerprint !== undefined && state.routeFingerprint !== route.fingerprint) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Work state references a different routing result",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
    ));
  }
  if (JSON.stringify(state.selectedGuides) !== JSON.stringify(route.value.guides)) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Work state guides do not match the persisted routing result",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
    ));
  }
  return reasons;
}

function executionChronologyErrors(ledger, { stateTaskId, contractTaskId }) {
  const errors = [...(ledger.errors ?? [])].map((error) => artifactError(
    error.code ?? "E_PHASE_CHRONOLOGY_INVALID",
    error.message,
    [ARTIFACT_PATHS.events],
  ));
  const currentTaskId = stateTaskId === contractTaskId ? stateTaskId : null;
  const ledgerEvents = ledger.events ?? [];
  const currentEvents = currentTaskId === null
    ? []
    : ledgerEvents.filter((event) => event.taskId === currentTaskId);
  if (currentTaskId === null) {
    errors.push(artifactError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "Work state and current contract task IDs do not match",
      [ARTIFACT_PATHS.events],
    ));
  }
  if (ledgerEvents.some((event) => event.taskId !== currentTaskId)) {
    errors.push(artifactError(
      "E_PHASE_CHRONOLOGY_INVALID",
      "Protocol event ledger contains an event for a different task",
      [ARTIFACT_PATHS.events],
    ));
  }
  const events = new Set(currentEvents.map((event) => event.event));
  for (const event of EXECUTION_EVENTS) {
    if (!events.has(event)) {
      errors.push(artifactError(
        "E_PHASE_CHRONOLOGY_INVALID",
        `Required protocol event is missing: ${event}`,
        [ARTIFACT_PATHS.events],
      ));
    }
  }
  return errors;
}

async function loadArtifact(loader, fallback) {
  try {
    return { value: await loader(), error: null, missingArtifacts: [] };
  } catch (error) {
    return { value: null, error, missingArtifacts: missingArtifact(error, fallback) };
  }
}

async function requirementsAndCoverage({ target, packageRoot, contract, route, checks, additionalEvidence = [] }) {
  const requirements = await requiredEvidenceForTarget({
    target,
    contract,
    route,
    packageRoot,
    additionalEvidence,
  });
  return { requirements, coverage: coverageForRequirements(requirements, checks) };
}

export async function getNextAction({ target, packageRoot } = {}) {
  const workState = await loadArtifact(
    () => readWorkState(target, packageRoot),
    ARTIFACT_PATHS.state,
  );
  if (workState.error) {
    return decision(
      {},
      NEXT_ACTIONS.RESOLVE_BLOCKER,
      artifactError("WORK_STATE_INVALID", workState.error.message, [ARTIFACT_PATHS.state]),
      [ARTIFACT_PATHS.state],
      workState.missingArtifacts,
    );
  }
  if (!workState.value) {
    return decision(
      {},
      NEXT_ACTIONS.DISCOVER,
      artifactError("WORK_STATE_ABSENT", "No work-state checkpoint is present", [ARTIFACT_PATHS.state]),
      [ARTIFACT_PATHS.state],
      [ARTIFACT_PATHS.state],
    );
  }

  const state = workState.value;
  const context = { taskId: state.taskId, currentPhase: state.phase };
  const contractResult = await loadArtifact(
    () => readContract(target, packageRoot),
    ARTIFACT_PATHS.contract,
  );
  const routeResult = await loadArtifact(
    () => readPersistedRoute(target, packageRoot),
    ARTIFACT_PATHS.route,
  );
  const requiredArtifacts = [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract, ARTIFACT_PATHS.route];
  const missingArtifacts = [...contractResult.missingArtifacts, ...routeResult.missingArtifacts];

  if (contractResult.error || routeResult.error) {
    const errors = [contractResult.error, routeResult.error]
      .filter(Boolean)
      .map((error) => artifactError(
        error.code === "ARTIFACT_MISSING"
          ? (error === contractResult.error ? "E_CONTRACT_MISSING" : "E_ROUTE_MISSING")
          : (error === contractResult.error ? "E_CONTRACT_INVALID" : "E_ROUTE_INVALID"),
        error.message,
        error.artifacts ?? [],
      ));
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: errors,
      requiredArtifacts,
      missingArtifacts,
    });
  }

  const contract = contractResult.value;
  const route = routeResult.value;
  const identityErrors = completionIdentityErrors({ contract: contract.value, state });
  if (identityErrors.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: identityErrors,
      requiredArtifacts,
    });
  }
  const stale = staleReasons(state, contract, route);
  if (stale.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_STALE_ROUTE,
      reasons: stale,
      requiredArtifacts,
    });
  }

  const preflight = await evaluatePreflight({ target, packageRoot });
  const preflightArtifact = await loadArtifact(
    () => readJsonArtifact(target, ARTIFACT_PATHS.preflight, "preflight", packageRoot),
    ARTIFACT_PATHS.preflight,
  );
  const ledger = await validateEventLedger(target, packageRoot);
  const missingGates = preflight.requiredGates.filter((gate) => !preflight.satisfiedGates.includes(gate));
  const preflightArtifacts = [...requiredArtifacts, ARTIFACT_PATHS.preflight];
  const phaseNeedsChronology = PHASES_REQUIRING_EXECUTION_CHRONOLOGY.has(state.phase);

  if (phaseNeedsChronology && (savedPreflightStatus(preflightArtifact.value) !== "READY" || preflight.status !== "READY")) {
    return decision(
      context,
      NEXT_ACTIONS.RESOLVE_BLOCKER,
      artifactError("E_PREFLIGHT_NOT_READY", "Current phase requires a persisted READY preflight", [ARTIFACT_PATHS.preflight]),
      preflightArtifacts,
      preflightArtifact.missingArtifacts,
    );
  }

  if (phaseNeedsChronology) {
    const chronologyErrors = executionChronologyErrors(ledger, {
      stateTaskId: state.taskId,
      contractTaskId: contract.value.taskId,
    });
    if (chronologyErrors.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: chronologyErrors,
        requiredArtifacts: [...preflightArtifacts, ARTIFACT_PATHS.events],
        missingArtifacts: ledger.events.length === 0 ? [ARTIFACT_PATHS.events] : [],
      });
    }
  }

  if (state.phase === "RECEIVED") {
    return decision(context, NEXT_ACTIONS.DISCOVER, artifactError("PHASE_RECEIVED", "Discovery has not started"));
  }
  if (state.phase === "DISCOVERING") {
    return decision(context, NEXT_ACTIONS.CREATE_CONTRACT, artifactError("PHASE_DISCOVERING", "Create and validate the task contract"));
  }
  if (state.phase === "CONTRACT_READY") {
    return decision(context, NEXT_ACTIONS.ROUTE, artifactError("PHASE_CONTRACT_READY", "Persist deterministic routing for the validated contract"));
  }
  if (["ROUTED", "DESIGNING", "PLANNED"].includes(state.phase) && missingGates.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.SATISFY_GATES,
      reasons: missingGates.map((gate) => artifactError(
        "E_GATE_UNVERIFIED",
        `Required gate is missing or unverified: ${gate}`,
        [`${ARTIFACT_PATHS.gates}/${gate}.json`],
      )),
      requiredArtifacts: [...preflightArtifacts, ...missingGates.map((gate) => `${ARTIFACT_PATHS.gates}/${gate}.json`)],
      missingArtifacts: missingGates.map((gate) => `${ARTIFACT_PATHS.gates}/${gate}.json`),
    });
  }
  if (state.phase === "ROUTED") {
    if (savedPreflightStatus(preflightArtifact.value) !== "READY") {
      return decision(
        context,
        NEXT_ACTIONS.RUN_PREFLIGHT,
        artifactError("E_PREFLIGHT_NOT_READY", "A persisted READY preflight is required before planning", [ARTIFACT_PATHS.preflight]),
        preflightArtifacts,
        preflightArtifact.missingArtifacts,
      );
    }
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_ROUTED", "Routing and required gates are ready for planning"));
  }
  if (state.phase === "DESIGNING") {
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_DESIGNING", "Required gates are ready for planning"));
  }
  if (state.phase === "PLANNED") {
    if (savedPreflightStatus(preflightArtifact.value) !== "READY" || preflight.status !== "READY") {
      return decision(
        context,
        NEXT_ACTIONS.RUN_PREFLIGHT,
        artifactError("E_PREFLIGHT_NOT_READY", "Planning requires a fresh READY preflight before execution", [ARTIFACT_PATHS.preflight]),
        preflightArtifacts,
        preflightArtifact.missingArtifacts,
      );
    }
    return decision(context, NEXT_ACTIONS.START_EXECUTION, artifactError("PHASE_PLANNED", "The persisted preflight is READY"));
  }
  if (state.phase === "EXECUTING") {
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_EXECUTING", "Execution is complete enough to enter verification"));
  }
  if (state.phase === "VERIFYING") {
    const failed = state.checks.find((check) => check?.status === "failed");
    if (failed) {
      return decision(
        context,
        NEXT_ACTIONS.DIAGNOSE,
        artifactError("E_CHECK_FAILED", `Observed check failed: ${failed.id}`, [ARTIFACT_PATHS.state]),
      );
    }
    const blocked = state.checks.find((check) => check?.status === "blocked");
    if (blocked) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_CHECK_BLOCKED", `Observed check is blocked: ${blocked.id}`, [ARTIFACT_PATHS.state]),
      );
    }
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
    });
    if (allCoverageCovered(evidence.coverage)) {
      return decision(context, NEXT_ACTIONS.ENTER_REVIEWING, artifactError("EVIDENCE_COVERED", "All required observed verification evidence is covered"));
    }
    const uncovered = evidence.coverage.filter((item) => item.status !== "COVERED");
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RECORD_VERIFICATION,
      commands: ["forgeloop record-check"],
      commandSpecs: uncovered.map((item) => recordCheckCommandSpec(item.requirement)),
      reasons: uncovered
        .map((item) => artifactError(
          "E_EVIDENCE_REQUIRED",
          "Run the required check and record observed evidence through the structured command specification.",
          [ARTIFACT_PATHS.state],
        )),
      requiredArtifacts: requiredArtifacts,
    });
  }
  if (state.phase === "DIAGNOSING") {
    return decision(context, NEXT_ACTIONS.CORRECT, artifactError("PHASE_DIAGNOSING", "Record the correction hypothesis before returning to verification"));
  }
  if (state.phase === "CORRECTING") {
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_CORRECTING", "Correction is ready for verification"));
  }
  if (state.phase === "REVIEWING") {
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
    });
    if (!allCoverageCovered(evidence.coverage)) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: evidence.coverage
          .filter((item) => item.status !== "COVERED")
          .map((item) => artifactError(
            "E_EVIDENCE_COVERAGE_PARTIAL",
            `Evidence coverage is ${item.status}: ${item.requirement}`,
            [ARTIFACT_PATHS.state],
          )),
        requiredArtifacts,
      });
    }
    const receipt = await loadArtifact(
      () => readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot),
      ARTIFACT_PATHS.receipt,
    );
    if (receipt.error) {
      return decision(
        context,
        NEXT_ACTIONS.PREPARE_COMPLETION,
        artifactError(
          receipt.error.code === "ARTIFACT_MISSING" ? "E_RECEIPT_MISSING" : "E_RECEIPT_INVALID",
          receipt.error.message,
          [ARTIFACT_PATHS.receipt],
        ),
        [...requiredArtifacts, ARTIFACT_PATHS.receipt],
        receipt.missingArtifacts,
      );
    }
    try {
      await validateReceipt(receipt.value.value, packageRoot);
    } catch (error) {
      return decision(
        context,
        NEXT_ACTIONS.PREPARE_COMPLETION,
        artifactError("E_RECEIPT_INVALID", error.message, [ARTIFACT_PATHS.receipt]),
        [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      );
    }
    const completion = await evaluateCompletion({ target, packageRoot });
    if (completion.status !== "VALID") {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: completion.errors,
        requiredArtifacts: [...requiredArtifacts, ARTIFACT_PATHS.receipt, ARTIFACT_PATHS.events],
      });
    }
    return decision(context, NEXT_ACTIONS.RUN_COMPLETE, artifactError("COMPLETION_READY", "Completion artifacts and cross-artifact validation are valid"));
  }
  if (state.phase === "COMPLETE") {
    const completion = await evaluateCompletion({ target, packageRoot });
    if (completion.status === "VALID") {
      return decision(context, NEXT_ACTIONS.NONE, artifactError("PHASE_COMPLETE", "Completion is validator-backed and terminal"));
    }
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: completion.errors,
      requiredArtifacts: [...requiredArtifacts, ARTIFACT_PATHS.receipt, ARTIFACT_PATHS.events],
    });
  }
  if (state.phase === "BLOCKED") {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: state.blockers.map((blocker) => artifactError(
        "WORK_STATE_BLOCKED",
        blocker.reason ?? "Work state has a recorded blocker",
        [ARTIFACT_PATHS.state],
      )),
      requiredArtifacts,
    });
  }

  return decision(
    context,
    NEXT_ACTIONS.RESOLVE_BLOCKER,
    artifactError("E_PHASE_UNSUPPORTED", `Unsupported persisted phase: ${state.phase}`, [ARTIFACT_PATHS.state]),
    requiredArtifacts,
  );
}
