import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs } from "../src/cli.js";
import { runHandoffCreate } from "../src/commands/handoff-create.js";
import { runHandoffList } from "../src/commands/handoff-list.js";
import { runHandoffShow } from "../src/commands/handoff-show.js";
import { getPackageRoot } from "../src/core/templates.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";

const packageRoot = getPackageRoot();

test("handoff CLI parser and commands expose immutable protocol snapshots", async () => {
  const parsed = parseArgs(["handoff-create", "--task", "handoff-cli-001", "--recipient", "reviewer", "--note", "Inspect source", "--json"]);
  assert.equal(parsed.options.recipientHint, "reviewer");
  assert.equal(parsed.options.handoffNote, "Inspect source");

  const target = await createGitRepository("forgeloop-handoff-cli-");
  try {
    await setupVerifyingTask(target, packageRoot, { taskId: "handoff-cli-001" });
    const created = await runHandoffCreate({
      target,
      packageRoot,
      taskId: "handoff-cli-001",
      recipientHint: "reviewer",
      handoffNote: "Inspect source",
    });
    const list = await runHandoffList({ target, packageRoot, taskId: "handoff-cli-001" });
    const shown = await runHandoffShow({ target, packageRoot, taskId: "handoff-cli-001", handoffId: created.handoff.handoffId });
    assert.equal(list.count, 1);
    assert.equal(shown.fingerprint, created.fingerprint);
    assert.equal(shown.handoff.intent.recipientHint, "reviewer");
    assert.equal(shown.acceptance.status, "OPEN");
    assert.equal(list.handoffs[0].acceptance.status, "OPEN");
  } finally {
    await removeTempTree(target);
  }
});

test("handoff-accept CLI parser and executor accept handoff and update inspection state", async () => {
  const parsed = parseArgs([
    "handoff-accept",
    "--task", "handoff-cli-002",
    "--handoff", "handoff-002",
    "--consumer-id", "agent-codex",
    "--harness", "codex",
    "--json",
  ]);
  assert.equal(parsed.options.taskId, "handoff-cli-002");
  assert.equal(parsed.options.handoffId, "handoff-002");
  assert.equal(parsed.options.consumerId, "agent-codex");
  assert.equal(parsed.options.harness, "codex");
  assert.equal(parsed.options.json, true);

  const target = await createGitRepository("forgeloop-handoff-accept-cli-");
  try {
    await setupVerifyingTask(target, packageRoot, { taskId: "handoff-cli-002" });
    const { runHandoffAccept } = await import("../src/commands/handoff-accept.js");
    const created = await runHandoffCreate({
      target,
      packageRoot,
      taskId: "handoff-cli-002",
      handoffId: "handoff-002",
      recipientHint: "agent-codex",
      handoffNote: "Resume work",
    });

    const acceptRes = await runHandoffAccept({
      target,
      packageRoot,
      taskId: "handoff-cli-002",
      handoffId: created.handoff.handoffId,
      consumerId: "agent-codex",
      harness: "codex",
    });

    assert.equal(acceptRes.accepted, true);
    assert.equal(acceptRes.consumerId, "agent-codex");
    assert.equal(acceptRes.harness, "codex");

    const shown = await runHandoffShow({
      target,
      packageRoot,
      taskId: "handoff-cli-002",
      handoffId: created.handoff.handoffId,
    });
    assert.equal(shown.acceptance.status, "ACCEPTED");
    assert.equal(shown.acceptance.consumerId, "agent-codex");
    assert.equal(shown.acceptance.harness, "codex");

    const list = await runHandoffList({
      target,
      packageRoot,
      taskId: "handoff-cli-002",
    });
    assert.equal(list.handoffs[0].acceptance.status, "ACCEPTED");
  } finally {
    await removeTempTree(target);
  }
});
