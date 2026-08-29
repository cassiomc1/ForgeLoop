import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";

import { bindTaskWorkspace, assertWorkspaceBinding } from "../src/core/workspace-binding.js";
import { taskWorkspaceBindingPath } from "../src/core/task-paths.js";
import { getPackageRoot } from "../src/core/templates.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";

const packageRoot = getPackageRoot();

test("workspace binding blocks a mutation before the callback can observe side effects", async () => {
  const target = await createGitRepository("forgeloop-workspace-mutation-");
  const taskId = "workspace-mutation-001";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await bindTaskWorkspace(target, { taskId, packageRoot });
    const bindingPath = taskWorkspaceBindingPath(taskId);
    const binding = JSON.parse(await readFile(`${target}/${bindingPath}`, "utf8"));
    binding.workspaceIdentity = "f".repeat(64);
    await writeFile(`${target}/${bindingPath}`, `${JSON.stringify(binding)}\n`, "utf8");
    let callbackReached = false;
    await assert.rejects(
      () => assertWorkspaceBinding(target, { taskId, packageRoot, operation: "mutation-test" }).then(() => {
        callbackReached = true;
      }),
      (error) => error.code === "E_WORKSPACE_BINDING_MISMATCH",
    );
    assert.equal(callbackReached, false);
  } finally {
    await removeTempTree(target);
  }
});
