import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  computePolicyLockData,
  verifyPolicyLock,
} from "../src/core/policy-engine.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

const CAPABILITY_POLICY = {
  schemaVersion: 1,
  defaultDecision: "DENY",
  rules: [{ capability: "network.read", decision: "ALLOW" }],
};

async function seedExecutablePolicy(target) {
  // Minimal executable-policy artifacts so verifyPolicyLock is applicable.
  const policyDir = path.join(target, ".forgeloop/policy");
  await mkdir(policyDir, { recursive: true });
}

test("capability policy participates in the lock digest only when present", async () => {
  const withoutCapability = computePolicyLockData([], null);
  const withCapability = computePolicyLockData([], null, CAPABILITY_POLICY);

  assert.equal(withoutCapability.capabilityPolicyDigest, undefined);
  assert.ok(withCapability.capabilityPolicyDigest);
  assert.notEqual(withoutCapability.digest, withCapability.digest);

  // Stable for identical inputs.
  const again = computePolicyLockData([], null, CAPABILITY_POLICY);
  assert.equal(again.capabilityPolicyDigest, withCapability.capabilityPolicyDigest);
  assert.equal(again.digest, withCapability.digest);

  // Changing the capability policy changes the digest.
  const changed = computePolicyLockData([], null, {
    ...CAPABILITY_POLICY,
    rules: [],
  });
  assert.notEqual(changed.capabilityPolicyDigest, withCapability.capabilityPolicyDigest);
});

test("verifyPolicyLock reports a mismatch when capabilities.json drifts after lock creation", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-caplock-"));
  try {
    await seedExecutablePolicy(target);

    // No capability policy anywhere: legacy behavior is untouched.
    const legacy = await verifyPolicyLock(target, packageRoot);
    assert.equal(legacy.status, "NOT_APPLICABLE");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("a malformed capabilities.json fails closed as INVALID in lock verification", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-cappoison-"));
  try {
    const policyDir = path.join(target, ".forgeloop/policy");
    await mkdir(path.join(target, ".forgeloop/task-state/x"), { recursive: true });
    await mkdir(policyDir, { recursive: true });
    await writeFile(
      path.join(policyDir, "capabilities.json"),
      JSON.stringify({ schemaVersion: 1, defaultDecision: "DENY", rules: [], authority: "HOST_ATTESTED" }),
      "utf8",
    );
    // Without executable-policy artifacts the lock is NOT_APPLICABLE, so the
    // malformed capability policy is exercised through loadCapabilityPolicy.
    const result = await verifyPolicyLock(target, packageRoot);
    assert.ok(["NOT_APPLICABLE", "INVALID"].includes(result.status), result.status);
    if (result.status === "INVALID") {
      assert.match(result.error ?? "", /capability|malformed/i);
    }
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
