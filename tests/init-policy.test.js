import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runInit, E_POLICY_INITIALIZATION_FAILED, POLICY_INIT_ARTIFACTS } from "../src/commands/init.js";
import { readManifest, sha256 } from "../src/core/manifest.js";
import { detectPolicyCapability, verifyPolicyLock, readDiscoveryReport } from "../src/core/policy-engine.js";
import { readBaseline } from "../src/core/policy-baseline.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const PACKAGE_VERSION = "1.2.1";

async function createTempTarget() {
  return mkdtemp(path.join(os.tmpdir(), "forgeloop-init-policy-"));
}

async function snapshotTree(root) {
  const result = {};
  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else {
        result[rel] = sha256(await readFile(full));
      }
    }
  }
  try {
    await walk(root, "");
  } catch {
    // Root may not exist yet.
  }
  return result;
}

async function assertInitialized(target) {
  assert.ok(await readManifest(target), "manifest must exist after successful init");
  assert.equal(await detectPolicyCapability(target, packageRoot), "AVAILABLE");
  const lock = await verifyPolicyLock(target, packageRoot);
  assert.equal(lock.status, "VALID", `policy.lock must verify: ${JSON.stringify(lock)}`);
}

const injectedFailure = async () => {
  throw new Error("injected deterministic failure");
};

test("INIT-POLICY-1: policy discovery failure fails init with no manifest", async () => {
  const target = await createTempTarget();
  try {
    await assert.rejects(
      () => runInit({
        target,
        dryRun: false,
        packageRoot,
        packageVersion: PACKAGE_VERSION,
        hooks: { afterPolicyDiscovery: injectedFailure },
      }),
      (error) => error.code === E_POLICY_INITIALIZATION_FAILED,
    );
    assert.equal(await readManifest(target), null, "no initialization authority may exist");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-2: baseline write failure fails init and a retry succeeds", async () => {
  const target = await createTempTarget();
  try {
    await assert.rejects(
      () => runInit({
        target,
        dryRun: false,
        packageRoot,
        packageVersion: PACKAGE_VERSION,
        hooks: { beforeBaselineWrite: injectedFailure },
      }),
      (error) => error.code === E_POLICY_INITIALIZATION_FAILED,
    );
    assert.equal(await readManifest(target), null, "manifest must be absent after baseline failure");
    assert.ok(await readManifest(target) === null);

    // Retry without hooks must recover deterministically.
    await runInit({ target, dryRun: false, packageRoot, packageVersion: PACKAGE_VERSION });
    await assertInitialized(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-3: policy lock write failure fails init and a retry succeeds", async () => {
  const target = await createTempTarget();
  try {
    await assert.rejects(
      () => runInit({
        target,
        dryRun: false,
        packageRoot,
        packageVersion: PACKAGE_VERSION,
        hooks: { beforePolicyLockWrite: injectedFailure },
      }),
      (error) => error.code === E_POLICY_INITIALIZATION_FAILED,
    );
    assert.equal(await readManifest(target), null);

    await runInit({ target, dryRun: false, packageRoot, packageVersion: PACKAGE_VERSION });
    await assertInitialized(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-4: manifest write failure is retried without manual cleanup", async () => {
  const target = await createTempTarget();
  try {
    await assert.rejects(
      () => runInit({
        target,
        dryRun: false,
        packageRoot,
        packageVersion: PACKAGE_VERSION,
        hooks: { beforeManifestWrite: injectedFailure },
      }),
      (error) => error.code === E_POLICY_INITIALIZATION_FAILED,
    );
    assert.equal(await readManifest(target), null);

    // Retry recognizes already-correct kit and policy files and commits the manifest.
    const retry = await runInit({ target, dryRun: false, packageRoot, packageVersion: PACKAGE_VERSION });
    assert.ok(retry.actions.some((action) => action.action === "reuse"), "retry must reuse already-correct files");
    await assertInitialized(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-5: unknown architecture succeeds autonomously with uncertainty", async () => {
  const target = await createTempTarget();
  try {
    // A bare src/ directory yields LOW/UNKNOWN architecture confidence, which
    // is legitimate autonomy, not an infrastructure failure.
    await mkdir(path.join(target, "src"), { recursive: true });
    await mkdir(path.join(target, "misc"), { recursive: true });

    await runInit({ target, dryRun: false, packageRoot, packageVersion: PACKAGE_VERSION });
    await assertInitialized(target);
    const discovery = await readDiscoveryReport(target, packageRoot);
    assert.ok(["LOW", "UNKNOWN"].includes(discovery.architecture.confidence));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-6: successful initialization produces valid manifest and verified policy state", async () => {
  const target = await createTempTarget();
  try {
    await runInit({ target, dryRun: false, packageRoot, packageVersion: PACKAGE_VERSION });
    await assertInitialized(target);
    assert.ok((await readBaseline(target, packageRoot)).schemaVersion === 1);
    for (const artifact of POLICY_INIT_ARTIFACTS) {
      await readFile(path.join(target, artifact), "utf8");
    }
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("INIT-POLICY-7: dry-run performs zero writes", async () => {
  const target = await createTempTarget();
  try {
    const before = await snapshotTree(target);
    await runInit({ target, dryRun: true, packageRoot, packageVersion: PACKAGE_VERSION });
    const after = await snapshotTree(target);
    assert.deepEqual(after, before, "dry-run must not write any files");
    assert.equal(await readManifest(target), null);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
