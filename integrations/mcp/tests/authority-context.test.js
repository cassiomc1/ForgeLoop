import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { executeForgeLoopCommand } from "@cassiomc1/forgeloop/integration";

import { proposeAction } from "../../../src/core/actions.js";
import { requestApproval } from "../../../src/core/approvals.js";
import { createWorkState, writeWorkState } from "../../../src/core/work-state.js";
import { createTaskDescriptor, writeTaskDescriptor } from "../../../src/core/task-descriptor.js";
import { seedPolicyEpoch } from "../../../tests/helpers/durable-policy.js";
import { getPackageRoot as corePackageRoot } from "../../../src/core/templates.js";

import { createForgeLoopMcpServer } from "../src/server.js";
import { buildToolRegistrations, commandToToolName } from "../src/tool-registry.js";
import { resolveLaunchPolicy, SERVER_MODES } from "../src/capability-policy.js";

const packageRoot = corePackageRoot();
const fingerprint = "a".repeat(64);

async function setupPendingApproval(target, taskId) {
  await writeTaskDescriptor(target, createTaskDescriptor({ taskId, writeClaims: ["src"] }), packageRoot);
  await seedPolicyEpoch(target, packageRoot, taskId, {
    schemaVersion: 1,
    defaultDecision: "DENY",
    rules: [{ capability: "repository.push", decision: "REQUIRE_APPROVAL" }],
  });
  // seedPolicyEpoch writes its own snapshot; keep work state bound to the
  // approval contract fingerprint.
  const { action } = await proposeAction(target, { packageRoot, taskId, input: {
    actionId: "action-push",
    effectClass: "EXTERNAL_PUBLICATION",
    capability: "repository.push",
    target: "origin/main",
    operation: "push branch",
    idempotencyKey: "mcp-authority:push:v1",
    requiredForCompletion: true,
    requirement: "publication",
    provenance: "FORGELOOP_EXECUTED",
  } });
  const state = createWorkState({
    taskId,
    contractFingerprint: fingerprint,
    phase: "EXECUTING",
    revision: 4,
  });
  await writeWorkState(target, state, { packageRoot, taskId });
  await requestApproval(target, { packageRoot, taskId, input: {
    approvalId: "approval-push",
    actionId: action.actionId,
    actionFingerprint: action.actionFingerprint,
    contractFingerprint: fingerprint,
    taskRevision: 4,
    capability: action.capability,
  } });
}

test("actor-supplied authorityContext in tool args is stripped; safe MCP cannot self-approve", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-mcp-auth-args-"));
  const taskId = "mcp-auth-args-task";
  try {
    await setupPendingApproval(target, taskId);
    const policy = resolveLaunchPolicy({ mode: SERVER_MODES.FULL, allowApprovalResolution: true });
    const registrations = buildToolRegistrations({ projectRoot: target, policy });
    const registration = registrations.find((r) => r.name === commandToToolName("approval-resolve"));
    assert.ok(registration, "allowApprovalResolution exposes the transport surface");

    const result = await registration.handler({
      taskId,
      approvalId: "approval-push",
      approvalDecision: "APPROVED",
      approvalAuthorityKind: "HOST_ATTESTED",
      hostGrantRef: "grant-fake",
      // Actor attempts to smuggle host authority through tool args.
      authorityContext: {
        trustMode: "HOST_ATTESTED",
        hostSupplied: true,
        source: "host-boundary",
        grantRef: "grant-fake",
      },
    });
    assert.equal(result.isError, true);
    const text = JSON.stringify(result.structuredContent ?? result.content);
    assert.match(text, /E_ACTION_AUTHORITY_REQUIRED/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("embedded trusted host provider resolves HOST_ATTESTED approvals out-of-band", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-mcp-auth-provider-"));
  const taskId = "mcp-auth-provider-task";
  try {
    await setupPendingApproval(target, taskId);
    const policy = resolveLaunchPolicy({ mode: SERVER_MODES.FULL, allowApprovalResolution: true });
    const registrations = buildToolRegistrations({
      projectRoot: target,
      policy,
      authorityContextProvider: async ({ command }) => {
        if (command !== "approval-resolve") return null;
        return {
          trustMode: "HOST_ATTESTED",
          hostSupplied: true,
          source: "host-boundary",
          grantRef: "host-grant-42",
        };
      },
    });
    const registration = registrations.find((r) => r.name === commandToToolName("approval-resolve"));
    assert.ok(registration);

    const result = await registration.handler({
      taskId,
      approvalId: "approval-push",
      approvalDecision: "APPROVED",
      approvalAuthorityKind: "HOST_ATTESTED",
      hostGrantRef: "host-grant-42",
    });
    assert.equal(result.isError, false);
    const structured = result.structuredContent ?? JSON.parse(result.content[0].text);
    assert.equal(structured.ok, true);
    assert.equal(structured.result.status, "APPROVED");
    assert.equal(structured.result.authorityKind, "HOST_ATTESTED");
    assert.equal(structured.result.hostGrantRef, "host-grant-42");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("launch flag alone without provider cannot mint host authority", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-mcp-auth-flagonly-"));
  const taskId = "mcp-auth-flagonly-task";
  try {
    await setupPendingApproval(target, taskId);
    const created = await createForgeLoopMcpServer({
      projectPath: target,
      mode: SERVER_MODES.FULL,
      allowApprovalResolution: true,
    });
    assert.equal(created.policy.allowApprovalResolution, true);
    const envelope = await executeForgeLoopCommand({
      command: "approval-resolve",
      projectPath: target,
      input: {
        taskId,
        approvalId: "approval-push",
        approvalDecision: "APPROVED",
        approvalAuthorityKind: "HOST_ATTESTED",
        hostGrantRef: "grant-transport",
      },
    });
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "E_ACTION_AUTHORITY_REQUIRED");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
