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
    ["diagnosing", { phase: "DIAGNOSING" }, NEXT_ACTIONS.CORRECT],
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

test("verification decisions require observed evidence and surface failed checks", async (t) => {
  await t.test("no checks requests verification recording", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { phase: "VERIFYING" });
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
      await setupTarget(target, { phase: "VERIFYING", successCriteria: requirements });

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
  await t.test("stale route or contract resolves stale routing", async () => {
    await withTarget(async (target) => {
      await setupTarget(target, { staleRoute: true });
      const result = await getNextAction({ target, packageRoot });
      assertStableAction(result, NEXT_ACTIONS.RESOLVE_STALE_ROUTE);
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
