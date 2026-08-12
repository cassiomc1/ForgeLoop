import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { runComplete } from "../src/commands/complete.js";
import { formatNextActionResult } from "../src/commands/next.js";
import { runPreflight } from "../src/commands/preflight.js";
import { ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { createCheck } from "../src/core/checks.js";
import { prepareCompletion, recordCheck } from "../src/core/completion-artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { coverageForRequirements } from "../src/core/coverage.js";
import { createEvidence } from "../src/core/evidence.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { createGate } from "../src/core/gates.js";
import { persistGate } from "../src/core/gate-artifact.js";
import { advanceWorkState } from "../src/core/phase.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { evaluateCompletion } from "../src/core/completion.js";
import { NEXT_ACTIONS, getNextAction } from "../src/core/next-action.js";

const packageRoot = getPackageRoot();
const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "states");

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-next-action-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function checkFor({
  id = "tests",
  requirement = "tests",
  status = "passed",
  evidenceKind = "OBSERVED",
} = {}) {
  return createCheck({
    id,
    kind: "command",
    requirement,
    status,
    evidenceKind,
    source: `fixture:${id}`,
    ...(status === "passed" ? { exitCode: 0 } : {}),
  });
}

function previousPhaseFor(phase) {
  return {
    DISCOVERING: "RECEIVED",
    CONTRACT_READY: "DISCOVERING",
    ROUTED: "CONTRACT_READY",
    DESIGNING: "ROUTED",
    PLANNED: "DESIGNING",
    EXECUTING: "PLANNED",
    VERIFYING: "EXECUTING",
    DIAGNOSING: "VERIFYING",
    CORRECTING: "DIAGNOSING",
    REVIEWING: "VERIFYING",
  }[phase];
}

async function setupTarget(target, {
  phase = "EXECUTING",
  routeInput = { workType: "api", surfaces: ["api"], platforms: [] },
  completedSteps = [],
  pendingSteps = [],
  checks = [],
  verificationEvidence = [],
  evidenceCoverage,
  preflightStatus,
  preflightReady = preflightStatus === undefined ? true : preflightStatus === "READY",
  executionStarted = phase === "EXECUTING" || phase === "VERIFYING" || phase === "DIAGNOSING" || phase === "CORRECTING" || phase === "REVIEWING" || phase === "COMPLETE",
  satisfyGates = false,
  staleRoute = false,
  staleContract = false,
  receipt = false,
  successCriteria = ["tests"],
  blockers = phase === "BLOCKED" ? [{ reason: "fixture blocker" }] : [],
  diagnosedHypothesis = phase === "CORRECTING" ? "fixture diagnosis" : undefined,
} = {}) {
  const contract = createContract({
    taskId: "task-next-action",
    objective: "Exercise deterministic lifecycle navigation",
    deliverables: ["src/core/next-action.js"],
    constraints: ["offline", "read-only query"],
    risks: [],
    verification: ["node --test tests/next-action.test.js"],
    successCriteria,
    stopConditions: ["missing protocol artifacts"],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const contractHash = contractFingerprint(contract);
  await writeContract(target, contract, packageRoot);

  const route = evaluateRoute(routeInput);
  const persistedRoute = await persistRoute(target, route, packageRoot, {
    contractFingerprint: contractHash,
  });

  const requiredGates = await requiredGatesForRoute(route.guides);
  if (satisfyGates) {
    for (const gate of requiredGates) {
      await persistGate(target, createGate({
        taskId: contract.taskId,
        gate,
        status: "satisfied",
        requiredBy: route.guides,
        artifacts: [],
        decisions: ["fixture gate"],
        unknowns: [],
        approvedAssumptions: [],
        evidence: [],
      }), packageRoot);
    }
  }

  const defaultChecks = checks.length > 0
    ? checks
    : phase === "COMPLETE"
      ? [checkFor()]
      : [];
  const defaultEvidence = verificationEvidence.length > 0
    ? verificationEvidence
    : phase === "COMPLETE"
      ? [createEvidence({ kind: "OBSERVED", source: "fixture:tests", result: "tests passed" })]
      : [];
  const state = createWorkState({
    taskId: contract.taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase,
    ...(previousPhaseFor(phase) ? { previousPhase: previousPhaseFor(phase) } : {}),
    selectedGuides: route.guides,
    requiredGates: [...requiredGates],
    satisfiedGates: satisfyGates ? [...requiredGates] : [],
    completedSteps,
    pendingSteps,
    checks: defaultChecks,
    failures: [],
    blockers,
    verificationEvidence: defaultEvidence,
    ...(evidenceCoverage === undefined
      ? phase === "COMPLETE"
        ? { evidenceCoverage: coverageForRequirements(successCriteria, defaultChecks) }
        : {}
      : { evidenceCoverage }),
    ...(diagnosedHypothesis ? { diagnosedHypothesis } : {}),
  });
  await writeWorkState(target, state, { packageRoot });

  await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
  await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);
  const preflight = await runPreflight({ target, packageRoot });
  if (preflightReady) assert.equal(preflight.status, "READY");
  else await rm(path.join(target, ARTIFACT_PATHS.preflight));
  if (executionStarted) {
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "EXECUTION_STARTED" }, packageRoot);
  }

  if (staleRoute) {
    const stale = createContract({ ...contract, objective: "Changed after route persistence" });
    await writeContract(target, stale, packageRoot);
  }
  if (staleContract) {
    const staleState = createWorkState({
      ...state,
      contractFingerprint: "a".repeat(64),
      lastUpdated: state.lastUpdated,
    });
    await writeWorkState(target, staleState, { packageRoot });
  }
  if (receipt) await prepareCompletion({ target, packageRoot });

  return { contract, route, state, preflight, requiredGates };
}

async function requiredGatesForRoute(guides) {
  const { requiredGatesForGuides } = await import("../src/core/guide-metadata.js");
  return requiredGatesForGuides(guides, packageRoot);
}

async function setupCompletedTarget(target) {
  await setupTarget(target, { phase: "EXECUTING" });
  await advanceWorkState(target, "VERIFYING", { packageRoot });
  await prepareCompletion({ target, packageRoot });
  await recordCheck({
    target,
    packageRoot,
    id: "tests",
    kind: "command",
    requirement: "tests",
    status: "passed",
    evidenceKind: "OBSERVED",
    result: "tests passed",
    exitCode: 0,
  });
  await advanceWorkState(target, "REVIEWING", { packageRoot });
  const completion = await runComplete({ target, packageRoot });
  assert.equal(completion.status, "VALID");
  assert.equal(completion.taskStatus, "COMPLETE");
  return completion;
}

async function setupEarlyPhaseTarget(target, phase) {
  const contract = createContract({
    taskId: "task-early-phase",
    objective: "Exercise phase-aware artifact loading",
    deliverables: [],
    constraints: [],
    risks: [],
    verification: [],
    successCriteria: [],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const hasContract = phase === "CONTRACT_READY";
  if (hasContract) await writeContract(target, contract, packageRoot);
  await writeWorkState(target, createWorkState({
    taskId: contract.taskId,
    contractFingerprint: contractFingerprint(contract),
    repositoryFingerprint: { branch: null, head: null },
    phase,
    ...(previousPhaseFor(phase) ? { previousPhase: previousPhaseFor(phase) } : {}),
    selectedGuides: [],
    completedSteps: [],
    pendingSteps: [],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  }), { packageRoot });
}

function assertStableAction(result, action) {
  assert.equal(result.nextAction, action);
  assert.ok(Object.values(NEXT_ACTIONS).includes(result.nextAction));
}

async function forgeLoopArtifactHashes(target) {
  const root = path.join(target, ".forgeloop");
  const hashes = {};

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        const relative = path.relative(target, file);
        hashes[relative] = createHash("sha256").update(await readFile(file)).digest("hex");
      }
    }
  }

  await visit(root);
  return hashes;
}

test("empty target is read-only and directs discovery", async () => {
  await withTarget(async (target) => {
    const before = await readdir(target);
    const result = await getNextAction({ target, packageRoot });

    assert.equal(result.schemaVersion, 1);
    assert.equal(result.protocolVersion, 1);
    assert.equal(result.taskId, "unknown");
    assert.equal(result.currentPhase, "RECEIVED");
    assert.equal(result.nextAction, NEXT_ACTIONS.DISCOVER);
    assert.equal(result.terminal, false);
    assert.deepEqual(await readdir(target), before);
  });
});

test("phase matrix returns the legal next action", async (t) => {
  const scenarios = [
    ["received", { phase: "RECEIVED" }, NEXT_ACTIONS.DISCOVER],
    ["discovering", { phase: "DISCOVERING" }, NEXT_ACTIONS.CREATE_CONTRACT],
    ["contract-ready", { phase: "CONTRACT_READY" }, NEXT_ACTIONS.ROUTE],
    ["routed with missing gates", {
      phase: "ROUTED",
      routeInput: { workType: "complete-website", surfaces: ["ui"], platforms: [] },
      preflightReady: false,
    }, NEXT_ACTIONS.SATISFY_GATES],
    ["routed with valid gates", {
      phase: "ROUTED",
      routeInput: { workType: "complete-website", surfaces: ["ui"], platforms: [] },
      satisfyGates: true,
    }, NEXT_ACTIONS.PLAN],
    ["designing", { phase: "DESIGNING" }, NEXT_ACTIONS.PLAN],
    ["planned without preflight", { phase: "PLANNED", preflightReady: false }, NEXT_ACTIONS.RUN_PREFLIGHT],
    ["planned with preflight", { phase: "PLANNED" }, NEXT_ACTIONS.START_EXECUTION],
    ["executing", { phase: "EXECUTING" }, NEXT_ACTIONS.ENTER_VERIFYING],
    ["diagnosing", { phase: "DIAGNOSING", diagnosedHypothesis: "fixture diagnosis" }, NEXT_ACTIONS.CORRECT],
    ["correcting", { phase: "CORRECTING" }, NEXT_ACTIONS.ENTER_VERIFYING],
    ["blocked", { phase: "BLOCKED" }, NEXT_ACTIONS.RESOLVE_BLOCKER],
  ];

  for (const [name, setup, action] of scenarios) {
    await t.test(name, async () => {
      await withTarget(async (target) => {
        await setupTarget(target, setup);
        const result = await getNextAction({ target, packageRoot });
        assertStableAction(result, action);
        if (action === NEXT_ACTIONS.NONE) assert.equal(result.terminal, true);
        else assert.equal(result.terminal, false);
      });
    });
  }

  await t.test("validator-backed complete state is terminal", async () => {
    await withTarget(async (target) => {
      await setupCompletedTarget(target);
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.NONE);
      assert.equal(result.terminal, true);
    });
  });
});

test("early phases load only artifacts that already are prerequisites", async (t) => {
  for (const [phase, action] of [
    ["RECEIVED", NEXT_ACTIONS.DISCOVER],
    ["DISCOVERING", NEXT_ACTIONS.CREATE_CONTRACT],
  ]) {
    await t.test(`${phase.toLowerCase()} does not require future contract or route artifacts`, async () => {
      await withTarget(async (target) => {
        await setupEarlyPhaseTarget(target, phase);
        const next = await getNextAction({ target, packageRoot });

        assertStableAction(next, action);
        assert.notEqual(next.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);
      });
    });
  }

  await t.test("contract-ready requires only the missing route as route guidance", async () => {
    await withTarget(async (target) => {
      await setupEarlyPhaseTarget(target, "CONTRACT_READY");
      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.ROUTE);
      assert.ok(next.missingArtifacts.includes(ARTIFACT_PATHS.route));
      assert.ok(next.requiredArtifacts.includes(ARTIFACT_PATHS.contract));
      assert.equal(next.requiredArtifacts.includes(ARTIFACT_PATHS.route), false);
    });
  });
});

test("verification decisions require observed evidence and surface failed checks", async (t) => {
  await t.test("no receipt prepares completion before verification recording", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "VERIFYING" });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.PREPARE_COMPLETION);
      assert.deepEqual(result.commands, ["forgeloop prepare-completion --json"]);
    });
  });

  await t.test("valid receipt requests verification recording", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "VERIFYING", receipt: true });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RECORD_VERIFICATION);
      assert.deepEqual(result.commands, ["forgeloop record-check"]);
      assert.deepEqual(result.commandSpecs, [{
        commandId: "record-check",
        executable: "forgeloop",
        subcommand: "record-check",
        argv: ["record-check", "--id", "tests", "--requirement", "tests", "--status", "passed", "--evidence-kind", "OBSERVED"],
        requiredInputs: [{
          name: "result",
          option: "--result",
          description: "Observed result supplied by the agent",
        }],
      }]);
      assert.doesNotMatch(JSON.stringify(result.commands), /run-check|record-verification|advance --to/);
    });
  });

  await t.test("untrusted requirements are present only in direct-spawn command specifications", async () => {
    await withTarget(async (target) => {
      const requirements = [
        "$(printf injected)",
        "`printf injected`",
        "quote ' and \\\"",
        "line one\nline two",
        "back\\slash",
        "--leading-option",
        "spaces are data",
        "verificacao-unicode-á",
      ];
      await setupTarget(target, { phase: "VERIFYING", successCriteria: requirements, receipt: true });

      const result = await getNextAction({ target, packageRoot });
      const human = formatNextActionResult(result);

      assertStableAction(result, NEXT_ACTIONS.RECORD_VERIFICATION);
      assert.deepEqual(result.commands, ["forgeloop record-check"]);
      assert.ok(result.commandSpecs.length >= requirements.length);
      assert.match(human, /SAFE SYNOPSIS ONLY/);
      assert.match(human, /not shell syntax/i);
      for (const requirement of requirements) {
        assert.ok(result.commandSpecs.some((spec) => spec.argv.includes(requirement)));
        assert.ok(result.commandSpecs.every((spec) => !spec.requiredInputs.some((input) => input.description.includes(requirement))));
        assert.ok(result.commands.every((command) => !command.includes(requirement)));
        assert.equal(human.includes(requirement), false);
      }
    });
  });

  await t.test("failed check directs diagnosis", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, {
        phase: "VERIFYING",
        checks: [checkFor({ status: "failed", evidenceKind: "OBSERVED" })],
      });
      assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.DIAGNOSE);
    });
  });

  await t.test("inferred passed check does not satisfy required coverage", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, {
        phase: "VERIFYING",
        checks: [checkFor({ evidenceKind: "INFERRED" })],
        receipt: true,
      });
      assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.RECORD_VERIFICATION);
    });
  });

  await t.test("observed passed check permits review", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "VERIFYING", receipt: true });
      await recordCheck({
        target,
        packageRoot,
        id: "tests",
        kind: "command",
        requirement: "tests",
        status: "passed",
        evidenceKind: "OBSERVED",
        command: "node --test tests/next-action.test.js",
        result: "tests passed",
        exitCode: 0,
      });
      assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.ENTER_REVIEWING);
    });
  });

  await t.test("invalid receipt returns repair guidance instead of an unusable preparation command", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "VERIFYING", receipt: true });
      const receiptPath = path.join(target, ARTIFACT_PATHS.receipt);
      const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
      receipt.schemaVersion = 99;
      await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(result.reasonCodes.includes("E_RECEIPT_INVALID"));
      assert.equal(result.commands.includes("forgeloop prepare-completion --json"), false);
      assert.ok(result.requiredArtifacts.includes(ARTIFACT_PATHS.receipt));
    });
  });
});

test("normal next-driven success path prepares the receipt before record-check", async () => {
  await withTarget(async (target) => {
    await setupTarget(target, { phase: "EXECUTING" });

    assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.ENTER_VERIFYING);
    await advanceWorkState(target, "VERIFYING", { packageRoot });
    assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.PREPARE_COMPLETION);

    await prepareCompletion({ target, packageRoot });
    assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.RECORD_VERIFICATION);
    await recordCheck({
      target,
      packageRoot,
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      result: "tests passed",
      exitCode: 0,
    });
    assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.ENTER_REVIEWING);

    await advanceWorkState(target, "REVIEWING", { packageRoot });
    assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.RUN_COMPLETE);
    const completion = await runComplete({ target, packageRoot });
    assert.equal(completion.status, "VALID");
  });
});

test("diagnosis guidance is executable only after a hypothesis is persisted", async (t) => {
  await t.test("missing hypothesis returns deterministic repair guidance", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "DIAGNOSING" });
      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(next.reasonCodes.includes("E_DIAGNOSIS_HYPOTHESIS_MISSING"));
      assert.equal(next.commands.includes("forgeloop advance --to CORRECTING"), false);
      assert.ok(next.requiredArtifacts.includes(ARTIFACT_PATHS.state));
    });
  });

  await t.test("persisted hypothesis retains the correction action and legal phase command", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "DIAGNOSING", diagnosedHypothesis: "fixture diagnosis" });
      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.CORRECT);
      assert.deepEqual(next.commands, ["forgeloop advance --to CORRECTING"]);
    });
  });
});

test("review decisions require coverage before receipt or completion", async (t) => {
  async function setupReviewedTarget(target) {
    await setupTarget(target, { phase: "VERIFYING", receipt: true });
    await recordCheck({
      target,
      packageRoot,
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      result: "tests passed",
      exitCode: 0,
    });
    await advanceWorkState(target, "REVIEWING", { packageRoot });
  }

  await t.test("valid coverage without receipt prepares completion", async () => {
    await withTarget(async (target) => {
      await setupReviewedTarget(target);
      await rm(path.join(target, ARTIFACT_PATHS.receipt));
      assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.PREPARE_COMPLETION);
    });
  });

  await t.test("valid coverage with receipt runs completion", async () => {
    await withTarget(async (target) => {
      await setupReviewedTarget(target);
      assertStableAction(await getNextAction({ target, packageRoot }), NEXT_ACTIONS.RUN_COMPLETE);
    });
  });
});

test("completion identity rejects foreign receipt or state without mutation", async (t) => {
  async function setupReviewedTarget(target) {
    await setupTarget(target, { phase: "VERIFYING", receipt: true });
    await recordCheck({
      target,
      packageRoot,
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      result: "tests passed",
      exitCode: 0,
    });
    await advanceWorkState(target, "REVIEWING", { packageRoot });
  }

  for (const [name, mutate, code] of [
    [
      "receipt task ID",
      async (target) => {
        const receiptPath = path.join(target, ARTIFACT_PATHS.receipt);
        const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
        receipt.taskId = "foreign-task";
        await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      },
      "E_RECEIPT_TASK_MISMATCH",
    ],
    [
      "work-state task ID",
      async (target) => {
        const statePath = path.join(target, ARTIFACT_PATHS.state);
        const state = JSON.parse(await readFile(statePath, "utf8"));
        state.taskId = "foreign-task";
        await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
      },
      "E_STATE_TASK_MISMATCH",
    ],
  ]) {
    await t.test(name, async () => {
      await withTarget(async (target) => {
        await setupReviewedTarget(target);
        await mutate(target);
        const statePath = path.join(target, ARTIFACT_PATHS.state);
        const eventsPath = path.join(target, ARTIFACT_PATHS.events);
        const stateBefore = await readFile(statePath, "utf8");
        const eventsBefore = await readFile(eventsPath, "utf8");

        const next = await getNextAction({ target, packageRoot });
        const evaluation = await evaluateCompletion({ target, packageRoot });
        const completion = await runComplete({ target, packageRoot });

        assertStableAction(next, NEXT_ACTIONS.RESOLVE_BLOCKER);
        assert.ok(next.reasonCodes.includes(code));
        assert.equal(evaluation.status, "REJECTED");
        assert.ok(evaluation.errors.some((error) => error.code === code));
        assert.equal(completion.status, "REJECTED");
        assert.ok(completion.errors.some((error) => error.code === code));
        assert.equal(await readFile(statePath, "utf8"), stateBefore);
        assert.equal(await readFile(eventsPath, "utf8"), eventsBefore);
      });
    });
  }
});

test("freshness and persisted preflight identity cannot authorize forward lifecycle actions", async (t) => {
  await t.test("changed repository checkpoint requires revalidation while executing", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "EXECUTING" });
      const statePath = path.join(target, ARTIFACT_PATHS.state);
      const state = JSON.parse(await readFile(statePath, "utf8"));
      state.repositoryFingerprint = { branch: "main", head: "a".repeat(40) };
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(next.reasonCodes.includes("E_STATE_REVALIDATION_REQUIRED"));
      assert.ok(next.requiredArtifacts.includes(ARTIFACT_PATHS.state));
      assert.equal(next.commands.includes("forgeloop advance --to VERIFYING"), false);
    });
  });

  await t.test("stale planned checkpoint cannot bypass next through advance", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "PLANNED" });
      const statePath = path.join(target, ARTIFACT_PATHS.state);
      const eventsPath = path.join(target, ARTIFACT_PATHS.events);
      const state = JSON.parse(await readFile(statePath, "utf8"));
      state.repositoryFingerprint = { branch: "main", head: "a".repeat(40) };
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
      const stateBefore = await readFile(statePath, "utf8");
      const eventsBefore = await readFile(eventsPath, "utf8");

      await assert.rejects(
        () => advanceWorkState(target, "EXECUTING", { packageRoot }),
        (error) => error.code === "E_STATE_REVALIDATION_REQUIRED",
      );
      assert.equal(await readFile(statePath, "utf8"), stateBefore);
      assert.equal(await readFile(eventsPath, "utf8"), eventsBefore);
    });
  });

  await t.test("foreign persisted preflight cannot start execution", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "PLANNED" });
      const preflightPath = path.join(target, ARTIFACT_PATHS.preflight);
      const preflight = JSON.parse(await readFile(preflightPath, "utf8"));
      preflight.taskId = "foreign-task";
      await writeFile(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`);

      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.RUN_PREFLIGHT);
      assert.ok(next.reasonCodes.includes("E_PREFLIGHT_TASK_MISMATCH"));
      assert.equal(next.commands.includes("forgeloop advance --to EXECUTING"), false);
    });
  });

  for (const [name, mutate, code] of [
    [
      "contract fingerprint",
      (preflight) => {
        preflight.fingerprints.contract = "a".repeat(64);
      },
      "E_PREFLIGHT_CONTRACT_STALE",
    ],
    [
      "routing fingerprint",
      (preflight) => {
        preflight.fingerprints.routing = "b".repeat(64);
      },
      "E_PREFLIGHT_ROUTE_STALE",
    ],
  ]) {
    await t.test(`stale persisted preflight ${name} cannot start execution`, async () => {
      await withTarget(async (target) => {
        await setupTarget(target, { phase: "PLANNED" });
        const preflightPath = path.join(target, ARTIFACT_PATHS.preflight);
        const preflight = JSON.parse(await readFile(preflightPath, "utf8"));
        mutate(preflight);
        await writeFile(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`);

        const next = await getNextAction({ target, packageRoot });

        assertStableAction(next, NEXT_ACTIONS.RUN_PREFLIGHT);
        assert.ok(next.reasonCodes.includes(code));
        assert.equal(next.commands.includes("forgeloop advance --to EXECUTING"), false);
      });
    });
  }

  await t.test("foreign state task ID cannot recommend or persist execution", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "PLANNED" });
      const statePath = path.join(target, ARTIFACT_PATHS.state);
      const eventsPath = path.join(target, ARTIFACT_PATHS.events);
      const state = JSON.parse(await readFile(statePath, "utf8"));
      state.taskId = "foreign-task";
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
      const stateBefore = await readFile(statePath, "utf8");
      const eventsBefore = await readFile(eventsPath, "utf8");

      const next = await getNextAction({ target, packageRoot });

      assertStableAction(next, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(next.reasonCodes.includes("E_STATE_TASK_MISMATCH"));
      assert.equal(next.commands.includes("forgeloop advance --to EXECUTING"), false);
      await assert.rejects(
        () => advanceWorkState(target, "EXECUTING", { packageRoot }),
        (error) => error.code === "E_STATE_TASK_MISMATCH",
      );
      assert.equal(await readFile(statePath, "utf8"), stateBefore);
      assert.equal(await readFile(eventsPath, "utf8"), eventsBefore);
    });
  });

  await t.test("foreign prerequisite events cannot bypass direct execution advance", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "PLANNED" });
      const statePath = path.join(target, ARTIFACT_PATHS.state);
      const eventsPath = path.join(target, ARTIFACT_PATHS.events);
      await rm(eventsPath);
      for (const event of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED", "PREFLIGHT_READY"]) {
        await appendProtocolEvent(target, { taskId: "foreign-task", event }, packageRoot);
      }
      const stateHashBefore = createHash("sha256").update(await readFile(statePath)).digest("hex");
      const eventsHashBefore = createHash("sha256").update(await readFile(eventsPath)).digest("hex");

      await assert.rejects(
        () => advanceWorkState(target, "EXECUTING", { packageRoot }),
        (error) => error.code === "E_PHASE_CHRONOLOGY_INVALID",
      );
      assert.equal(createHash("sha256").update(await readFile(statePath)).digest("hex"), stateHashBefore);
      assert.equal(createHash("sha256").update(await readFile(eventsPath)).digest("hex"), eventsHashBefore);
    });
  });
});

test("malformed checks block verifying and reviewing before evidence branching", async (t) => {
  const invalidChecks = [
    ["missing schema fields", { id: "tests", status: "passed", evidenceKind: "OBSERVED" }, "E_CHECK_INVALID"],
    ["wrong protocol version", { ...checkFor(), protocolVersion: 99 }, "E_CHECK_INVALID"],
    ["duplicate IDs", [checkFor(), checkFor()], "E_CHECK_INVALID"],
    ["unsupported status", { ...checkFor(), status: "unknown" }, "E_CHECK_INVALID"],
    ["unsupported evidence kind", { ...checkFor(), evidenceKind: "UNSUPPORTED" }, "E_EVIDENCE_KIND_INVALID"],
    ["status evidence contradiction", { ...checkFor(), evidenceKind: "NOT_VERIFIED" }, "E_CHECK_STATUS_CONTRADICTION"],
  ];

  for (const phase of ["VERIFYING", "REVIEWING"]) {
    for (const [name, invalid, code] of invalidChecks) {
      await t.test(`${phase.toLowerCase()} rejects ${name}`, async () => {
        await withTarget(async (target) => {
          await setupTarget(target, { phase, checks: [checkFor()], receipt: true });
          const statePath = path.join(target, ARTIFACT_PATHS.state);
          const state = JSON.parse(await readFile(statePath, "utf8"));
          state.checks = Array.isArray(invalid) ? invalid : [invalid];
          await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

          const next = await getNextAction({ target, packageRoot });

          assertStableAction(next, NEXT_ACTIONS.RESOLVE_BLOCKER);
          assert.ok(next.reasonCodes.includes(code));
          assert.equal(next.commands.length, 0);
          assert.equal(next.requiredArtifacts.includes(ARTIFACT_PATHS.state), true);
        });
      });
    }
  }
});

test("third live execution run enters verification without claiming completion", async () => {
  await withTarget(async (target) => {
    const fixture = JSON.parse(await readFile(path.join(fixtureRoot, "third-live-executing.json"), "utf8"));
    await setupTarget(target, fixture);

    const result = await getNextAction({ target, packageRoot });

    assertStableAction(result, NEXT_ACTIONS.ENTER_VERIFYING);
    assert.match(JSON.stringify(result.commands), /advance --to VERIFYING/);
    assert.equal(result.terminal, false);
    assert.notEqual(result.nextAction, NEXT_ACTIONS.NONE);
    assert.notEqual(result.nextAction, "COMPLETE");
  });
});

test("unsafe artifacts return repair guidance without writes and results are deterministic", async (t) => {
  await t.test("stale route or contract requires checkpoint revalidation", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { staleRoute: true });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(result.reasonCodes.includes("E_ROUTE_STALE") || result.reasonCodes.includes("E_CONTRACT_STALE"));
    });
  });

  await t.test("executing without a READY preflight resolves a blocker", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "EXECUTING", preflightReady: false });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(result.reasonCodes.includes("E_PREFLIGHT_NOT_READY"));
    });
  });

  await t.test("foreign-task execution ledger cannot authorize verification", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "EXECUTING" });
      await rm(path.join(target, ARTIFACT_PATHS.events));
      for (const event of [
        "CONTRACT_VALIDATED",
        "ROUTE_VALIDATED",
        "PREFLIGHT_READY",
        "EXECUTION_STARTED",
      ]) {
        await appendProtocolEvent(target, { taskId: "foreign-task", event }, packageRoot);
      }

      const result = await getNextAction({ target, packageRoot });

      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(result.reasonCodes.includes("E_PHASE_CHRONOLOGY_INVALID"));
      assert.ok(result.requiredArtifacts.includes(ARTIFACT_PATHS.events));
      assert.notEqual(result.nextAction, NEXT_ACTIONS.ENTER_VERIFYING);
    });
  });

  await t.test("premature review without coverage never runs completion", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "REVIEWING" });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.notEqual(result.nextAction, NEXT_ACTIONS.RUN_COMPLETE);
    });
  });

  await t.test("premature complete state returns repair guidance", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "COMPLETE" });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.notEqual(result.nextAction, NEXT_ACTIONS.NONE);
      assert.ok(result.reasonCodes.includes("E_RECEIPT_MISSING")
        || result.reasonCodes.includes("E_PHASE_CHRONOLOGY_INVALID"));
    });
  });

  await t.test("malformed work state resolves a blocker", async () => {
    await withTarget(async (target) => {
      await setupTarget(target);
      await writeFile(path.join(target, ".forgeloop", "work-state.json"), "{ invalid json\n");
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_BLOCKER);
      assert.ok(result.reasonCodes.includes("WORK_STATE_INVALID"));
    });
  });

  await t.test("repeated reads preserve every artifact hash and JSON result", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "EXECUTING" });
      const before = await forgeLoopArtifactHashes(target);
      const first = await getNextAction({ target, packageRoot });
      const second = await getNextAction({ target, packageRoot });

      assert.equal(JSON.stringify(first), JSON.stringify(second));
      assert.deepEqual(await forgeLoopArtifactHashes(target), before);
    });
  });
});
