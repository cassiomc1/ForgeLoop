import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { contractFingerprint, createWorkState, mutateWorkState, writeWorkState } from "../src/core/work-state.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

function state(overrides = {}) {
  return createWorkState({
    taskId: "revision-task",
    contractFingerprint: contractFingerprint({ objective: "revision" }),
    repositoryFingerprint: { branch: null, head: null },
    phase: "PLANNED",
    selectedGuides: [],
    completedSteps: [],
    pendingSteps: [],
    checks: [], failures: [], blockers: [], verificationEvidence: [],
    ...overrides,
  });
}

test("mutateWorkState rejects a stale expected revision without overwriting newer state", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-state-revision-"));
  try {
    await writeWorkState(target, state(), { packageRoot });
    const first = await mutateWorkState(target, { packageRoot, expectedRevision: 0 }, (current) => ({ ...current, pendingSteps: ["first"] }));
    assert.equal(first.revision, 1);
    await assert.rejects(
      () => mutateWorkState(target, { packageRoot, expectedRevision: 0 }, (current) => ({ ...current, pendingSteps: ["stale"] })),
      (error) => error.code === "E_STATE_REVISION_CONFLICT",
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("concurrent mutations cannot both commit from the same work-state revision", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-state-revision-"));
  try {
    await writeWorkState(target, state(), { packageRoot });
    const results = await Promise.allSettled([
      mutateWorkState(target, { packageRoot, expectedRevision: 0 }, (current) => ({ ...current, pendingSteps: ["first"] })),
      mutateWorkState(target, { packageRoot, expectedRevision: 0 }, (current) => ({ ...current, pendingSteps: ["second"] })),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.code, "E_STATE_REVISION_CONFLICT");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
