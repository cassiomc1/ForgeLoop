import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadCapabilityPolicy,
  resolveCapabilityDecision,
  evaluateActionCapability,
  capabilityPolicyWarnings,
} from "../src/core/capability-policy.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

async function makeTarget(policy) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-cappolicy-"));
  if (policy !== undefined) {
    await mkdir(path.join(target, ".forgeloop/policy"), { recursive: true });
    await writeFile(
      path.join(target, ".forgeloop/policy/capabilities.json"),
      JSON.stringify(policy, null, 2),
      "utf8",
    );
  }
  return target;
}

const SAMPLE_POLICY = {
  schemaVersion: 1,
  defaultDecision: "DENY",
  rules: [
    { capability: "network.read", decision: "ALLOW" },
    { capability: "repository.push", decision: "REQUIRE_APPROVAL" },
    { capability: "dependency.install", decision: "REQUIRE_AUTHORITY" },
    { capability: "external.delete", decision: "DENY" },
  ],
};

function action(overrides = {}) {
  const base = {
    taskId: "task-1",
    actionId: "action-push",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/main",
    operation: "push branch",
    idempotencyKey: "k1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "FORGELOOP_EXECUTED",
  };
  return { ...base, ...overrides };
}

test("all four policy decisions resolve deterministically with exact-match rules", async () => {
  const policy = await loadCapabilityPolicy(await makeTarget(SAMPLE_POLICY), packageRoot);
  assert.ok(policy.policy);

  assert.deepEqual(resolveCapabilityDecision(policy.policy, "network.read"), {
    decision: "ALLOW",
    reasonCode: null,
  });
  assert.deepEqual(resolveCapabilityDecision(policy.policy, "external.delete"), {
    decision: "DENY",
    reasonCode: "E_ACTION_CAPABILITY_DENIED",
  });
  assert.deepEqual(resolveCapabilityDecision(policy.policy, "dependency.install"), {
    decision: "REQUIRE_AUTHORITY",
    reasonCode: "E_ACTION_AUTHORITY_REQUIRED",
  });
  assert.deepEqual(resolveCapabilityDecision(policy.policy, "repository.push"), {
    decision: "REQUIRE_APPROVAL",
    reasonCode: "E_ACTION_APPROVAL_REQUIRED",
  });
});

test("unknown capabilities never fall through to allow", async () => {
  const policy = await loadCapabilityPolicy(await makeTarget(SAMPLE_POLICY), packageRoot);
  const resolved = resolveCapabilityDecision(policy.policy, "gmail.send");
  assert.equal(resolved.decision, "DENY");
  assert.equal(resolved.reasonCode, "E_ACTION_CAPABILITY_UNKNOWN");

  // Even an ALLOW default must not rescue an unknown capability.
  const allowAll = await loadCapabilityPolicy(
    await makeTarget({ schemaVersion: 1, defaultDecision: "ALLOW", rules: [] }),
    packageRoot,
  );
  const resolvedUnknown = resolveCapabilityDecision(allowAll.policy, "github.push");
  assert.equal(resolvedUnknown.decision, "DENY");
  assert.equal(resolvedUnknown.reasonCode, "E_ACTION_CAPABILITY_UNKNOWN");

  await assert.rejects(
    loadCapabilityPolicy(
      await makeTarget({
        schemaVersion: 1,
        defaultDecision: "DENY",
        rules: [{ capability: "gmail.send", decision: "ALLOW" }],
      }),
      packageRoot,
    ),
    (error) => error.code === "E_POLICY_INVALID" || error.code === "E_ACTION_INVALID",
  );
});

test("a project-local policy cannot create HOST_ATTESTED authority", async () => {
  const poisoned = structuredClone(SAMPLE_POLICY);
  poisoned.authority = "HOST_ATTESTED";
  poisoned.trustMode = "HOST_ATTESTED";
  // A policy artifact claiming authority/trust metadata is rejected outright.
  await assert.rejects(
    loadCapabilityPolicy(await makeTarget(poisoned), packageRoot),
    (error) => error.code === "E_POLICY_INVALID",
  );

  // Even a HOST_ATTESTED-labeled context backed by a project-local file is
  // not the host boundary.
  const result = await evaluateActionCapability({
    target: await makeTarget(SAMPLE_POLICY),
    packageRoot,
    action: action({ capability: "dependency.install", effectClass: "IRREVERSIBLE_WRITE", idempotencyKey: "k9" }),
    authorityContext: { trustMode: "HOST_ATTESTED", source: "project-local-file" },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "E_ACTION_AUTHORITY_REQUIRED");
});

test("evaluateActionCapability blocks DENY before any launch and allows explicit ALLOW", async () => {
  const denied = await evaluateActionCapability({
    target: await makeTarget({ schemaVersion: 1, defaultDecision: "DENY", rules: [] }),
    packageRoot,
    action: action(),
    authorityContext: { trustMode: "NONE" },
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reasonCode, "E_ACTION_CAPABILITY_DENIED");
  assert.ok(denied.policyFingerprint === null || typeof denied.policyFingerprint === "string");

  const allowed = await evaluateActionCapability({
    target: await makeTarget({
      schemaVersion: 1,
      defaultDecision: "DENY",
      rules: [{ capability: "network.write", decision: "ALLOW" }],
    }),
    packageRoot,
    action: action({ capability: "network.write", effectClass: "REVERSIBLE_WRITE", idempotencyKey: "k2" }),
    authorityContext: { trustMode: "NONE" },
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reasonCode, null);
});

test("REQUIRE_AUTHORITY without a host boundary returns E_ACTION_AUTHORITY_REQUIRED", async () => {
  const result = await evaluateActionCapability({
    target: await makeTarget(SAMPLE_POLICY),
    packageRoot,
    action: action({ capability: "dependency.install", effectClass: "IRREVERSIBLE_WRITE", idempotencyKey: "k3" }),
    authorityContext: { trustMode: "NONE" },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "E_ACTION_AUTHORITY_REQUIRED");
});

test("missing capability policy is compatible for legacy flows but denies new actions", async () => {
  const loaded = await loadCapabilityPolicy(await makeTarget(), packageRoot);
  assert.equal(loaded, null);

  const result = await evaluateActionCapability({
    target: await makeTarget(),
    packageRoot,
    action: action(),
    authorityContext: { trustMode: "NONE" },
  });
  assert.equal(result.allowed, false);
  assert.match(result.reasonCode ?? "", /E_ACTION_(CAPABILITY_DENIED|APPROVAL_REQUIRED)/);
});

test("broad defaultDecision ALLOW produces a least-privilege warning", () => {
  const warnings = capabilityPolicyWarnings({ schemaVersion: 1, defaultDecision: "ALLOW", rules: [] });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, "W_CAPABILITY_POLICY_BROAD_DEFAULT");
});

test("explicit least-privilege policies produce no broad-default warning", () => {
  assert.deepEqual(capabilityPolicyWarnings({ schemaVersion: 1, defaultDecision: "DENY", rules: [] }), []);
});
