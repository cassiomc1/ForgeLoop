import assert from "node:assert/strict";
import test from "node:test";

import { runNext } from "../src/commands/next.js";
import { runStatus } from "../src/commands/status.js";
import { runHandoffCreate } from "../src/commands/handoff-create.js";
import { runHandoffList } from "../src/commands/handoff-list.js";
import { runHandoffShow } from "../src/commands/handoff-show.js";
import { runHandoffAccept } from "../src/commands/handoff-accept.js";
import { bindTaskWorkspace } from "../src/core/workspace-binding.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import { runInit } from "../src/commands/init.js";

const packageRoot = getPackageRoot();

test("fixture repository without advisory providers runs cleanly without errors", async () => {
  const target = await createGitRepository("forgeloop-compat-");
  const taskId = "task-compat-001";
  try {
    await runInit({ target, packageRoot, packageVersion: "1.9.0" });
    await setupVerifyingTask(target, packageRoot, { taskId });

    // Status works cleanly
    const status = await runStatus({ target, packageRoot, taskId });
    assert.equal(status.phase, "VERIFYING");

    // Next action works cleanly
    const next = await runNext({ target, packageRoot, taskId });
    assert.ok(next);

    // Handoff lifecycle works cleanly
    await bindTaskWorkspace(target, { taskId, packageRoot });
    const handoffResult = await runHandoffCreate({
      target,
      packageRoot,
      taskId,
      handoffNote: "Compatibility handoff",
    });
    const handoffId = handoffResult.handoff.handoffId;
    assert.ok(handoffResult.handoff.state.workStateFingerprint);

    const listResult = await runHandoffList({ target, packageRoot, taskId });
    assert.equal(listResult.count, 1);
    assert.equal(listResult.handoffs[0].acceptance.status, "OPEN");

    const acceptResult = await runHandoffAccept({
      target,
      packageRoot,
      taskId,
      handoffId,
      consumerId: "consumer-compat-agent",
    });
    assert.equal(acceptResult.accepted, true);

    const showResult = await runHandoffShow({
      target,
      packageRoot,
      taskId,
      handoffId,
    });
    assert.equal(showResult.acceptance.status, "ACCEPTED");
  } finally {
    await removeTempTree(target);
  }
});
