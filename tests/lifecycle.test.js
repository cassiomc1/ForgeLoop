import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { activateSession } from "../src/core/activation.js";
import { appendProtocolEvent, validateEventLedger } from "../src/core/events.js";
import { advanceWorkState } from "../src/core/phase.js";
import { ARTIFACT_PATHS } from "../src/core/artifacts.js";
import { contractFingerprint } from "../src/core/contract.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-lifecycle-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function state(overrides = {}) {
  return createWorkState({
    taskId: "task-lifecycle",
    contractFingerprint: contractFingerprint({ objective: "lifecycle" }),
    repositoryFingerprint: { branch: null, head: null },
    phase: "RECEIVED",
    selectedGuides: ["clean", "test"],
    completedSteps: [],
    pendingSteps: ["contract", "route", "implementation"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
    ...overrides,
  });
}

test("protocol events are append-only, sequenced, and hash chained", async () => {
  await withTarget(async (target) => {
    await appendProtocolEvent(target, { taskId: "task-lifecycle", event: "TASK_RECEIVED" }, repositoryRoot);
    await appendProtocolEvent(target, { taskId: "task-lifecycle", event: "CONTRACT_VALIDATED" }, repositoryRoot);
    const result = await validateEventLedger(target, repositoryRoot);

    assert.equal(result.valid, true);
    assert.equal(result.events.length, 2);
    assert.equal(result.events[1].previousHash, result.events[0].hash);
    assert.match(await readFile(path.join(target, ARTIFACT_PATHS.events), "utf8"), /TASK_RECEIVED/);
  });
});

test("ledger rejects execution chronology before route and hash tampering", async () => {
  await withTarget(async (target) => {
    await appendProtocolEvent(target, { taskId: "task-lifecycle", event: "EXECUTION_STARTED" }, repositoryRoot);
    const first = await validateEventLedger(target, repositoryRoot);
    assert.equal(first.valid, false);
    assert.ok(first.errors.some((item) => item.code === "E_PHASE_CHRONOLOGY_INVALID"));

    const eventsPath = path.join(target, ARTIFACT_PATHS.events);
    const lines = (await readFile(eventsPath, "utf8")).trim().split("\n");
    const event = JSON.parse(lines[0]);
    event.previousHash = "a".repeat(64);
    await writeFile(eventsPath, `${JSON.stringify(event)}\n`);
    const tampered = await validateEventLedger(target, repositoryRoot);
    assert.equal(tampered.valid, false);
    assert.ok(tampered.errors.some((item) => item.code === "E_LEDGER_HASH_INVALID"));
  });
});

test("activation creates a protocol marker without hidden prompt data", async () => {
  await withTarget(async (target) => {
    const session = await activateSession(target, repositoryRoot);
    assert.match(session.sessionId, /^[0-9a-f-]{36}$/);
    assert.match(session.activationMarker, /^forgeloop-/);
    assert.equal(Object.hasOwn(session, "prompt"), false);
    assert.match(await readFile(path.join(target, ARTIFACT_PATHS.session), "utf8"), /activationMarker/);
  });
});

test("advance rejects illegal transitions without changing work state", async () => {
  await withTarget(async (target) => {
    await writeWorkState(target, state());
    await assert.rejects(
      () => advanceWorkState(target, "EXECUTING", { packageRoot: repositoryRoot }),
      (error) => error.code === "E_PHASE_PREREQUISITE_MISSING",
    );
    const stored = JSON.parse(await readFile(path.join(target, ARTIFACT_PATHS.state), "utf8"));
    assert.equal(stored.phase, "RECEIVED");
  });
});

test("entering verification reconciles only the implementation step", async () => {
  await withTarget(async (target) => {
    await writeWorkState(target, state({
      phase: "EXECUTING",
      previousPhase: "PLANNED",
      completedSteps: ["contract", "route"],
      pendingSteps: ["implementation", "verification"],
    }));
    for (const event of ["CONTRACT_VALIDATED", "ROUTE_VALIDATED", "PREFLIGHT_READY", "EXECUTION_STARTED"]) {
      await appendProtocolEvent(target, { taskId: "task-lifecycle", event }, repositoryRoot);
    }

    const next = await advanceWorkState(target, "VERIFYING", { packageRoot: repositoryRoot });

    assert.deepEqual(next.completedSteps, ["contract", "route", "implementation"]);
    assert.deepEqual(next.pendingSteps, ["verification"]);
    assert.deepEqual(next.verificationEvidence, []);
  });
});
