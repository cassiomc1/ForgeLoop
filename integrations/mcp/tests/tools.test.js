import assert from "node:assert/strict";
import { test } from "node:test";

import { buildToolRegistrations, commandToToolName } from "../src/tool-registry.js";
import { resolveLaunchPolicy, SERVER_MODES } from "../src/capability-policy.js";

const policy = resolveLaunchPolicy({ mode: SERVER_MODES.SAFE });
const readonlyPolicy = resolveLaunchPolicy({ mode: SERVER_MODES.READONLY });

test("tool names are deterministic and collision-free", () => {
  const registrations = buildToolRegistrations({ projectRoot: ".", policy });
  const names = registrations.map((r) => r.name);
  assert.deepEqual(names, [...names].sort());
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("forgeloop_advance"));
  assert.ok(names.includes("forgeloop_action_propose"));
  assert.ok(names.includes("forgeloop_task_resume"));
});

test("safe-mode catalog excludes maintenance, recovery, external execution and legacy repair", () => {
  const names = buildToolRegistrations({ projectRoot: ".", policy }).map((r) => r.name);
  for (const forbidden of [
    "forgeloop_run_check",
    "forgeloop_reconcile_closure",
    "forgeloop_init",
    "forgeloop_update",
    "forgeloop_task_recover",
    "forgeloop_task_repair_legacy_recovery",
    "forgeloop_task_unlock",
    "forgeloop_clear_state",
    "forgeloop_doctor",
  ]) {
    assert.equal(names.includes(forbidden), false, forbidden);
  }
});

test("task-aware mutation tools require an explicit taskId in their schema", () => {
  const registrations = buildToolRegistrations({ projectRoot: ".", policy });
  for (const registration of registrations) {
    if (!registration.config.title.includes("ForgeLoop")) continue;
    void registration;
  }
  const advance = registrations.find((r) => r.name === "forgeloop_advance");
  assert.ok(advance);
  // The generated Standard Schema exposes its JSON Schema.
  const jsonSchema = advance.config.inputSchema["~standard"]?.jsonSchema?.input?.()
    ?? advance.config.inputSchema["~standard"]?.jsonSchema;
  assert.ok(jsonSchema, "input schema must expose JSON schema");
  assert.equal(jsonSchema.required?.includes("taskId"), true);
  assert.equal(jsonSchema.properties.taskId.type, "string");
});

test("CLI-only flags never appear in tool schemas", () => {
  const registrations = buildToolRegistrations({ projectRoot: ".", policy });
  for (const registration of registrations) {
    const jsonSchema = registration.config.inputSchema["~standard"]?.jsonSchema?.input?.()
      ?? registration.config.inputSchema["~standard"]?.jsonSchema;
    if (!jsonSchema?.properties) continue;
    for (const forbidden of ["json", "help", "version", "path", "operatorAuthorized"]) {
      assert.equal(Object.keys(jsonSchema.properties).includes(forbidden), false, `${registration.name}:${forbidden}`);
    }
  }
});

test("readonly catalog contains only read-only tools", () => {
  const names = buildToolRegistrations({ projectRoot: ".", policy: readonlyPolicy }).map((r) => r.name);
  assert.ok(names.includes("forgeloop_status"));
  assert.equal(names.includes("forgeloop_route"), false);
});

test("safe-mode catalog excludes the bundle tool", () => {
  const names = buildToolRegistrations({ projectRoot: ".", policy }).map((r) => r.name);
  assert.equal(names.includes("forgeloop_bundle"), false);
});
