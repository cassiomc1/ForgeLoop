import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ensureWithin, fileExists } from "../src/core/filesystem.js";
import {
  acquireProjectClaimsLock,
  CLAIMS_LOCK_REL_PATH,
  classifyProjectClaimsLock,
  readProjectClaimsLockInfo,
  releaseStaleProjectClaimsLockIfUnchanged,
  withProjectClaimsLock,
} from "../src/core/task-lock.js";

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-project-claims-lock-"));
  try {
    await mkdir(path.join(target, ".forgeloop"), { recursive: true });
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function staleLock(overrides = {}) {
  return {
    lockId: "stale-lock",
    scope: "claims-reservation",
    operation: "crashed-operation",
    pid: 1,
    hostname: "fixture",
    processStartToken: "1:1",
    ownerInstanceId: "stale-owner",
    acquiredAt: "2020-01-01T00:00:00.000Z",
    heartbeatAt: "2020-01-01T00:00:00.000Z",
    leaseMs: 1,
    ...overrides,
  };
}

test("project claims lock classifies NONE, LIVE, STALE, UNKNOWN, and CORRUPT", () => {
  assert.equal(classifyProjectClaimsLock(null).status, "NONE");
  assert.equal(classifyProjectClaimsLock({ corrupted: true }).status, "CORRUPT");
  assert.equal(classifyProjectClaimsLock({ lockId: "unknown" }).status, "UNKNOWN");
  assert.equal(classifyProjectClaimsLock(staleLock()).status, "STALE");
  assert.equal(classifyProjectClaimsLock(staleLock({ heartbeatAt: new Date().toISOString(), leaseMs: 300000 })).status, "LIVE");
});

test("project claims lock acquisition auto-settles an unchanged stale lease", async () => {
  await withTarget(async (target) => {
    const lockPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);
    await writeFile(lockPath, `${JSON.stringify(staleLock())}\n`, "utf8");

    const handle = await acquireProjectClaimsLock(target, "replacement-operation");
    assert.notEqual(handle.lockData.lockId, "stale-lock");
    assert.equal((await readProjectClaimsLockInfo(target)).operation, "replacement-operation");
    await handle.release();
    assert.equal(await fileExists(lockPath), false);
  });
});

test("CAS stale project-lock release preserves a replacement owner", async () => {
  await withTarget(async (target) => {
    const lockPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);
    const expected = staleLock();
    const replacement = staleLock({
      lockId: "replacement-lock",
      ownerInstanceId: "replacement-owner",
      heartbeatAt: new Date().toISOString(),
      acquiredAt: new Date().toISOString(),
      leaseMs: 300000,
    });
    await writeFile(lockPath, `${JSON.stringify(replacement)}\n`, "utf8");

    const result = await releaseStaleProjectClaimsLockIfUnchanged(target, expected);
    assert.equal(result.released, false);
    assert.equal(result.reason, "LOCK_CHANGED");
    assert.deepEqual(JSON.parse(await readFile(lockPath, "utf8")), replacement);
  });
});

test("project claims lock fails closed for corrupt and unknown ownership", async () => {
  await withTarget(async (target) => {
    const lockPath = ensureWithin(target, CLAIMS_LOCK_REL_PATH);
    await writeFile(lockPath, "{\"lockId\":", "utf8");
    await assert.rejects(
      () => acquireProjectClaimsLock(target),
      (error) => error.code === "E_PROJECT_CLAIMS_LOCK_INCONSISTENT",
    );

    await writeFile(lockPath, `${JSON.stringify({ lockId: "unknown" })}\n`, "utf8");
    await assert.rejects(
      () => acquireProjectClaimsLock(target),
      (error) => error.code === "E_PROJECT_CLAIMS_LOCK_INCONSISTENT",
    );
  });
});

test("project claims lock serializes contenders and releases after callback failure", async () => {
  await withTarget(async (target) => {
    const first = await acquireProjectClaimsLock(target, "first");
    await assert.rejects(
      () => acquireProjectClaimsLock(target, "second"),
      (error) => error.code === "E_TASK_LOCKED",
    );
    await first.release();

    await assert.rejects(
      () => withProjectClaimsLock(target, "failing", async () => {
        throw new Error("callback failed");
      }),
      /callback failed/,
    );
    assert.equal(await readProjectClaimsLockInfo(target), null);
  });
});
