import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { buildToolRegistrations } from "../src/tool-registry.js";
import { resolveLaunchPolicy, SERVER_MODES } from "../src/capability-policy.js";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/**
 * Plan §19: external-execution safety is proven structurally at the adapter
 * boundary. Canonical provenance (exact argv capture, exit codes, execution
 * records) is enforced by ForgeLoop core and covered by the core suites;
 * this suite proves the adapter adds no shell surface and forwards argv
 * arrays untouched.
 */
test("the MCP adapter contains no child-process or shell surface", () => {
  const forbidden = [
    /child_process/,
    /\bexecSync\b/,
    /\bspawnSync?\b/,
    /\bexec\(/,
    /\bshell:\s*true/,
    /\beval\(/,
  ];
  for (const entry of readdirSync(SRC_DIR)) {
    if (!entry.endsWith(".js")) continue;
    const source = readFileSync(path.join(SRC_DIR, entry), "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${entry} matches ${pattern}`);
    }
  }
});

test("no generic shell/exec tool exists in any mode catalog", () => {
  for (const mode of [SERVER_MODES.READONLY, SERVER_MODES.SAFE, SERVER_MODES.FULL]) {
    for (const extra of [{}, { allowExternalExecution: true }, { allowMaintenance: true }]) {
      if (Object.keys(extra).length > 0 && mode !== SERVER_MODES.FULL) continue;
      const policy = resolveLaunchPolicy({ mode, ...extra });
      const names = buildToolRegistrations({ projectRoot: ".", policy }).map((r) => r.name);
      for (const forbidden of ["forgeloop_shell", "forgeloop_exec", "run_command", "bash", "terminal"]) {
        assert.equal(names.includes(forbidden), false, `${mode}:${forbidden}`);
      }
    }
  }
});

test("external-execution tools accept ONLY exact-argv arrays and never cwd/env overrides", () => {
  const policy = resolveLaunchPolicy({
    mode: SERVER_MODES.FULL,
    allowExternalExecution: true,
  });
  const registrations = buildToolRegistrations({ projectRoot: ".", policy });
  for (const toolName of ["forgeloop_run_check", "forgeloop_reconcile_closure"]) {
    const registration = registrations.find((r) => r.name === toolName);
    assert.ok(registration, toolName);
    const schema = registration.config.inputSchema["~standard"]?.jsonSchema?.input?.()
      ?? registration.config.inputSchema["~standard"]?.jsonSchema;
    assert.ok(schema, `${toolName} schema missing`);
    assert.equal(schema.additionalProperties, false, `${toolName} must reject unknown keys`);
    // Exact argv array contract.
    const argv = schema.properties.commandArgv;
    assert.equal(argv.type, "array");
    assert.equal(argv.items.type, "string");
    assert.equal(typeof argv.maxItems, "number");
    // No process-control escape hatches can be expressed as input.
    for (const forbidden of ["cwd", "env", "shell", "environment"]) {
      assert.equal(Object.keys(schema.properties).includes(forbidden), false, `${toolName}:${forbidden}`);
    }
  }
});

test("timeout policy injects the server maximum for external executions", async () => {
  const { applyExecutionPolicy } = await import("../src/execution-policy.js");
  const { classifyForgeLoopInvocation } = await import("@cassiomc1/forgeloop/integration");
  const policy = resolveLaunchPolicy({ mode: SERVER_MODES.FULL, allowExternalExecution: true, maxExecutionTimeMs: 123456 });

  const applied = applyExecutionPolicy({
    classification: classifyForgeLoopInvocation("run-check"),
    args: { taskId: "t", checkId: "c", requirement: "r", commandArgv: ["npm", "test"] },
    policy,
  });
  assert.equal(applied.timeoutMs, 123456);
});
