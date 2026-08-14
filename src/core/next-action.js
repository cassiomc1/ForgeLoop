import { ARTIFACT_PATHS, readJsonArtifact } from "./artifacts.js";
import { completionIdentityErrors, evaluateCompletion } from "./completion.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
import { coverageForRequirements } from "./coverage.js";
import { readContract } from "./contract.js";
import { evaluatePreflight, validatePersistedPreflight, validateReadyProtocolConsistency } from "./preflight.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { validateReceipt } from "./receipt.js";
import { readPersistedRoute } from "./route-artifact.js";
import { assertCheckList } from "./checks.js";
import { completionRelationshipErrors } from "./completion-relationships.js";
import { classifyLoadedWorkState, readWorkState } from "./work-state.js";
import { sha256 } from "./manifest.js";
import { evaluateRequiredEvidence, authoritativeChecksForRequirements, ordinaryLeafRequirements, classifyRequirement } from "./evidence-readiness.js";
import {
  evaluateStartExecutionPrerequisites,
  PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE,
} from "./execution-prerequisites.js";
import { validateEventLedger, validateCompletionRecoveryAuthorization } from "./events.js";

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
  RECORD_TERMINAL_RESULT: "RECORD_TERMINAL_RESULT",
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
    [NEXT_ACTIONS.RECORD_TERMINAL_RESULT]: "forgeloop record-terminal-result",
    [NEXT_ACTIONS.PREPARE_COMPLETION]: "forgeloop prepare-completion --json",
    [NEXT_ACTIONS.RUN_COMPLETE]: "forgeloop complete --json",
  }[action];
}

function recordCheckCommandSpec(requirement) {
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

function recordTerminalResultCommandSpec(requirement) {
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
  if (state.routeFingerprint !== route.fingerprint) {
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

function freshnessReasons(state, classification) {
  const requiredArtifactPaths = state.requiredArtifacts?.map((artifact) => artifact.path) ?? [];
  const reasons = [artifactError(
    "E_STATE_REVALIDATION_REQUIRED",
    `Work-state checkpoint requires revalidation: ${classification.reasons.join(", ")}`,
    [ARTIFACT_PATHS.state],
  )];
  for (const reason of classification.reasons) {
    const contractRelated = ["CONTRACT_CHANGED", "CONTRACT_INVALID", "CONTRACT_NOT_VERIFIED"].includes(reason);
    const artifactRelated = reason.startsWith("REQUIRED_ARTIFACT");
    reasons.push(artifactError(
      contractRelated ? "E_CONTRACT_STALE" : artifactRelated ? "E_REQUIRED_ARTIFACT_STALE" : "E_REPOSITORY_CHANGED",
      `Work-state freshness check failed: ${reason}`,
      uniqueSorted([
        ARTIFACT_PATHS.state,
        ...(contractRelated ? [ARTIFACT_PATHS.contract] : []),
        ...(artifactRelated ? requiredArtifactPaths : []),
      ]),
    ));
  }
  return reasons;
}

function checkListReasons(state) {
  try {
    assertCheckList(state.checks, "work-state.checks");
    return [];
  } catch (error) {
    return [artifactError(
      error.code ?? "E_CHECK_INVALID",
      error.message,
      [ARTIFACT_PATHS.state],
    )];
  }
}

async function loadArtifact(loader, fallback) {
  try {
    return { value: await loader(), error: null, missingArtifacts: [] };
  } catch (error) {
    return { value: null, error, missingArtifacts: missingArtifact(error, fallback) };
  }
}

async function requirementsAndCoverage({
  target,
  packageRoot,
  contract,
  route,
  checks,
  additionalEvidence = [],
  authorityContext,
  runtimeContext,
}) {
  const requirements = await requiredEvidenceForTarget({
    target,
    contract,
    route,
    packageRoot,
    additionalEvidence,
  });
  return {
    requirements,
    coverage: coverageForRequirements(requirements, checks, {
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    }),
  };
}

export async function getNextAction(targetOrOptions = {}, packageRootOption) {
  const normalized = typeof targetOrOptions === "string"
    ? { target: targetOrOptions, packageRoot: packageRootOption }
    : targetOrOptions;
  const { target, packageRoot, authorityContext, runtimeContext } = normalized ?? {};
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
    const persistedPreflight = await loadArtifact(
      () => readJsonArtifact(target, ARTIFACT_PATHS.preflight, "preflight", packageRoot),
      ARTIFACT_PATHS.preflight,
    );
    if (!persistedPreflight.error && persistedPreflight.value?.value?.status === "READY") {
      try {
        const consistencyErrors = await validateReadyProtocolConsistency({
          target,
          packageRoot,
          persisted: persistedPreflight.value.value,
        });
        if (consistencyErrors.length > 0) {
          return result({
            taskId: persistedPreflight.value.value.taskId ?? "unknown",
            currentPhase: "ROUTED",
            nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
            reasons: consistencyErrors,
            requiredArtifacts: [
              ARTIFACT_PATHS.state,
              ARTIFACT_PATHS.contract,
              ARTIFACT_PATHS.route,
              ARTIFACT_PATHS.preflight,
              ARTIFACT_PATHS.events,
            ],
            missingArtifacts: [ARTIFACT_PATHS.state],
          });
        }
      } catch (error) {
        return result({
          taskId: persistedPreflight.value.value.taskId ?? "unknown",
          currentPhase: "ROUTED",
          nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
          reasons: [artifactError(
            error.code ?? "E_PREFLIGHT_READY_INCONSISTENT",
            error.message,
            error.artifacts ?? [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events],
          )],
          requiredArtifacts: [ARTIFACT_PATHS.preflight, ARTIFACT_PATHS.events],
        });
      }
    }
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
  if (state.phase === "RECEIVED") {
    return decision(
      context,
      NEXT_ACTIONS.DISCOVER,
      artifactError("PHASE_RECEIVED", "Discovery has not started"),
      [ARTIFACT_PATHS.state],
    );
  }
  if (state.phase === "DISCOVERING") {
    return decision(
      context,
      NEXT_ACTIONS.CREATE_CONTRACT,
      artifactError("PHASE_DISCOVERING", "Create and validate the task contract"),
      [ARTIFACT_PATHS.state],
    );
  }
  const contractResult = await loadArtifact(
    () => readContract(target, packageRoot),
    ARTIFACT_PATHS.contract,
  );
  const contractArtifacts = [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract];

  if (contractResult.error) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: [artifactError(
        contractResult.error.code === "ARTIFACT_MISSING" ? "E_CONTRACT_MISSING" : "E_CONTRACT_INVALID",
        contractResult.error.message,
        contractResult.error.artifacts ?? [],
      )],
      requiredArtifacts: contractArtifacts,
      missingArtifacts: contractResult.missingArtifacts,
    });
  }

  const contract = contractResult.value;
  const identityErrors = completionIdentityErrors({ contract: contract.value, state });
  if (identityErrors.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: identityErrors,
      requiredArtifacts: contractArtifacts,
    });
  }
  const freshness = await classifyLoadedWorkState({
    target,
    state,
    contractFile: ARTIFACT_PATHS.contract,
  });
  if (freshness.status === "REVALIDATION_REQUIRED") {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: freshnessReasons(state, freshness),
      requiredArtifacts: uniqueSorted([
        ARTIFACT_PATHS.state,
        ARTIFACT_PATHS.contract,
        ...(state.requiredArtifacts?.map((artifact) => artifact.path) ?? []),
      ]),
    });
  }
  if (state.phase === "CONTRACT_READY") {
    return decision(
      context,
      NEXT_ACTIONS.ROUTE,
      artifactError("PHASE_CONTRACT_READY", "Persist deterministic routing for the validated contract"),
      contractArtifacts,
      [ARTIFACT_PATHS.route],
    );
  }
  const routeResult = await loadArtifact(
    () => readPersistedRoute(target, packageRoot),
    ARTIFACT_PATHS.route,
  );
  const requiredArtifacts = [...contractArtifacts, ARTIFACT_PATHS.route];
  const missingArtifacts = [...routeResult.missingArtifacts];

  if (routeResult.error) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
      reasons: [artifactError(
        routeResult.error.code === "ARTIFACT_MISSING" ? "E_ROUTE_MISSING" : "E_ROUTE_INVALID",
        routeResult.error.message,
        routeResult.error.artifacts ?? [],
      )],
      requiredArtifacts,
      missingArtifacts,
    });
  }

  const route = routeResult.value;
  const stale = staleReasons(state, contract, route);
  if (stale.length > 0) {
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RESOLVE_STALE_ROUTE,
      reasons: stale,
      requiredArtifacts,
    });
  }

  const phaseNeedsChronology = PHASES_REQUIRING_EXECUTION_CHRONOLOGY.has(state.phase);
  let executionPrerequisites = null;
  if (phaseNeedsChronology) {
    try {
      executionPrerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot });
    } catch (error) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: [artifactError(
          error?.code ?? "E_PHASE_CHRONOLOGY_INVALID",
          `Unable to evaluate post-execution prerequisites: ${error?.message ?? String(error)}`,
          Array.isArray(error?.artifacts) ? error.artifacts : [ARTIFACT_PATHS.events],
        )],
        requiredArtifacts: [
          ARTIFACT_PATHS.state,
          ARTIFACT_PATHS.contract,
          ARTIFACT_PATHS.route,
          ARTIFACT_PATHS.preflight,
          ARTIFACT_PATHS.events,
        ],
      });
    }
    if (executionPrerequisites.errors.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: executionPrerequisites.errors,
        requiredArtifacts: executionPrerequisites.requiredArtifacts,
      });
    }
  }

  const preflight = executionPrerequisites?.preflight ?? await evaluatePreflight({ target, packageRoot });
  const preflightArtifact = phaseNeedsChronology
    ? null
    : await loadArtifact(
      () => readJsonArtifact(target, ARTIFACT_PATHS.preflight, "preflight", packageRoot),
      ARTIFACT_PATHS.preflight,
    );
  const missingGates = preflight.requiredGates.filter((gate) => !preflight.satisfiedGates.includes(gate));
  const preflightArtifacts = [...requiredArtifacts, ARTIFACT_PATHS.preflight];
  const persistedPreflightErrors = phaseNeedsChronology
    ? []
    : validatePersistedPreflight(preflightArtifact.value?.value, preflight);

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
    if (persistedPreflightErrors.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RUN_PREFLIGHT,
        reasons: persistedPreflightErrors,
        commands: [commandFor(NEXT_ACTIONS.RUN_PREFLIGHT)],
        requiredArtifacts: preflightArtifacts,
        missingArtifacts: preflightArtifact.missingArtifacts,
      });
    }
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_ROUTED", "Routing and required gates are ready for planning"));
  }
  if (state.phase === "DESIGNING") {
    return decision(context, NEXT_ACTIONS.PLAN, artifactError("PHASE_DESIGNING", "Required gates are ready for planning"));
  }
  if (state.phase === "PLANNED") {
    const prerequisites = await evaluateStartExecutionPrerequisites({ target, state, packageRoot });
    if (prerequisites.errors.length > 0) {
      const preflightOnly = prerequisites.errors.every((error) => error.code.startsWith("E_PREFLIGHT_")
        || (error.code === "E_PHASE_CHRONOLOGY_INVALID"
          && error.message === PREFLIGHT_ROUTE_IDENTITY_ERROR_MESSAGE));
      if (preflightOnly) {
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RUN_PREFLIGHT,
          reasons: prerequisites.errors,
          commands: [commandFor(NEXT_ACTIONS.RUN_PREFLIGHT)],
          requiredArtifacts: prerequisites.requiredArtifacts,
          missingArtifacts: preflightArtifact.missingArtifacts,
        });
      }
      const routeOnly = prerequisites.errors.every((error) => error.code === "E_ROUTE_STALE" || error.code === "E_ROUTE_GUIDE_MISMATCH");
      return result({
        ...context,
        nextAction: routeOnly ? NEXT_ACTIONS.RESOLVE_STALE_ROUTE : NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: prerequisites.errors,
        requiredArtifacts: prerequisites.requiredArtifacts,
        missingArtifacts: preflightArtifact.missingArtifacts,
      });
    }
    return decision(context, NEXT_ACTIONS.START_EXECUTION, artifactError("PHASE_PLANNED", "The persisted preflight is READY"));
  }
  if (state.phase === "EXECUTING") {
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_EXECUTING", "Execution is complete enough to enter verification"));
  }
  if (state.phase === "VERIFYING") {
    const invalidChecks = checkListReasons(state);
    if (invalidChecks.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: invalidChecks,
        requiredArtifacts,
      });
    }
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
      authorityContext,
      runtimeContext,
    });
    const authoritative = authoritativeChecksForRequirements({
      requirements: ordinaryLeafRequirements(evidence.requirements),
      checks: state.checks,
    });
    const failed = authoritative.find(({ check }) => check?.status === "failed");
    if (failed) {
      return decision(
        context,
        NEXT_ACTIONS.DIAGNOSE,
        artifactError("E_CHECK_FAILED", `Observed check failed: ${failed.check.id}`, [ARTIFACT_PATHS.state]),
      );
    }
    const blocked = authoritative.find(({ check }) => check?.status === "blocked");
    if (blocked) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_CHECK_BLOCKED", `Observed check is blocked: ${blocked.check.id}`, [ARTIFACT_PATHS.state]),
      );
    }
    const receipt = await loadArtifact(
      () => readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot),
      ARTIFACT_PATHS.receipt,
    );
    if (receipt.error) {
      if (receipt.error.code === "ARTIFACT_MISSING") {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_MISSING", "Prepare the execution receipt before recording verification checks", [ARTIFACT_PATHS.receipt]),
          [...requiredArtifacts, ARTIFACT_PATHS.receipt],
          receipt.missingArtifacts,
        );
      }
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${receipt.error.message}`, [ARTIFACT_PATHS.receipt]),
        [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      );
    }
    try {
      await validateReceipt(receipt.value.value, packageRoot, {
        target,
        taskId: contract?.value?.taskId,
        authorityContext,
        runtimeContext,
      });
    } catch (error) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${error.message}`, [ARTIFACT_PATHS.receipt]),
        [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      );
    }
    const readiness = evaluateRequiredEvidence({
      requirements: evidence.requirements,
      checks: state.checks,
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    });
    const receiptRelationships = completionRelationshipErrors({
      contract,
      route,
      state,
      receipt: receipt.value.value,
      requiredEvidence: evidence.requirements,
      requireRequiredChecks: false,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    if (receiptRelationships.length > 0) {
      if (receiptRelationships.some((err) => (
        err.code === "E_RECEIPT_STATE_MISMATCH"
        || err.code === "E_RECEIPT_CYCLE_MISMATCH"
        || err.code === "E_RECEIPT_CONTRACT_MISMATCH"
        || err.code === "E_ROUTE_GUIDE_MISMATCH"
        || err.code === "E_EVIDENCE_COVERAGE_INVALID"
      ))) {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_STATE_MISMATCH", "Run forgeloop prepare-completion to refresh the execution receipt with current state", [ARTIFACT_PATHS.receipt]),
          [...requiredArtifacts, ARTIFACT_PATHS.receipt],
        );
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: receiptRelationships,
        requiredArtifacts: [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      });
    }
    if (readiness.ready) {
      return decision(context, NEXT_ACTIONS.ENTER_REVIEWING, artifactError("EVIDENCE_COVERED", "All required observed verification evidence is covered"));
    }
    const uncovered = [...readiness.invalid, ...readiness.partial, ...readiness.missing];
    return result({
      ...context,
      nextAction: NEXT_ACTIONS.RECORD_VERIFICATION,
      commands: ["forgeloop record-check"],
      commandSpecs: uncovered.map((item) => recordCheckCommandSpec(item.text)),
      reasons: uncovered
        .map((item) => artifactError(
          readiness.invalid.some((candidate) => candidate.id === item.id)
            ? "E_EVIDENCE_INVALID"
            : readiness.partial.some((candidate) => candidate.id === item.id)
              ? "E_EVIDENCE_PARTIAL"
              : "E_EVIDENCE_REQUIRED",
          "Run the required check and record observed evidence through the structured command specification.",
          [ARTIFACT_PATHS.state],
        )),
      requiredArtifacts: requiredArtifacts,
    });
  }
  if (state.phase === "DIAGNOSING") {
    if (typeof state.diagnosedHypothesis !== "string" || !state.diagnosedHypothesis.trim()) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError(
          "E_DIAGNOSIS_HYPOTHESIS_MISSING",
          "Record diagnosedHypothesis in .forgeloop/work-state.json before advancing to CORRECTING",
          [ARTIFACT_PATHS.state],
        ),
        requiredArtifacts,
      );
    }
    return decision(context, NEXT_ACTIONS.CORRECT, artifactError("PHASE_DIAGNOSING", "The persisted diagnosis hypothesis permits correction"));
  }
  if (state.phase === "CORRECTING") {
    return decision(context, NEXT_ACTIONS.ENTER_VERIFYING, artifactError("PHASE_CORRECTING", "Correction is ready for verification"));
  }
  if (state.phase === "REVIEWING") {
    const invalidChecks = checkListReasons(state);
    if (invalidChecks.length > 0) {
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: invalidChecks,
        requiredArtifacts,
      });
    }
    const evidence = await requirementsAndCoverage({
      target,
      packageRoot,
      contract,
      route,
      checks: state.checks,
      additionalEvidence: preflight.policy?.requiredEvidence ?? [],
      authorityContext,
      runtimeContext,
    });
    const readiness = evaluateRequiredEvidence({
      requirements: evidence.requirements,
      checks: state.checks,
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    });
    if (!readiness.ready) {
      let recoveryAuthorized = false;
      if (state.lastCompletionAttempt?.status === "REJECTED") {
        try {
          const ledger = await validateEventLedger(target, packageRoot);
          let currentReceipt = null;
          try {
            const receiptArtifact = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
            currentReceipt = receiptArtifact?.value;
          } catch {}
          const recoveryAuth = validateCompletionRecoveryAuthorization({
            state,
            receipt: currentReceipt,
            events: ledger.events,
          });
          recoveryAuthorized = recoveryAuth.authorized;
        } catch {
          recoveryAuthorized = false;
        }
      }
      return result({
        ...context,
        nextAction: recoveryAuthorized
          ? NEXT_ACTIONS.ENTER_VERIFYING
          : NEXT_ACTIONS.RESOLVE_BLOCKER,
        commands: recoveryAuthorized
          ? [commandFor(NEXT_ACTIONS.ENTER_VERIFYING)]
          : [],
        reasons: [...readiness.invalid, ...readiness.partial, ...readiness.missing]
          .map((item) => artifactError(
            readiness.missing.some((candidate) => candidate.id === item.id)
              ? "E_EVIDENCE_REQUIRED"
              : item.reasonCode ?? "E_EVIDENCE_PARTIAL",
            `Evidence is not ready: ${item.text}`,
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
      if (receipt.error.code !== "ARTIFACT_MISSING") {
        return decision(
          context,
          NEXT_ACTIONS.RESOLVE_BLOCKER,
          artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${receipt.error.message}`, [ARTIFACT_PATHS.receipt]),
          [...requiredArtifacts, ARTIFACT_PATHS.receipt],
        );
      }
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
      await validateReceipt(receipt.value.value, packageRoot, {
        target,
        taskId: contract?.value?.taskId,
        authorityContext,
        runtimeContext,
      });
    } catch (error) {
      return decision(
        context,
        NEXT_ACTIONS.RESOLVE_BLOCKER,
        artifactError("E_RECEIPT_INVALID", `Repair or remove the invalid execution receipt before continuing: ${error.message}`, [ARTIFACT_PATHS.receipt]),
        [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      );
    }
    const receiptRelationships = completionRelationshipErrors({
      contract,
      route,
      state,
      receipt: receipt.value.value,
      requiredEvidence: evidence.requirements,
      target,
      taskId: contract?.value?.taskId,
      authorityContext,
      runtimeContext,
    });
    if (receiptRelationships.length > 0) {
      if (receiptRelationships.some((err) => (
        err.code === "E_RECEIPT_STATE_MISMATCH"
        || err.code === "E_RECEIPT_CYCLE_MISMATCH"
        || err.code === "E_RECEIPT_CONTRACT_MISMATCH"
        || err.code === "E_ROUTE_GUIDE_MISMATCH"
        || err.code === "E_EVIDENCE_COVERAGE_INVALID"
      ))) {
        return decision(
          context,
          NEXT_ACTIONS.PREPARE_COMPLETION,
          artifactError("E_RECEIPT_STATE_MISMATCH", "Run forgeloop prepare-completion to refresh the execution receipt with current state", [ARTIFACT_PATHS.receipt]),
          [...requiredArtifacts, ARTIFACT_PATHS.receipt],
        );
      }
      return result({
        ...context,
        nextAction: NEXT_ACTIONS.RESOLVE_BLOCKER,
        reasons: receiptRelationships,
        requiredArtifacts: [...requiredArtifacts, ARTIFACT_PATHS.receipt],
      });
    }
    const completion = await evaluateCompletion({ target, packageRoot, authorityContext, runtimeContext });
    if (completion.status !== "VALID") {
      const terminalPendingErrors = completion.errors.filter((err) => (
        err.code === "E_PUBLICATION_REQUIREMENT_PENDING" || err.code === "E_PRODUCTION_REQUIREMENT_PENDING"
      ));
      if (terminalPendingErrors.length > 0 && terminalPendingErrors.length === completion.errors.length) {
        const terminalPendingReqs = terminalPendingErrors.map((err) => {
          const reqId = err.requirementId;
          const matchingReq = evidence.requirements.find((r) => r.id === reqId)
            ?? evidence.requirements.find((r) => r.text === reqId)
            ?? classifyRequirement(reqId ?? err.message);
          return matchingReq;
        });
        return result({
          ...context,
          nextAction: NEXT_ACTIONS.RECORD_TERMINAL_RESULT,
          commands: ["forgeloop record-terminal-result"],
          commandSpecs: terminalPendingReqs.map(recordTerminalResultCommandSpec),
          reasons: completion.errors,
          requiredArtifacts: [...requiredArtifacts, ARTIFACT_PATHS.receipt, ARTIFACT_PATHS.events],
        });
      }
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
    const completion = await evaluateCompletion({ target, packageRoot, authorityContext, runtimeContext });
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
