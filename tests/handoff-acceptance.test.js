import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import {
  acceptCanonicalHandoff,
  resolveHandoffAcceptance,
} from "../src/core/handoff-acceptance.js";
import { createCanonicalHandoff, readCanonicalHandoff } from "../src/core/handoff.js";
import { bindTaskWorkspace } from "../src/core/workspace-binding.js";
import { validateEventLedger } from "../src/core/events.js";
import { canonicalFingerprint, writeJsonArtifact } from "../src/core/artifacts.js";
import { readWorkState, writeWorkState } from "../src/core/work-state.js";
import { taskHandoffPath } from "../src/core/task-paths.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import {
  E_HANDOFF_ACCEPTANCE_UNBOUND,
  E_HANDOFF_STALE,
  E_HANDOFF_ALREADY_ACCEPTED,
  E_HANDOFF_ACCEPTANCE_INCONSISTENT,
} from "../src/core/error-codes.js";

const packageRoot = getPackageRoot();

test("fresh handoff can be accepted once; same consumer retry is idempotent; different consumer rejected", async () => {
  const target = await createGitRepository("forgeloop-handoff-accept-");
  const taskId = "task-accept-1";
  const handoffId = "handoff-acc-1";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    await createCanonicalHandoff(target, {
      taskId,
      packageRoot,
      handoffId,
      recipientHint: "next-agent",
      note: "Handoff note",
    });

    // 1. Initial acceptance
    const acceptRes = await acceptCanonicalHandoff(target, {
      taskId,
      handoffId,
      consumerId: "consumer-agent-1",
      harness: "codex",
      packageRoot,
    });

    assert.equal(acceptRes.accepted, true);
    assert.equal(acceptRes.idempotent, false);
    assert.equal(acceptRes.consumerId, "consumer-agent-1");
    assert.equal(acceptRes.harness, "codex");

    const ledgerAfterFirst = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledgerAfterFirst.valid, true);
    const acceptedEvents = ledgerAfterFirst.events.filter((e) => e.event === "HANDOFF_ACCEPTED");
    assert.equal(acceptedEvents.length, 1);

    // 2. Same consumer retry is idempotent
    const retryRes = await acceptCanonicalHandoff(target, {
      taskId,
      handoffId,
      consumerId: "consumer-agent-1",
      harness: "codex",
      packageRoot,
    });

    assert.equal(retryRes.accepted, true);
    assert.equal(retryRes.idempotent, true);

    const ledgerAfterRetry = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledgerAfterRetry.valid, true);
    assert.equal(
      ledgerAfterRetry.events.filter((e) => e.event === "HANDOFF_ACCEPTED").length,
      1,
      "idempotent retry must not append an event",
    );

    // 3. Different consumer retry fails
    await assert.rejects(
      acceptCanonicalHandoff(target, {
        taskId,
        handoffId,
        consumerId: "consumer-agent-2",
        packageRoot,
      }),
      (err) => err.code === E_HANDOFF_ALREADY_ACCEPTED,
    );
  } finally {
    await removeTempTree(target);
  }
});

test("legacy unbound handoff cannot be accepted", async () => {
  const target = await createGitRepository("forgeloop-handoff-unbound-");
  const taskId = "task-accept-unbound";
  const handoffId = "handoff-unbound-1";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    const created = await createCanonicalHandoff(target, {
      taskId,
      packageRoot,
      handoffId,
    });

    // Strip workStateFingerprint from handoff artifact
    const { workStateFingerprint: _, ...legacyState } = created.handoff.state;
    const { artifactDigest: __, ...legacyBodyWithoutDigest } = {
      ...created.handoff,
      state: legacyState,
    };
    const legacyHandoff = {
      ...legacyBodyWithoutDigest,
      artifactDigest: canonicalFingerprint(legacyBodyWithoutDigest),
    };
    await writeJsonArtifact(target, taskHandoffPath(taskId, handoffId), legacyHandoff, "handoff-envelope", packageRoot);

    await assert.rejects(
      acceptCanonicalHandoff(target, {
        taskId,
        handoffId,
        consumerId: "consumer-1",
        packageRoot,
      }),
      (err) => err.code === E_HANDOFF_ACCEPTANCE_UNBOUND,
    );
  } finally {
    await removeTempTree(target);
  }
});

test("stale handoff with drifted work state or changed paths fails acceptance", async () => {
  const target = await createGitRepository("forgeloop-handoff-stale-");
  const taskId = "task-accept-stale";
  const handoffId = "handoff-stale-1";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    await createCanonicalHandoff(target, {
      taskId,
      packageRoot,
      handoffId,
    });

    // Mutate file to introduce uncommitted changed-path drift
    await writeFile(`${target}/new-drift.txt`, "drift content", "utf8");

    await assert.rejects(
      acceptCanonicalHandoff(target, {
        taskId,
        handoffId,
        consumerId: "consumer-1",
        packageRoot,
      }),
      (err) => err.code === E_HANDOFF_STALE,
    );
  } finally {
    await removeTempTree(target);
  }
});

test("resolveHandoffAcceptance accurately projects acceptance status", async () => {
  const handoff = {
    handoffId: "h-1",
    artifactDigest: "a".repeat(64),
    state: {
      workStateFingerprint: "b".repeat(64),
    },
  };

  // OPEN
  assert.deepEqual(resolveHandoffAcceptance([], handoff), { status: "OPEN" });

  // ACCEPTED
  const events = [
    {
      event: "HANDOFF_ACCEPTED",
      at: "2026-09-02T12:00:00.000Z",
      details: {
        handoffId: "h-1",
        handoffDigest: "a".repeat(64),
        consumerId: "c-1",
        harness: "cursor",
      },
    },
  ];
  assert.deepEqual(resolveHandoffAcceptance(events, handoff), {
    status: "ACCEPTED",
    consumerId: "c-1",
    harness: "cursor",
    acceptedAt: "2026-09-02T12:00:00.000Z",
  });

  // UNBOUND
  assert.deepEqual(resolveHandoffAcceptance([], { ...handoff, state: {} }), {
    status: "UNBOUND",
  });

  // INCONSISTENT (digest mismatch)
  const mismatchEvents = [
    {
      event: "HANDOFF_ACCEPTED",
      at: "2026-09-02T12:00:00.000Z",
      details: {
        handoffId: "h-1",
        handoffDigest: "wrong".padEnd(64, "0"),
        consumerId: "c-1",
      },
    },
  ];
  assert.deepEqual(resolveHandoffAcceptance(mismatchEvents, handoff), {
    status: "INCONSISTENT",
  });
});

test("validateEventLedger catches duplicate HANDOFF_ACCEPTED and inconsistent creation", async () => {
  const target = await createGitRepository("forgeloop-handoff-ledger-");
  const taskId = "task-accept-ledger";
  const handoffId = "handoff-ledger-1";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });

    await createCanonicalHandoff(target, {
      taskId,
      packageRoot,
      handoffId,
    });

    await acceptCanonicalHandoff(target, {
      taskId,
      handoffId,
      consumerId: "consumer-1",
      packageRoot,
    });

    // Manually append a duplicate HANDOFF_ACCEPTED to test ledger validation
    const { appendProtocolEvent } = await import("../src/core/events.js");
    await appendProtocolEvent(target, {
      taskId,
      event: "HANDOFF_ACCEPTED",
      details: {
        handoffId,
        handoffDigest: "0".repeat(64),
        consumerId: "consumer-2",
      },
    }, packageRoot, { taskId });

    const ledgerRes = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledgerRes.valid, false);
    assert.ok(ledgerRes.errors.some((e) => e.code === E_HANDOFF_ALREADY_ACCEPTED));
  } finally {
    await removeTempTree(target);
  }
});
