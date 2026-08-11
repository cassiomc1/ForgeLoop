import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  classifyWorkState,
  clearWorkState,
  contractFingerprint,
  createWorkState,
  currentRepositoryFingerprint,
  readWorkState,
  writeWorkState,
} from "../src/core/work-state.js";

function input(overrides = {}) {
  return {
    taskId: "state-task-1",
    contractFingerprint: contractFingerprint({ objective: "verify state" }),
    repositoryFingerprint: { branch: "main", head: "old-head" },
    phase: "VERIFYING",
    selectedGuides: ["clean", "test"],
    completedSteps: ["implementation"],
    pendingSteps: ["verification"],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
    ...overrides,
  };
}

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-state-"));
  try {
    await run(target);
  } finally {
    await rm(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

test("contract fingerprints are stable for object key order", () => {
  assert.equal(
    contractFingerprint({ b: 2, a: { d: 4, c: 3 } }),
    contractFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
  );
});

test("work state creation adds protocol metadata and validates guides", () => {
  const state = createWorkState(input());

  assert.equal(state.schemaVersion, 1);
  assert.equal(state.protocolVersion, 1);
  assert.match(state.lastUpdated, /^\d{4}-\d{2}-\d{2}T/);
});

test("changed HEAD requires state revalidation", () => {
  const state = createWorkState(input());
  const result = classifyWorkState(state, { branch: "main", head: "new-head" });

  assert.equal(result.status, "REVALIDATION_REQUIRED");
  assert.ok(result.reasons.includes("REPOSITORY_CHANGED"));
});

test("complete and blocked phases require their evidence", () => {
  assert.throws(
    () => createWorkState(input({ phase: "COMPLETE" })),
    /verification evidence/i,
  );
  assert.throws(
    () => createWorkState(input({ phase: "BLOCKED" })),
    /blocker/i,
  );
  assert.throws(
    () => createWorkState(input({ phase: "CORRECTING" })),
    /diagnosed hypothesis/i,
  );
});

test("invalid or secret-like state is rejected on read and write", async () => {
  await withTarget(async (target) => {
    assert.throws(
      () => createWorkState(input({ apiKey: "secret" })),
      /secret|credential/i,
    );

    const statePath = path.join(target, ".mdfiles", "work-state.json");
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, "{\"schemaVersion\":", "utf8");
    await assert.rejects(() => readWorkState(target), /parse|JSON|invalid/i);
  });
});

test("state writes are atomic and clear preserves sibling files", async () => {
  await withTarget(async (target) => {
    const state = createWorkState(input());
    await writeWorkState(target, state);
    await writeFile(path.join(target, ".mdfiles", "manifest.json"), "{}\n");

    const stored = JSON.parse(await readFile(path.join(target, ".mdfiles", "work-state.json"), "utf8"));
    assert.deepEqual(stored, state);
    assert.deepEqual((await readdir(path.join(target, ".mdfiles"))).sort(), ["manifest.json", "work-state.json"]);

    const result = await clearWorkState(target);
    assert.equal(result.removed, true);
    assert.equal(await readFile(path.join(target, ".mdfiles", "manifest.json"), "utf8"), "{}\n");
    assert.equal((await clearWorkState(target)).removed, false);
  });
});

test("non-Git targets report an unavailable repository fingerprint", async () => {
  await withTarget(async (target) => {
    assert.deepEqual(await currentRepositoryFingerprint(target), { branch: null, head: null });
  });
});
