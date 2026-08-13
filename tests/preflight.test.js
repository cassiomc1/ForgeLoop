import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { createGate } from "../src/core/gates.js";
import { persistGate } from "../src/core/gate-artifact.js";
import { runPreflight } from "../src/commands/preflight.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-preflight-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function prepareWebsite(target, objective = "Prepare website") {
  const contract = createContract({
    taskId: "website-001",
    objective,
    deliverables: ["website"],
    constraints: ["offline"],
    risks: [],
    verification: ["build"],
    successCriteria: ["build"],
    stopConditions: ["missing evidence"],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  await writeContract(target, contract, packageRoot);
  const route = evaluateRoute({ workType: "complete-website", surfaces: ["ui"], platforms: ["web"] });
  const persistedRoute = await persistRoute(target, route, packageRoot, { contractFingerprint: contractFingerprint(contract) });
  for (const gate of ["design", "quality", "threat-boundary"]) {
    await persistGate(target, createGate({
      taskId: contract.taskId,
      gate,
      status: "satisfied",
      requiredBy: ["test"],
      artifacts: [],
      decisions: [],
      unknowns: [],
      approvedAssumptions: [],
      evidence: [],
    }), packageRoot);
  }
  return { contract, route, persistedRoute };
}

async function artifactHashes(target) {
  const hashes = {};
  for (const relativePath of [
    ARTIFACT_PATHS.contract,
    ARTIFACT_PATHS.route,
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.preflight,
    ARTIFACT_PATHS.events,
    `${ARTIFACT_PATHS.gates}/design.json`,
    `${ARTIFACT_PATHS.gates}/quality.json`,
    `${ARTIFACT_PATHS.gates}/threat-boundary.json`,
  ]) {
    try {
      const bytes = await readFile(path.join(target, relativePath));
      hashes[relativePath] = createHash("sha256").update(bytes).digest("hex");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      hashes[relativePath] = null;
    }
  }
  return hashes;
}

test("preflight blocks missing contract and route with stable codes", async () => {
  await withTarget(async (target) => {
    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.errors.some((error) => error.code === "E_CONTRACT_MISSING"));
    assert.ok(result.errors.some((error) => error.code === "E_ROUTE_MISSING"));
  });
});

test("complete website preflight is ready only after required gates", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "READY");
    assert.ok(result.requiredGates.includes("design"));
    assert.deepEqual(result.requiredGates, result.satisfiedGates);
  });
});

test("ready preflight without lifecycle prerequisites persists its artifact without events", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);

    const result = await runPreflight({ target, packageRoot });
    const ledger = await validateEventLedger(target, packageRoot);

    assert.equal(result.status, "READY");
    assert.equal(ledger.valid, true);
    assert.deepEqual(ledger.events, []);
    assert.equal(await readFile(path.join(target, ARTIFACT_PATHS.preflight), "utf8").then(Boolean), true);
  });
});

test("equivalent ready preflight rerun does not repeat lifecycle events", async () => {
  await withTarget(async (target) => {
    const { contract } = await prepareWebsite(target);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);

    assert.equal((await runPreflight({ target, packageRoot })).status, "READY");
    const eventsBefore = await readFile(path.join(target, ARTIFACT_PATHS.events), "utf8");

    assert.equal((await runPreflight({ target, packageRoot })).status, "READY");

    assert.equal(await readFile(path.join(target, ARTIFACT_PATHS.events), "utf8"), eventsBefore);
    assert.equal((await validateEventLedger(target, packageRoot)).valid, true);
  });
});

test("preflight rejects a conflicting ready lifecycle refresh before artifact mutation", async () => {
  await withTarget(async (target) => {
    const { contract } = await prepareWebsite(target);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: contract.taskId, event: "ROUTE_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, {
      taskId: contract.taskId,
      event: "PREFLIGHT_READY",
      fingerprint: "a".repeat(64),
      details: {
        requiredGates: ["design", "quality", "threat-boundary"],
        satisfiedGates: ["design", "quality", "threat-boundary"],
      },
    }, packageRoot);
    const before = await artifactHashes(target);

    await assert.rejects(
      () => runPreflight({ target, packageRoot }),
      (error) => error.code === "E_PHASE_CHRONOLOGY_INVALID"
        && error.message.includes("PREFLIGHT_READY already exists with different READY preflight details"),
    );

    assert.deepEqual(await artifactHashes(target), before);
    assert.equal((await validateEventLedger(target, packageRoot)).valid, true);
  });
});

test("preflight rejects a stale route without state before persisting artifacts", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    await writeContract(target, createContract({
      taskId: "website-001",
      objective: "Changed objective",
      deliverables: ["website"],
      constraints: ["offline"],
      risks: [],
      verification: ["build"],
      successCriteria: ["build"],
      stopConditions: ["missing evidence"],
      unresolvedDecisions: [],
      sourceRefs: [],
    }), packageRoot);
    const before = await artifactHashes(target);

    await assert.rejects(
      () => runPreflight({ target, packageRoot }),
      (error) => error.code === "E_ROUTE_STALE",
    );

    assert.deepEqual(await artifactHashes(target), before);
  });
});

test("preflight rejects foreign gate task identities before persisting artifacts", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    for (const gate of ["design", "quality", "threat-boundary"]) {
      await persistGate(target, createGate({
        taskId: "foreign-task",
        gate,
        status: "satisfied",
        requiredBy: ["test"],
        artifacts: [],
        decisions: [],
        unknowns: [],
        approvedAssumptions: [],
        evidence: [],
      }), packageRoot);
    }
    const before = await artifactHashes(target);

    await assert.rejects(
      () => runPreflight({ target, packageRoot }),
      (error) => error.code === "E_GATE_TASK_MISMATCH",
    );

    assert.deepEqual(await artifactHashes(target), before);
  });
});

test("preflight rejects a mixed-task ledger before persisting artifacts", async () => {
  await withTarget(async (target) => {
    const { contract, route, persistedRoute } = await prepareWebsite(target);
    await writeWorkState(target, createWorkState({
      taskId: contract.taskId,
      contractFingerprint: contractFingerprint(contract),
      routeFingerprint: persistedRoute.fingerprint,
      repositoryFingerprint: { branch: null, head: null },
      phase: "ROUTED",
      previousPhase: "CONTRACT_READY",
      selectedGuides: route.guides,
      completedSteps: ["contract", "route"],
      pendingSteps: ["implementation"],
      checks: [],
      failures: [],
      blockers: [],
      verificationEvidence: [],
    }), { packageRoot });
    await appendProtocolEvent(target, { taskId: "foreign-task", event: "CONTRACT_VALIDATED" }, packageRoot);
    await appendProtocolEvent(target, { taskId: "foreign-task", event: "ROUTE_VALIDATED" }, packageRoot);
    const before = await artifactHashes(target);

    await assert.rejects(
      () => runPreflight({ target, packageRoot }),
      (error) => error.code === "E_PHASE_CHRONOLOGY_INVALID",
    );

    assert.deepEqual(await artifactHashes(target), before);
  });
});

test("preflight rejects a malformed work state before persisting artifacts", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    await writeFile(path.join(target, ARTIFACT_PATHS.state), "{ malformed");
    const before = await artifactHashes(target);

    await assert.rejects(
      () => runPreflight({ target, packageRoot }),
      (error) => error.code === "E_STATE_INVALID",
    );

    assert.deepEqual(await artifactHashes(target), before);
  });
});
