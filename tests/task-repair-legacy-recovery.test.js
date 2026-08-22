import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";

import { runTaskCreate } from "../src/commands/task-create.js";
import { runTaskRepairLegacyRecovery } from "../src/commands/task-repair-legacy-recovery.js";
import { runTaskResume } from "../src/commands/task-resume.js";
import { appendProtocolEvent, eventHash, validateEventLedger } from "../src/core/events.js";
import { resolveTaskClaimState } from "../src/core/task-claim-state.js";
import { acquireTaskLock } from "../src/core/task-lock.js";
import { taskArtifactPath } from "../src/core/task-paths.js";
import { ensureWithin } from "../src/core/filesystem.js";
import {
  legacyRecoveryMigrationId,
} from "../src/core/task-recovery-migration.js";
import {
  assertTaskMutationAllowed,
} from "../src/core/task-claim-state.js";
import { packageRoot, setupAbandonedTask, withRecoveryTarget } from "./helpers/task-recovery-fixture.js";

const LEGACY_DETAILS = Object.freeze({
  classification: "RECOVERABLE",
  reasonCodes: ["E_REPOSITORY_CHANGED", "OFFICIAL_RECOVERY_AVAILABLE"],
  authorization: "OPERATOR_AUTHORIZED",
  note: "recovery event recorded by early adapter without modern identity fields",
});

async function appendLegacyBoundaryEvent(target, taskId) {
  return appendProtocolEvent(target, {
    taskId,
    event: "OPERATOR_RECOVERY_RECORDED",
    details: { ...LEGACY_DETAILS },
  }, packageRoot, { taskId });
}

async function setupLegacyBoundaryTask(target, { taskId = "legacy-boundary-task", writeClaims = ["tests"] } = {}) {
  await setupAbandonedTask(target, { taskId, writeClaims });
  const legacyEvent = await appendLegacyBoundaryEvent(target, taskId);
  return { taskId, legacyEvent };
}

async function rewriteLedger(target, taskId, mutateLastEvents) {
  const eventsPath = ensureWithin(target, taskArtifactPath(taskId, "events"));
  const lines = (await readFile(eventsPath, "utf8")).trim().split("\n");
  const events = lines.map((line) => JSON.parse(line));
  mutateLastEvents(events);
  let previousHash = null;
  for (const event of events) {
    event.previousHash = previousHash;
    delete event.hash;
    event.hash = eventHash(event);
    previousHash = event.hash;
  }
  await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
}

test("missing acknowledgement is refused before anything else", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    await assert.rejects(
      () => runTaskRepairLegacyRecovery({ target, packageRoot, taskId }),
      (error) => error.code === "E_TASK_RECOVERY_AUTHORIZATION_REQUIRED",
    );
  });
});

test("ACTIVE task with valid legacy boundary repairs to validated recovery and blocks mutation until resume", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId, legacyEvent } = await setupLegacyBoundaryTask(target, { writeClaims: ["docs", "tests"] });

    const expectedRecoveryId = legacyRecoveryMigrationId({
      taskId,
      seq: legacyEvent.seq,
      hash: legacyEvent.hash,
    });

    const before = await resolveTaskClaimState(target, { taskId, packageRoot });
    assert.equal(before.claimState, "INCONSISTENT");
    assert.equal(before.mutationAllowed, false);
    assert.deepEqual(before.effectiveWriteClaims, ["docs", "tests"]);
    assert.equal(before.ownershipValid, false);

    // Overlapping acquisition must fail while ownership is inconsistent.
    await assert.rejects(
      () => runTaskCreate({ target, packageRoot, taskId: "blocked-task", claims: ["tests"] }),
      (error) => error.code === "E_TASK_SCOPE_CONFLICT" || error.code === "E_TASK_CLAIM_OWNERSHIP_INCONSISTENT",
    );

    const result = await runTaskRepairLegacyRecovery({
      target,
      packageRoot,
      taskId,
      acknowledgeRecovery: true,
    });
    assert.equal(result.repaired, 1);
    assert.equal(result.alreadyRepaired, false);
    assert.equal(result.recoveryId, expectedRecoveryId);
    assert.equal(result.classificationAtRecovery, "LEGACY_BOUNDARY_MIGRATED");

    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);

    const after = await resolveTaskClaimState(target, { taskId, packageRoot });
    assert.equal(after.claimState, "RELEASED_BY_RECOVERY");
    assert.deepEqual(after.effectiveWriteClaims, []);
    assert.deepEqual(after.historicalWriteClaims, ["docs", "tests"]);
    assert.equal(after.mutationAllowed, false);
    assert.equal(after.ownershipValid, true);

    await assert.rejects(
      () => assertTaskMutationAllowed(target, { taskId, packageRoot }),
      (error) => error.code === "E_TASK_RECOVERED",
    );

    // Another task may now safely acquire the released claims.
    const created = await runTaskCreate({ target, packageRoot, taskId: "second-task", claims: ["tests"] });
    assert.equal(created.taskId ?? created.descriptor?.taskId, "second-task");

    // Migration event binds the original legacy event by reference at the tail.
    const migration = ledger.events.find((event) => event.event === "LEGACY_RECOVERY_MIGRATION_RECORDED");
    assert.equal(migration.event, "LEGACY_RECOVERY_MIGRATION_RECORDED");
    assert.equal(migration.details.legacyEventSeq, legacyEvent.seq);
    assert.equal(migration.details.legacyEventHash, legacyEvent.hash);
    assert.equal(migration.details.legacyEventAt, legacyEvent.at);
    assert.equal(migration.details.legacyTaskId, taskId);
    assert.equal(migration.details.legacyClassification, "RECOVERABLE");
    assert.equal(migration.details.legacyAuthority, "OPERATOR_AUTHORIZED");
    assert.equal(migration.details.authorityKind, "CALLER_ACKNOWLEDGED");
    assert.ok(migration.seq > legacyEvent.seq);
  });
});

test("repair is idempotent and recognizes the already repaired relationship", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    await runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true });

    const second = await runTaskRepairLegacyRecovery({
      target,
      packageRoot,
      taskId,
      acknowledgeRecovery: true,
    });
    assert.equal(second.repaired, 0);
    assert.equal(second.alreadyRepaired, true);

    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);
    assert.equal(
      ledger.events.filter((event) => event.event === "LEGACY_RECOVERY_MIGRATION_RECORDED").length,
      1,
    );
  });
});

test("task-resume accepts a migrated LEGACY_BOUNDARY_MIGRATED recovery without any bypass", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, { writeClaims: ["tests"] });
    await runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true });

    const resumed = await runTaskResume({ target, packageRoot, taskId });
    assert.equal(resumed.resumed, true);
    assert.deepEqual(resumed.reacquiredClaims, ["tests"]);

    const active = await resolveTaskClaimState(target, { taskId, packageRoot });
    assert.equal(active.claimState, "ACTIVE");
    assert.equal(active.mutationAllowed, true);
  });
});

test("meaningful activity after the legacy boundary refuses repair", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    await rewriteLedger(target, taskId, (events) => {
      events.push({
        seq: events.length + 1,
        schemaVersion: 1,
        protocolVersion: 1,
        taskId,
        event: "CHECK_RECORDED",
        at: new Date().toISOString(),
        details: { checkId: "late-check", status: "passed" },
      });
    });

    await assert.rejects(
      () => runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true }),
      (error) => error.code === "E_LEGACY_RECOVERY_MIGRATION_INVALID",
    );
  });
});

test("live, unknown, and corrupt task locks refuse repair", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    const lock = await acquireTaskLock(target, taskId, "mutation");
    try {
      await assert.rejects(
        () => runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true }),
        (error) => error.code === "E_TASK_LOCKED",
      );
    } finally {
      await lock.release();
    }
  });
});

test("modern recovery event without recoveryId refuses repair", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    await rewriteLedger(target, taskId, (events) => {
      events.push({
        seq: events.length + 1,
        schemaVersion: 1,
        protocolVersion: 1,
        taskId,
        event: "TASK_RECOVERY_RECORDED",
        at: new Date().toISOString(),
        details: { ...LEGACY_DETAILS, classification: "STALE", note2: "near miss" },
      });
    });

    await assert.rejects(
      () => runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true }),
      (error) => error.code === "E_LEGACY_RECOVERY_MIGRATION_INVALID",
    );
  });
});

test("tampered ledger refuses repair fail-closed", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupLegacyBoundaryTask(target, {});
    const eventsPath = ensureWithin(target, taskArtifactPath(taskId, "events"));
    const original = await readFile(eventsPath, "utf8");
    const lines = original.trim().split("\n");
    const first = JSON.parse(lines[0]);
    first.taskId = `${first.taskId}-x`;
    lines[0] = JSON.stringify(first);
    await writeFile(eventsPath, `${lines.join("\n")}\n`, "utf8");

    await assert.rejects(
      () => runTaskRepairLegacyRecovery({ target, packageRoot, taskId, acknowledgeRecovery: true }),
      (error) => error.code === "E_LEGACY_RECOVERY_MIGRATION_INVALID",
    );
  });
});
