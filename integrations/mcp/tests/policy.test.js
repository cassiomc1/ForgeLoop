import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveLaunchPolicy, SERVER_MODES, toolEnabled } from "../src/capability-policy.js";
import { classifyForgeLoopInvocation } from "@cassiomc1/forgeloop/integration";
import { INTEGRATION_RISK_CLASSES } from "@cassiomc1/forgeloop/integration";

test("launch policy is immutable and validates flags", () => {
  const policy = resolveLaunchPolicy({ mode: SERVER_MODES.SAFE });
  assert.equal(policy.mode, SERVER_MODES.SAFE);
  assert.equal(Object.isFrozen(policy), true);
  assert.throws(() => resolveLaunchPolicy({ mode: "bogus" }));
  assert.throws(() => resolveLaunchPolicy({ mode: SERVER_MODES.SAFE, allowRecovery: true }), /--mode full/);
});

test("readonly mode exposes only read-only tools", () => {
  const policy = resolveLaunchPolicy({ mode: SERVER_MODES.READONLY });
  const status = classifyForgeLoopInvocation("status");
  const route = classifyForgeLoopInvocation("route");
  const resume = classifyForgeLoopInvocation("task-resume");
  assert.equal(toolEnabled("status", status, policy), true);
  assert.equal(toolEnabled("route", route, policy), false);
  assert.equal(toolEnabled("task-resume", resume, policy), false);
});

test("safe mode enables loop mutations and task-resume but not gated capabilities", () => {
  const policy = resolveLaunchPolicy({ mode: SERVER_MODES.SAFE });
  for (const command of ["route", "advance", "complete", "task-create", "task-resume"]) {
    assert.equal(toolEnabled(command, classifyForgeLoopInvocation(command), policy), true, command);
  }
  for (const command of ["run-check", "reconcile-closure", "init", "update", "task-recover", "task-repair-legacy-recovery"]) {
    assert.equal(toolEnabled(command, classifyForgeLoopInvocation(command), policy), false, command);
  }
});

test("full mode requires explicit opt-in flags per capability", () => {
  const base = resolveLaunchPolicy({ mode: SERVER_MODES.FULL });
  assert.equal(toolEnabled("task-recover", classifyForgeLoopInvocation("task-recover"), base), false);
  assert.equal(toolEnabled("task-repair-legacy-recovery", classifyForgeLoopInvocation("task-repair-legacy-recovery"), base), false);

  const withRecovery = resolveLaunchPolicy({ mode: SERVER_MODES.FULL, allowRecovery: true });
  assert.equal(toolEnabled("task-recover", classifyForgeLoopInvocation("task-recover"), withRecovery), true);
  assert.equal(toolEnabled("run-check", classifyForgeLoopInvocation("run-check"), withRecovery), false);

  // Legacy repair stays hidden even when other full-mode flags are enabled.
  const mixed = resolveLaunchPolicy({
    mode: SERVER_MODES.FULL,
    allowExternalExecution: true,
    allowMaintenance: true,
    allowForceRecovery: true,
  });
  assert.equal(toolEnabled("task-repair-legacy-recovery", classifyForgeLoopInvocation("task-repair-legacy-recovery"), mixed), false);
});

test("force unlock escalates to FORCE_DESTRUCTIVE and needs its own capability", () => {
  const policy = resolveLaunchPolicy({ mode: SERVER_MODES.FULL });
  const forced = classifyForgeLoopInvocation("task-unlock", { force: true });
  assert.equal(forced.riskClass, INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE);
  assert.equal(toolEnabled("task-unlock", forced, policy), false);
});
