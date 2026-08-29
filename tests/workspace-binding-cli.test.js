import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs, usage } from "../src/cli.js";
import { formatWorkspaceBindResult } from "../src/commands/workspace-bind.js";
import { formatWorkspaceStatusResult } from "../src/commands/workspace-status.js";

test("workspace binding CLI options are sourced from the canonical parser", () => {
  const parsed = parseArgs(["workspace-bind", "--task", "checkout-task", "--json"]);
  assert.equal(parsed.command, "workspace-bind");
  assert.equal(parsed.options.taskId, "checkout-task");
  assert.equal(parsed.options.json, true);
  assert.match(usage("workspace-bind"), /--task/);
  assert.throws(
    () => parseArgs(["workspace-bind", "--json"]),
    (error) => error.code === "E_CLI_INVOCATION_INVALID",
  );
});

test("workspace binding CLI formatters expose stable English fields", () => {
  const result = {
    status: "MATCH",
    taskId: "checkout-task",
    path: ".forgeloop/task-state/key/workspace-binding.json",
    binding: { workspaceIdentity: "a".repeat(64), repositoryIdentity: "b".repeat(64) },
    alreadyBound: false,
  };
  assert.match(formatWorkspaceBindResult(result), /FORGELOOP WORKSPACE BIND: MATCH/);
  assert.match(formatWorkspaceStatusResult(result), /workspace:/);
});
