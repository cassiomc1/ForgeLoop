import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";

import { runTaskCreate } from "../src/commands/task-create.js";
import { runTaskRecover } from "../src/commands/task-recover.js";
import { withTaskMutation } from "../src/core/task-command.js";
import { discoverTasks } from "../src/core/task-discovery.js";
import { ensureWithin } from "../src/core/filesystem.js";
import { taskArtifactPath, taskDirectory } from "../src/core/task-paths.js";
import { createTaskRecovery, writeTaskRecovery } from "../src/core/task-recovery.js";
import { readWorkState } from "../src/core/work-state.js";
import {
  packageRoot,
  setupAbandonedTask,
  withRecoveryTarget,
} from "./helpers/task-recovery-fixture.js";

async function writeUnattestedRecovery(target, taskId) {
  const state = await readWorkState(target, { packageRoot, taskId });
  await writeTaskRecovery(target, createTaskRecovery({
    taskId,
    recoveredAt: new Date().toISOString(),
    recoveryId: "recovery-unattested",
    recoveryEventSeq: 999,
    classificationAtRecovery: "ABANDONED",
    reasonCodes: ["IDLE_BEYOND_THRESHOLD"],
    releasedClaims: ["tests"],
    previousPhase: state.phase,
    previousRevision: state.revision,
    repositoryFingerprint: state.repositoryFingerprint,
    authority: { kind: "CALLER_ACKNOWLEDGED" },
  }), packageRoot);
}

test("a recovery artifact without ledger proof cannot free claims for task-create", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "unattested-owner" });
    await writeUnattestedRecovery(target, taskId);

    const discovered = (await discoverTasks(target, packageRoot)).find((task) => task.taskId === taskId);
    assert.equal(discovered.claimState, "INCONSISTENT");
    assert.deepEqual(discovered.effectiveWriteClaims, ["tests"]);

    await assert.rejects(
      () => runTaskCreate({ target, packageRoot, taskId: "blocked-new-owner", claims: ["tests"] }),
      (error) => error.code === "E_TASK_CLAIM_OWNERSHIP_INCONSISTENT",
    );
  });
});

test("deleting an active recovery tombstone cannot restore mutation authority", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "deleted-recovery-owner" });
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });
    await rm(ensureWithin(target, taskArtifactPath(taskId, "recovery")));

    let callbackRan = false;
    await assert.rejects(
      () => withTaskMutation(target, { taskId, packageRoot }, "tamper-attempt", async () => {
        callbackRan = true;
      }),
      (error) => error.code === "E_TASK_CLAIM_OWNERSHIP_INCONSISTENT",
    );
    assert.equal(callbackRan, false);
  });
});

test("a corrupt recovery artifact blocks overlapping claim acquisition", async () => {
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "corrupt-recovery-owner" });
    await writeFile(
      ensureWithin(target, taskArtifactPath(taskId, "recovery")),
      "{\"status\":",
      "utf8",
    );

    await assert.rejects(
      () => runTaskCreate({ target, packageRoot, taskId: "blocked-by-corruption", claims: ["tests"] }),
      (error) => error.code === "E_TASK_CLAIM_OWNERSHIP_INCONSISTENT",
    );
  });
});

test("an unhealthy task namespace blocks all new claim acquisition", async () => {
  await withRecoveryTarget(async (target) => {
    const corruptTaskId = "descriptorless-owner";
    const directory = ensureWithin(target, taskDirectory(corruptTaskId));
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/events.ndjson`, "corrupt\n", "utf8");

    await assert.rejects(
      () => runTaskCreate({ target, packageRoot, taskId: "blocked-by-namespace", claims: ["src"] }),
      (error) => error.code === "E_TASK_CLAIM_OWNERSHIP_INCONSISTENT",
    );
  });
});
