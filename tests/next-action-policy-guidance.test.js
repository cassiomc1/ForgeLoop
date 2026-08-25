import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { requestApproval, resolveApproval } from "../src/core/approvals.js";
import {
  proposeAction,
  transitionAction,
  transitionAuthorizedAction,
} from "../src/core/actions.js";
import { getNextAction, NEXT_ACTIONS } from "../src/core/next-action.js";
import { readWorkState } from "../src/core/work-state.js";
import { getPackageRoot } from "../src/core/templates.js";
import { taskActionPath } from "../src/core/task-paths.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";

const packageRoot = getPackageRoot();

const trustedAuthority = Object.freeze({
  trustMode: "HOST_ATTESTED",
  hostSupplied: true,
  source: "host-boundary",
  grantRef: "grant-next-policy",
});

async function withProposedAction(run, {
  decision = "ALLOW",
  capability = "filesystem.write",
  taskId = `next-policy-${decision.toLowerCase().replaceAll("_", "-")}`,
} = {}) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-next-policy-"));
  try {
    await setupVerifyingTask(target, packageRoot, {
      taskId,
      capabilityPolicy: {
        schemaVersion: 1,
        defaultDecision: "DENY",
        rules: capability === "unknown.capability" ? [] : [{ capability, decision }],
      },
    });
    const { action } = await proposeAction(target, {
      packageRoot,
      taskId,
      input: {
        actionId: "action-policy",
        effectClass: "REVERSIBLE_WRITE",
        capability,
        target: "workspace/item",
        operation: "update item",
        idempotencyKey: `${taskId}:action:v1`,
        requiredForCompletion: true,
        requirement: "postcondition",
        provenance: "CALLER_REPORTED",
      },
    });
    await run({ target, taskId, action });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("next keeps ALLOW authorization guidance for a proposed required action", async () => {
  await withProposedAction(async ({ target, taskId }) => {
    const result = await getNextAction({ target, packageRoot, taskId });

    assert.equal(result.nextAction, NEXT_ACTIONS.AUTHORIZE_ACTION);
    assert.ok(result.commands.some((command) => command.includes("action-authorize")));
    assert.equal(result.capabilityDecision.decision, "ALLOW");
  });
});

test("next requests approval instead of recommending authorization when policy requires it", async () => {
  await withProposedAction(async ({ target, taskId }) => {
    const result = await getNextAction({ target, packageRoot, taskId });

    assert.equal(result.nextAction, NEXT_ACTIONS.REQUEST_ACTION_APPROVAL);
    assert.ok(result.commands.some((command) => command.includes("approval-request")));
    assert.equal(result.commands.some((command) => command.includes("action-authorize")), false);
    assert.equal(result.approvalRequired.actionId, "action-policy");
    assert.equal(result.capabilityDecision.decision, "REQUIRE_APPROVAL");
  }, { decision: "REQUIRE_APPROVAL" });
});

test("next exposes host resolution for a pending approval without an impossible CLI command", async () => {
  await withProposedAction(async ({ target, taskId, action }) => {
    const state = await readWorkState(target, { packageRoot, taskId });
    await requestApproval(target, {
      packageRoot,
      taskId,
      input: {
        approvalId: "approval-policy",
        actionId: action.actionId,
        actionFingerprint: action.actionFingerprint,
        contractFingerprint: state.contractFingerprint,
        taskRevision: state.revision,
        capability: action.capability,
      },
    });

    const result = await getNextAction({ target, packageRoot, taskId });

    assert.equal(result.nextAction, NEXT_ACTIONS.RESOLVE_ACTION_APPROVAL);
    assert.deepEqual(result.commands, []);
    assert.equal(result.authorityRequired.kind, "HOST_ATTESTED");
    assert.equal(result.authorityRequired.approvalId, "approval-policy");
  }, { decision: "REQUIRE_APPROVAL" });
});

test("next accepts a valid trusted approval and returns authorization guidance", async () => {
  await withProposedAction(async ({ target, taskId, action }) => {
    const state = await readWorkState(target, { packageRoot, taskId });
    await requestApproval(target, {
      packageRoot,
      taskId,
      input: {
        approvalId: "approval-policy",
        actionId: action.actionId,
        actionFingerprint: action.actionFingerprint,
        contractFingerprint: state.contractFingerprint,
        taskRevision: state.revision,
        capability: action.capability,
      },
    });
    await resolveApproval(target, {
      packageRoot,
      taskId,
      approvalId: "approval-policy",
      decision: "APPROVED",
      authorityKind: "HOST_ATTESTED",
      hostGrantRef: trustedAuthority.grantRef,
      authorityContext: trustedAuthority,
    });

    const result = await getNextAction({ target, packageRoot, taskId });

    assert.equal(result.nextAction, NEXT_ACTIONS.AUTHORIZE_ACTION);
    assert.ok(result.commands.some((command) => command.includes("action-authorize")));
    assert.equal(result.capabilityDecision.decision, "REQUIRE_APPROVAL");
    assert.equal(result.capabilityDecision.approvalId, "approval-policy");
  }, { decision: "REQUIRE_APPROVAL" });
});

test("next blocks REQUIRE_AUTHORITY without trusted authority and recommends authorization with it", async () => {
  await withProposedAction(async ({ target, taskId }) => {
    const blocked = await getNextAction({ target, packageRoot, taskId });
    assert.equal(blocked.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);
    assert.deepEqual(blocked.commands, []);
    assert.equal(blocked.authorityRequired.kind, "HOST_ATTESTED");
    assert.equal(blocked.capabilityDecision.decision, "REQUIRE_AUTHORITY");

    const trusted = await getNextAction({ target, packageRoot, taskId, authorityContext: trustedAuthority });
    assert.equal(trusted.nextAction, NEXT_ACTIONS.AUTHORIZE_ACTION);
    assert.ok(trusted.commands.some((command) => command.includes("action-authorize")));
    assert.equal(trusted.capabilityDecision.authorityRef, trustedAuthority.grantRef);
  }, { decision: "REQUIRE_AUTHORITY" });
});

test("next blocks denied and unknown capabilities without authorization guidance", async () => {
  await withProposedAction(async ({ target, taskId }) => {
    const result = await getNextAction({ target, packageRoot, taskId });
    assert.equal(result.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);
    assert.deepEqual(result.commands, []);
    assert.equal(result.reasonCodes.includes("E_ACTION_CAPABILITY_DENIED"), true);
  }, { decision: "DENY" });

  await withProposedAction(async ({ target, taskId, action }) => {
    const actionPath = path.join(target, taskActionPath(taskId, action.actionId));
    const artifact = JSON.parse(await readFile(actionPath, "utf8"));
    artifact.capability = "unknown.capability";
    await writeFile(actionPath, `${JSON.stringify(artifact)}\n`, "utf8");
    const result = await getNextAction({ target, packageRoot, taskId });
    assert.equal(result.nextAction, NEXT_ACTIONS.RESOLVE_BLOCKER);
    assert.deepEqual(result.commands, []);
    assert.equal(result.reasonCodes.includes("E_ACTION_INVALID"), true);
  }, {
    decision: "DENY",
    taskId: "next-policy-unknown",
  });
});

test("next preserves COMMIT_UNKNOWN reconciliation priority over policy guidance", async () => {
  await withProposedAction(async ({ target, taskId, action }) => {
    await transitionAuthorizedAction(target, {
      packageRoot,
      taskId,
      actionId: action.actionId,
      expectedRevision: action.revision,
      expectedFingerprint: action.actionFingerprint,
      details: {
        actionFingerprint: action.actionFingerprint,
        capabilityDecision: "ALLOW",
        capabilityPolicyFingerprint: "a".repeat(64),
        policyLockDigest: `sha256:${"b".repeat(64)}`,
        taskPolicyDigest: `sha256:${"c".repeat(64)}`,
      },
    });
    await transitionAction(target, { packageRoot, taskId, actionId: action.actionId, to: "STARTED" });
    await transitionAction(target, {
      packageRoot,
      taskId,
      actionId: action.actionId,
      to: "COMMIT_UNKNOWN",
      details: { commitResultCode: "AMBIGUOUS", reason: "outcome unavailable" },
    });

    const result = await getNextAction({ target, packageRoot, taskId });
    assert.equal(result.nextAction, NEXT_ACTIONS.RECONCILE_ACTION);
    assert.equal(result.commands.some((command) => command.includes("action-reconcile")), true);
  }, { decision: "ALLOW" });
});
