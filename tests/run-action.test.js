import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executeDurableAction } from "../src/core/action-execution.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

async function targetWithPolicy(decision = "ALLOW") {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-run-action-"));
  await mkdir(path.join(target, ".forgeloop/policy"), { recursive: true });
  await writeFile(path.join(target, ".forgeloop/policy/capabilities.json"), JSON.stringify({
    schemaVersion: 1, defaultDecision: "DENY",
    rules: [{ capability: "filesystem.write", decision }],
  }), "utf8");
  return target;
}

function input(overrides = {}) {
  return { actionId: "action-write", effectClass: "REVERSIBLE_WRITE",
    capability: "filesystem.write", target: "sentinel.txt", operation: "write sentinel",
    idempotencyKey: "write:sentinel:v1", requiredForCompletion: false, requirement: null,
    ...overrides };
}

test("side-effecting run-action refuses a missing idempotency key", async () => {
  const target = await targetWithPolicy();
  try {
    await assert.rejects(executeDurableAction({ target, packageRoot, taskId: "task-run",
      input: input({ idempotencyKey: undefined }), argv: [process.execPath, "-e", "0"] }),
    (error) => error.code === "E_ACTION_IDEMPOTENCY_REQUIRED");
  } finally { await rm(target, { recursive: true, force: true }); }
});

test("DENY blocks before process launch", async () => {
  const target = await targetWithPolicy("DENY");
  const sentinel = path.join(target, "sentinel.txt");
  try {
    await assert.rejects(executeDurableAction({ target, packageRoot, taskId: "task-deny",
      input: input(), argv: [process.execPath, "-e", `require('fs').writeFileSync(${JSON.stringify(sentinel)},'bad')`] }),
    (error) => error.code === "E_ACTION_CAPABILITY_DENIED");
    await assert.rejects(access(sentinel));
  } finally { await rm(target, { recursive: true, force: true }); }
});

test("exact argv execution does not interpret shell metacharacters", async () => {
  const target = await targetWithPolicy();
  const sentinel = path.join(target, "sentinel.txt");
  const injected = path.join(target, "injected.txt");
  try {
    const result = await executeDurableAction({ target, packageRoot, taskId: "task-exact",
      input: input(), argv: [process.execPath, "-e", "require('fs').writeFileSync(process.argv[1],process.argv[2])",
        sentinel, `literal;touch ${injected}`] });
    assert.equal(result.action.state, "COMMITTED");
    assert.equal(await readFile(sentinel, "utf8"), `literal;touch ${injected}`);
    await assert.rejects(access(injected));
  } finally { await rm(target, { recursive: true, force: true }); }
});
