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
  } finally {
    await removeTempTree(target);
  }
});
