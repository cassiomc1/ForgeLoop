import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ACTION_EFFECT_CLASSES,
  ACTION_STATES,
  ACTION_PROVENANCE,
  ACTION_CAPABILITIES,
  CAPABILITY_DECISIONS,
} from "../src/core/action-constants.js";
import {
  canonicalActionFingerprint,
  assertActionTransition,
  actionRequiresIdempotency,
  actionIsTerminal,
  validateActionArtifact,
  validateApprovalArtifact,
  validateCapabilityPolicy,
} from "../src/core/action-model.js";

function readFixture(...parts) {
  const root = path.resolve(import.meta.dirname);
  return readFile(path.join(root, "fixtures", ...parts), "utf8").then(JSON.parse);
}

test("action vocabularies match the frozen protocol contract", () => {
  assert.deepEqual([...ACTION_EFFECT_CLASSES], [
    "READ_ONLY",
    "REVERSIBLE_WRITE",
    "IRREVERSIBLE_WRITE",
    "EXTERNAL_PUBLICATION",
    "DESTRUCTIVE",
  ]);
  assert.deepEqual([...ACTION_STATES], [
    "PROPOSED",
    "AUTHORIZED",
    "STARTED",
    "COMMITTED",
    "VERIFIED",
    "FAILED",
    "COMMIT_UNKNOWN",
    "CANCELLED",
  ]);
  assert.deepEqual([...ACTION_PROVENANCE], [
    "FORGELOOP_EXECUTED",
    "HOST_ATTESTED",
    "CALLER_REPORTED",
    "HOST_REPORTED",
    "EXTERNAL_OBSERVED",
  ]);
  assert.deepEqual([...ACTION_CAPABILITIES], [
    "filesystem.read",
    "filesystem.write",
    "process.execute",
    "dependency.install",
    "network.read",
    "network.write",
    "repository.commit",
    "repository.push",
    "repository.pull_request",
    "external.publish",
    "external.delete",
    "deployment.execute",
  ]);
  assert.deepEqual([...CAPABILITY_DECISIONS], [
    "ALLOW",
    "DENY",
    "REQUIRE_AUTHORITY",
    "REQUIRE_APPROVAL",
  ]);
});

function validActionInput(overrides = {}) {
  return {
    taskId: "task-1",
    actionId: "action-push",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/main",
    operation: "push branch",
    idempotencyKey: "task-1:push:origin-main:v1",
    requiredForCompletion: true,
    requirement: "publication",
    ...overrides,
  };
}

test("canonicalActionFingerprint covers immutable identity fields only", () => {
  const base = canonicalActionFingerprint(validActionInput());

  assert.equal(
    canonicalActionFingerprint(validActionInput()),
    base,
    "same identity fields produce the same fingerprint",
  );

  for (const key of Object.keys(validActionInput())) {
    const changed = validActionInput({ [key]: key === "requiredForCompletion" ? false : "changed" });
    if (key === "taskId" || key === "requiredForCompletion") continue;
    assert.notEqual(canonicalActionFingerprint(changed), base, `${key} participates in the fingerprint`);
  }

  assert.equal(
    canonicalActionFingerprint(validActionInput({ extraIgnored: true })),
    base,
    "unknown fields are excluded from the fingerprint",
  );
});

test("side-effecting classes require idempotency; READ_ONLY does not", () => {
  for (const effectClass of ACTION_EFFECT_CLASSES) {
    assert.equal(
      actionRequiresIdempotency(effectClass),
      effectClass !== "READ_ONLY",
      effectClass,
    );
  }
});

test("terminal states are exactly VERIFIED, FAILED, CANCELLED", () => {
  assert.deepEqual(ACTION_STATES.filter(actionIsTerminal), ["VERIFIED", "FAILED", "CANCELLED"]);
});

test("transition map allows exactly the planned edges and nothing else", () => {
  const allowed = [
    ["PROPOSED", "AUTHORIZED"],
    ["PROPOSED", "CANCELLED"],
    ["AUTHORIZED", "STARTED"],
    ["AUTHORIZED", "CANCELLED"],
    ["STARTED", "COMMITTED"],
    ["STARTED", "FAILED"],
    ["STARTED", "COMMIT_UNKNOWN"],
    ["COMMITTED", "VERIFIED"],
    ["COMMITTED", "COMMIT_UNKNOWN"],
    ["COMMIT_UNKNOWN", "COMMITTED"],
    ["COMMIT_UNKNOWN", "AUTHORIZED"],
    ["COMMIT_UNKNOWN", "COMMIT_UNKNOWN"],
  ];
  for (const [from, to] of allowed) {
    assert.doesNotThrow(() => assertActionTransition(from, to), `${from} -> ${to}`);
  }

  const forbidden = [];
  for (const from of ACTION_STATES) {
    for (const to of ACTION_STATES) {
      if (allowed.some(([f, t]) => f === from && t === to)) continue;
      forbidden.push([from, to]);
    }
  }
  for (const [from, to] of forbidden) {
    assert.throws(() => assertActionTransition(from, to), `${from} -/-> ${to} must be rejected`);
  }
  assert.equal(forbidden.length, ACTION_STATES.length * ACTION_STATES.length - allowed.length);
});

test("validateActionArtifact rejects unknown states, unknown capabilities, and missing keys", () => {
  const base = {
    schemaVersion: 1,
    taskId: "task-1",
    actionId: "action-push",
    actionFingerprint: canonicalActionFingerprint(validActionInput()),
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    operation: "push branch",
    target: "origin/main",
    idempotencyKey: "task-1:push:origin-main:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "HOST_REPORTED",
    state: "PROPOSED",
    revision: 0,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateActionArtifact(base));

  assert.throws(() => validateActionArtifact({ ...base, state: "MAYBE" }), /state/i);
  assert.throws(() => validateActionArtifact({ ...base, capability: "github.push" }), /capability/i);
  assert.throws(
    () => validateActionArtifact({ ...base, idempotencyKey: undefined }),
    /idempotencyKey/i,
  );
  assert.doesNotThrow(() =>
    validateActionArtifact({
      ...base,
      effectClass: "READ_ONLY",
      idempotencyKey: null,
      actionFingerprint: canonicalActionFingerprint(validActionInput({ effectClass: "READ_ONLY", idempotencyKey: null })),
    }),
  );
  assert.throws(() => validateActionArtifact({ ...base, unexpected: "x" }), /not an allowed property/);
  assert.throws(
    () => validateActionArtifact({ ...base, actionFingerprint: "zz" }),
    /fingerprint/i,
  );
  assert.throws(
    () =>
      validateActionArtifact({
        ...base,
        target: "origin/other",
        actionFingerprint: canonicalActionFingerprint(validActionInput()),
      }),
    /does not match/i,
  );
});

test("approval artifact schema binds the full fingerprint tuple", async () => {
  const approval = await readFixture("schemas", "approval", "valid-approval.json");
  assert.doesNotThrow(() => validateApprovalArtifact(approval));
  assert.throws(() => validateApprovalArtifact({ ...approval, status: "RESOLVED" }));
  assert.throws(() =>
    validateApprovalArtifact({
      ...approval,
      status: "APPROVED",
      decision: "APPROVED",
      resolvedAt: "2026-08-25T01:00:00.000Z",
      authorityKind: "HOST_ATTESTED",
    }),
    /hostGrantRef|HOST_ATTESTED/i,
  );
  assert.doesNotThrow(() =>
    validateApprovalArtifact({
      ...approval,
      status: "APPROVED",
      decision: "APPROVED",
      resolvedAt: "2026-08-25T01:00:00.000Z",
      authorityKind: "CALLER_ACKNOWLEDGED",
    }),
  );
});

test("action schema fixtures accept valid and reject invalid documents", async () => {
  const valid = await readFixture("schemas", "action", "valid-action.json");
  assert.doesNotThrow(() => validateActionArtifact(valid));

  const invalid = await readFixture("schemas", "action", "invalid-unknown-state.json");
  assert.throws(() => validateActionArtifact(invalid), /state/i);
});

test("capability policy rejects unknown decision values and capabilities", async () => {
  const policy = await readFixture("schemas", "capability-policy", "valid-policy.json");
  assert.doesNotThrow(() => validateCapabilityPolicy(policy));
  assert.throws(() => validateCapabilityPolicy({ ...policy, defaultDecision: "MAYBE" }));
  assert.throws(() =>
    validateCapabilityPolicy({
      ...policy,
      rules: [...policy.rules, { capability: "gmail.send", decision: "ALLOW" }],
    }),
  );
});

function makeValidAction(overrides = {}) {
  const now = "2026-08-25T00:00:00.000Z";
  const base = {
    schemaVersion: 1,
    taskId: "task-1",
    actionId: "action-push",
    actionFingerprint: canonicalActionFingerprint(validActionInput()),
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/main",
    operation: "push branch",
    idempotencyKey: "task-1:push:origin-main:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "FORGELOOP_EXECUTED",
    state: "PROPOSED",
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, ...overrides };
}

test("VERIFIED action artifacts require a canonical lastEvidenceRef", () => {
  const verified = makeValidAction({
    state: "VERIFIED",
    revision: 4,
    lastEvidenceRef: undefined,
  });
  assert.throws(
    () => validateActionArtifact(verified),
    (error) => error.code === "E_ACTION_VERIFICATION_REQUIRED",
  );
});

test("optional action fields are validated when present", () => {
  assert.throws(
    () => validateActionArtifact(makeValidAction({ lastReconciliationAt: "not-a-date" })),
    (error) => error.code === "E_ACTION_INVALID",
  );
  assert.throws(
    () => validateActionArtifact(makeValidAction({ commitResultCode: "MADE_UP" })),
    (error) => error.code === "E_ACTION_INVALID",
  );
  assert.throws(
    () => validateActionArtifact(makeValidAction({ lastEvidenceRef: "" })),
    (error) => error.code === "E_ACTION_INVALID",
  );
});
