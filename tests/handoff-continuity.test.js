import assert from "node:assert/strict";
import { test } from "node:test";

import { createCanonicalHandoff } from "../src/core/handoff.js";
import { reconcileContinuity } from "../src/core/continuity-reconciliation.js";
import { getPackageRoot } from "../src/core/templates.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";

const packageRoot = getPackageRoot();

test("continuity reconciliation exposes the latest handoff as operational context only", async () => {
  const target = await createGitRepository("forgeloop-handoff-continuity-");
  const taskId = "handoff-continuity-001";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    const created = await createCanonicalHandoff(target, { target, packageRoot, taskId, handoffId: "handoff-continuity-fixed" });
    const result = await reconcileContinuity({ target, packageRoot, taskId });
    assert.equal(result.latestHandoff.handoffId, created.handoff.handoffId);
    assert.equal(result.latestHandoff.digest, created.handoff.artifactDigest);
    assert.equal(result.latestHandoff.evidenceAuthority, undefined);
    assert.equal(result.authority, "OPERATIONAL_CONTEXT_ONLY");
  } finally {
    await removeTempTree(target);
  }
});
