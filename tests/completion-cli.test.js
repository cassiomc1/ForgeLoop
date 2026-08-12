import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runPreflight } from "../src/commands/preflight.js";
import { ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";

const root = path.resolve(".");
const cliPath = path.join(root, "src", "cli.js");
const packageRoot = getPackageRoot();

function runCli(target, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args, "--path", target], {
    cwd: root,
    encoding: "utf8",
  });
}

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-completion-cli-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function setupTarget(target) {
  const contract = createContract({
    taskId: "task-cli-ergonomics",
    objective: "Exercise completion CLI",
    deliverables: ["src/example.js"],
    constraints: [],
    risks: [],
    verification: ["tests"],
    successCriteria: ["tests"],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  const contractHash = contractFingerprint(contract);
  await writeContract(target, contract, packageRoot);
  const route = evaluateRoute({ workType: "api", surfaces: ["api"], platforms: [] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractHash });
  await writeWorkState(target, createWorkState({
    taskId: contract.taskId,
    contractFingerprint: contractHash,
    routeFingerprint: persistedRoute.fingerprint,
    repositoryFingerprint: { branch: null, head: null },
    phase: "EXECUTING",
    previousPhase: "PLANNED",
    selectedGuides: route.guides,
    requiredGates: [],
    satisfiedGates: [],
    completedSteps: ["implementation"],
    pendingSteps: ["verification"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
  }), { packageRoot });
  await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
  await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);
  assert.equal((await runPreflight({ target, packageRoot })).status, "READY");
  await appendProtocolEvent(target, { taskId: contract.taskId, event: "EXECUTION_STARTED" }, packageRoot);
  await advanceWorkState(target, "VERIFYING", { packageRoot });
}

test("completion CLI exposes scoped preparation and recording commands", () => {
  const prepare = spawnSync(process.execPath, [cliPath, "prepare-completion", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  const record = spawnSync(process.execPath, [cliPath, "record-check", "--help"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(prepare.status, 0, prepare.stderr);
  assert.match(prepare.stdout, /prepare-completion/);
  assert.doesNotMatch(prepare.stdout, /--status/);
  assert.equal(record.status, 0, record.stderr);
  assert.match(record.stdout, /--evidence-kind/);
  assert.match(record.stdout, /recorded only/);
});
test("completion CLI records supplied evidence without executing command text", async () => {
  await withTarget(async (target) => {
    await setupTarget(target);
    const prepared = runCli(target, "prepare-completion", "--json");
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.equal(JSON.parse(prepared.stdout).receipt.taskId, "task-cli-ergonomics");

    const sentinel = path.join(target, "cli-must-not-run.txt");
    const recorded = runCli(
      target,
      "record-check",
      "--id", "tests",
      "--requirement", "tests",
      "--status", "passed",
      "--evidence-kind", "OBSERVED",
      "--command", `touch ${sentinel}`,
      "--result", "4/4 passed",
      "--exit-code", "0",
      "--json",
    );
    assert.equal(recorded.status, 0, recorded.stderr);
    const report = JSON.parse(recorded.stdout);
    assert.equal(report.check.id, "tests");
    assert.equal(report.coverage[0].status, "COVERED");
    await assert.rejects(() => readFile(sentinel));
    await readFile(path.join(target, ARTIFACT_PATHS.receipt), "utf8");
  });
});

test("completion CLI rejects malformed details and command-specific options", () => {
  const malformed = spawnSync(process.execPath, [
    cliPath,
    "record-check",
    "--id", "tests",
    "--requirement", "tests",
    "--status", "passed",
    "--evidence-kind", "OBSERVED",
    "--details", "{",
  ], { cwd: root, encoding: "utf8" });
  const unrelated = spawnSync(process.execPath, [cliPath, "prepare-completion", "--status", "passed"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /valid JSON/i);
  assert.equal(unrelated.status, 1);
  assert.match(unrelated.stderr, /not valid/i);
});
