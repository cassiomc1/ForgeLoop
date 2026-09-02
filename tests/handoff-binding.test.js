import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCanonicalHandoff,
  createCanonicalHandoff,
  validateCanonicalHandoff,
} from "../src/core/handoff.js";
import { canonicalFingerprint } from "../src/core/artifacts.js";
import { readWorkState } from "../src/core/work-state.js";
import { bindTaskWorkspace } from "../src/core/workspace-binding.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

test("buildCanonicalHandoff binds exact work state fingerprint", async () => {
  const target = await createGitRepository("forgeloop-handoff-binding-");
  const taskId = "task-handoff-binding-1";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    const currentState = await readWorkState(target, { packageRoot, taskId });
    const expectedFingerprint = canonicalFingerprint(currentState);

    const handoff = await buildCanonicalHandoff(target, {
      taskId,
      packageRoot,
      note: "testing work-state binding",
    });

    assert.ok(handoff.state.workStateFingerprint, "handoff must contain state.workStateFingerprint");
    assert.equal(
      handoff.state.workStateFingerprint,
      expectedFingerprint,
      "state.workStateFingerprint must match canonicalFingerprint(currentState)",
    );

    const validated = await validateCanonicalHandoff(target, handoff, { taskId, packageRoot });
    assert.equal(validated.state.workStateFingerprint, expectedFingerprint);
  } finally {
    await removeTempTree(target);
  }
});

test("handoff creation rejects repository drift even when changed paths are empty", async () => {
  const target = await createGitRepository("forgeloop-handoff-binding-");
  const taskId = "task-handoff-binding-repository-drift";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    await writeFile(`${target}/repository-only.txt`, "repository drift", "utf8");
    execFileSync("git", ["-C", target, "add", "repository-only.txt"]);
    execFileSync("git", ["-C", target, "-c", "user.name=ForgeLoop Test", "-c", "user.email=test@example.com", "commit", "-m", "repository drift"]);

    await assert.rejects(
      () => createCanonicalHandoff(target, { taskId, packageRoot }),
      (err) => err.code === "E_HANDOFF_STATE_UNAVAILABLE",
    );
  } finally {
    await removeTempTree(target);
  }
});

test("legacy handoff without workStateFingerprint remains schema valid", async () => {
  const target = await createGitRepository("forgeloop-handoff-binding-");
  const taskId = "task-handoff-binding-2";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    const handoff = await buildCanonicalHandoff(target, {
      taskId,
      packageRoot,
      note: "legacy handoff simulation",
    });

    // Strip workStateFingerprint to simulate legacy envelope
    const { workStateFingerprint: _, ...legacyState } = handoff.state;
    const { artifactDigest: __, ...legacyBodyWithoutDigest } = {
      ...handoff,
      state: legacyState,
    };
    const legacyHandoff = {
      ...legacyBodyWithoutDigest,
      artifactDigest: canonicalFingerprint(legacyBodyWithoutDigest),
    };

    assert.equal("workStateFingerprint" in legacyHandoff.state, false);
    const validated = await validateCanonicalHandoff(target, legacyHandoff, { taskId, packageRoot });
    assert.ok(validated);
  } finally {
    await removeTempTree(target);
  }
});
