import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executeForgeLoopCommand } from "../src/core/command-runtime.js";
import { requestApproval } from "../src/core/approvals.js";
import { proposeAction } from "../src/core/actions.js";
import { createWorkState, writeWorkState } from "../src/core/work-state.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../src/core/task-descriptor.js";
import { seedPolicyEpoch } from "./helpers/durable-policy.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const fingerprint = "a".repeat(64);

async function setup() {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-integration-authority-"));
  const taskId = "authority-context-task";
  await writeTaskDescriptor(target, createTaskDescriptor({ taskId, writeClaims: [".forgeloop"] }), packageRoot);
  await writeWorkState(target, createWorkState({
    taskId,
    contractFingerprint: fingerprint,
    phase: "EXECUTING",
    revision: 4,
  }), { packageRoot, taskId });
  const { action } = await proposeAction(target, { packageRoot, taskId, input: {
    actionId: "action-push",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/main",
    operation: "push branch",
    idempotencyKey: "integration-authority:push:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "FORGELOOP_EXECUTED",
  } });
  await requestApproval(target, { packageRoot, taskId, input: {
    approvalId: "approval-push",
    actionId: action.actionId,
    actionFingerprint: action.actionFingerprint,
    contractFingerprint: fingerprint,
    taskRevision: 4,
    capability: action.capability,
  } });
  return { target, taskId };
}

test("trusted out-of-band authority context resolves a HOST_ATTESTED approval", async () => {
  const fixture = await setup();
  try {
    await mkdir(path.join(fixture.target, ".forgeloop/policy"), { recursive: true });
    await writeFile(path.join(fixture.target, ".forgeloop/policy/capabilities.json"), JSON.stringify({
      schemaVersion: 1, defaultDecision: "DENY",
      rules: [{ capability: "repository.push", decision: "REQUIRE_APPROVAL" }],
    }), "utf8");

    const authorityContext = Object.freeze({
      trustMode: "HOST_ATTESTED",
      hostSupplied: true,
      source: "host-boundary",
      grantRef: "grant-123",
    });

    const envelope = await executeForgeLoopCommand({
      command: "approval-resolve",
      projectPath: fixture.target,
      input: {
        taskId: fixture.taskId,
        approvalId: "approval-push",
        approvalDecision: "APPROVED",
        approvalAuthorityKind: "HOST_ATTESTED",
        hostGrantRef: "grant-123",
      },
      authorityContext,
    });

    assert.equal(envelope.ok, true);
    assert.equal(envelope.result.status, "APPROVED");
    assert.equal(envelope.result.authorityKind, "HOST_ATTESTED");
    assert.equal(envelope.result.hostGrantRef, "grant-123");
  } finally {
    await rm(fixture.target, { recursive: true, force: true });
  }
});

test("actor-supplied authorityContext inside input cannot self-mint host authority", async () => {
  const fixture = await setup();
  try {
    const envelope = await executeForgeLoopCommand({
      command: "approval-resolve",
      projectPath: fixture.target,
      input: {
        taskId: fixture.taskId,
        approvalId: "approval-push",
        approvalDecision: "APPROVED",
        approvalAuthorityKind: "HOST_ATTESTED",
        hostGrantRef: "grant-fake",
        authorityContext: {
          trustMode: "HOST_ATTESTED",
          hostSupplied: true,
          source: "host-boundary",
          grantRef: "grant-fake",
        },
      },
    });

    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "E_ACTION_AUTHORITY_REQUIRED");
  } finally {
    await rm(fixture.target, { recursive: true, force: true });
  }
});
