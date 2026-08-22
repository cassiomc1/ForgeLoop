import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";

import { runTaskRecover } from "../src/commands/task-recover.js";
import { runTaskCreate } from "../src/commands/task-create.js";
import { discoverTasks } from "../src/core/task-discovery.js";
import { readEvents } from "../src/core/events.js";
import { ensureWithin, fileExists } from "../src/core/filesystem.js";
import { taskArtifactPath } from "../src/core/task-paths.js";
import { createWorkState, readWorkState, writeWorkState } from "../src/core/work-state.js";
import { readTaskDescriptor } from "../src/core/task-descriptor.js";
import {
  packageRoot,
  setupAbandonedTask,
  withRecoveryTarget,
} from "./helpers/task-recovery-fixture.js";

test("task-resume reacquires released claims and removes recovery state transactionally", async () => {
  const command = await import("../src/commands/task-resume.js").catch(() => null);
  assert.equal(typeof command?.runTaskResume, "function");

  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target);
    const recovered = await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });
    const stateBeforeResume = await readWorkState(target, { packageRoot, taskId });

    const result = await command.runTaskResume({ target, packageRoot, taskId });

    assert.equal(result.resumed, true);
    assert.equal(result.recoveryId, recovered.recoveryId);
    assert.deepEqual(result.reacquiredClaims, ["tests"]);
    assert.deepEqual(await readWorkState(target, { packageRoot, taskId }), stateBeforeResume);
    assert.equal(
      await fileExists(ensureWithin(target, taskArtifactPath(taskId, "recovery"))),
      false,
    );

    const task = (await discoverTasks(target, packageRoot)).find((candidate) => candidate.taskId === taskId);
    assert.deepEqual(task.writeClaims, ["tests"]);
    assert.equal(task.mutationAllowed, true);

    const resumeEvents = (await readEvents(target, packageRoot, { taskId }))
      .filter((event) => event.event === "TASK_RECOVERY_RESUMED");
    assert.equal(resumeEvents.length, 1);
    assert.equal(resumeEvents[0].details.recoveryId, recovered.recoveryId);
  });
});

test("task-resume refuses to reacquire a claim owned by another active task", async () => {
  const { runTaskResume } = await import("../src/commands/task-resume.js");
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "recovered-owner" });
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });
    await runTaskCreate({ target, packageRoot, taskId: "new-owner", claims: ["tests"] });

    await assert.rejects(
      () => runTaskResume({ target, packageRoot, taskId }),
      (error) => error.code === "E_TASK_SCOPE_CONFLICT"
        && typeof error.conflicts?.[0]?.classification === "string"
        && typeof error.conflicts?.[0]?.nextAction === "string"
        && Array.isArray(error.conflicts?.[0]?.commandSpecs),
    );

    assert.equal(
      await fileExists(ensureWithin(target, taskArtifactPath(taskId, "recovery"))),
      true,
    );
    const tasks = await discoverTasks(target, packageRoot);
    assert.deepEqual(tasks.find((task) => task.taskId === taskId).writeClaims, []);
    assert.deepEqual(tasks.find((task) => task.taskId === "new-owner").writeClaims, ["tests"]);
  });
});

test("task-resume requires active recovery state", async () => {
  const { runTaskResume } = await import("../src/commands/task-resume.js");
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "not-recovered" });
    await assert.rejects(
      () => runTaskResume({ target, packageRoot, taskId }),
      (error) => error.code === "E_TASK_NOT_RECOVERED",
    );
  });
});

test("task-resume can replace historical claims through normal conflict checks", async () => {
  const { runTaskResume } = await import("../src/commands/task-resume.js");
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "resume-new-scope" });
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });

    const result = await runTaskResume({ target, packageRoot, taskId, claims: ["src"] });
    assert.deepEqual(result.reacquiredClaims, ["src"]);
    const descriptor = await readTaskDescriptor(target, taskId, packageRoot);
    assert.deepEqual(descriptor.value.writeClaims, ["src"]);
  });
});

test("task-resume fails closed when historical descriptor claims no longer match recovery state", async () => {
  const { runTaskResume } = await import("../src/commands/task-resume.js");
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "resume-tampered-history" });
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });

    const descriptorPath = ensureWithin(target, taskArtifactPath(taskId, "descriptor"));
    const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
    await writeFile(descriptorPath, `${JSON.stringify({
      ...descriptor,
      writeClaims: ["src"],
    }, null, 2)}\n`, "utf8");

    await assert.rejects(
      () => runTaskResume({ target, packageRoot, taskId }),
      (error) => error.code === "E_TASK_RECOVERY_INCONSISTENT",
    );
    assert.equal(
      await fileExists(ensureWithin(target, taskArtifactPath(taskId, "recovery"))),
      true,
    );
  });
});

test("task-resume succeeds after the conflicting owner reaches COMPLETE", async () => {
  const { runTaskResume } = await import("../src/commands/task-resume.js");
  await withRecoveryTarget(async (target) => {
    const { taskId } = await setupAbandonedTask(target, { taskId: "resume-after-complete" });
    await runTaskRecover({ target, packageRoot, taskId, acknowledgeRecovery: true });
    await runTaskCreate({ target, packageRoot, taskId: "completed-owner", claims: ["tests"] });

    const sourceState = await readWorkState(target, { packageRoot, taskId });
    await writeWorkState(target, createWorkState({
      ...sourceState,
      taskId: "completed-owner",
      phase: "COMPLETE",
      previousPhase: "REVIEWING",
      verificationEvidence: [{ kind: "OBSERVED", source: "fixture", result: "passed" }],
      evidenceCoverage: [],
    }), { packageRoot, taskId: "completed-owner" });

    const result = await runTaskResume({ target, packageRoot, taskId });
    assert.equal(result.resumed, true);
    assert.deepEqual(result.reacquiredClaims, ["tests"]);
    const tasks = await discoverTasks(target, packageRoot);
    assert.deepEqual(tasks.find((task) => task.taskId === "completed-owner").writeClaims, []);
    assert.deepEqual(tasks.find((task) => task.taskId === taskId).writeClaims, ["tests"]);
  });
});
