import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FORGELOOP_INTEGRATION_API_VERSION,
  defaultCommandInputValues,
  executeForgeLoopCommand,
  getForgeLoopCapabilities,
  validateForgeLoopCommandInput,
} from "../src/integration.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";

test("integration API version is 1 and exported from the stable subpath", () => {
  assert.equal(FORGELOOP_INTEGRATION_API_VERSION, 1);
});

test("capabilities report versions, features, commands, and resources", () => {
  const capabilities = getForgeLoopCapabilities({ packageVersion: "1.5.0" });
  assert.equal(capabilities.packageVersion, "1.5.0");
  assert.equal(capabilities.integrationApiVersion, 1);
  assert.equal(capabilities.features.taskClaimRecovery.validatedClaimProjection, true);
  assert.equal(capabilities.executorParity, true);

  const names = capabilities.commands.map((command) => command.name);
  assert.deepEqual(names, [...names].sort());
  assert.equal(names.length, Object.keys(CLI_COMMAND_DEFINITIONS).length);

  const resourceNames = capabilities.resources.map((resource) => resource.name);
  assert.ok(resourceNames.includes("task/ownership"));
});

test("every canonical command has a base risk class", () => {
  for (const name of Object.keys(CLI_COMMAND_DEFINITIONS)) {
    assert.match(getForgeLoopCapabilities().commands.find((c) => c.name === name).baseRiskClass, /^[A-Z_]+$/, name);
  }
});

test("invocation classification covers input-dependent commands", async () => {
  const { classifyForgeLoopInvocation } = await import("../src/core/integration-invocation-policy.js");
  const { INTEGRATION_RISK_CLASSES } = await import("../src/core/integration-invocation-policy.js");

  // doctor without --fix is maintenance-classified but non-destructive input;
  // with the current command set it stays MAINTENANCE.
  assert.equal(classifyForgeLoopInvocation("doctor").riskClass, INTEGRATION_RISK_CLASSES.MAINTENANCE);

  // policy-discover stays maintenance; write refines nothing yet but remains gated.
  assert.equal(classifyForgeLoopInvocation("policy-discover").riskClass, INTEGRATION_RISK_CLASSES.MAINTENANCE);
  assert.equal(classifyForgeLoopInvocation("policy-discover").requiredCapability, "allowMaintenance");

  // task-unlock escalates to FORCE_DESTRUCTIVE only with force:true.
  assert.equal(classifyForgeLoopInvocation("task-unlock").requiredCapability, "allowMaintenance");
  const forced = classifyForgeLoopInvocation("task-unlock", { force: true });
  assert.equal(forced.riskClass, INTEGRATION_RISK_CLASSES.FORCE_DESTRUCTIVE);
  assert.equal(forced.requiredCapability, "allowForceRecovery");

  // Claim authority boundaries are distinct classes.
  assert.equal(classifyForgeLoopInvocation("task-resume").riskClass, INTEGRATION_RISK_CLASSES.CLAIM_REACQUISITION);
  assert.equal(classifyForgeLoopInvocation("task-resume").requiredCapability, null);
  assert.equal(classifyForgeLoopInvocation("task-recover").riskClass, INTEGRATION_RISK_CLASSES.CLAIM_RELEASE_RECOVERY);
  assert.equal(classifyForgeLoopInvocation("task-recover").requiredCapability, "allowRecovery");
  assert.equal(classifyForgeLoopInvocation("task-repair-legacy-recovery").riskClass, INTEGRATION_RISK_CLASSES.LEGACY_MIGRATION);

  // External execution classes.
  assert.equal(classifyForgeLoopInvocation("run-check").riskClass, INTEGRATION_RISK_CLASSES.EXTERNAL_EXECUTION);
  assert.equal(classifyForgeLoopInvocation("run-check").executesExternalProcess, true);

  // Read-only class never mutates.
  const statusClass = classifyForgeLoopInvocation("status");
  assert.equal(statusClass.riskClass, INTEGRATION_RISK_CLASSES.READ_ONLY);
  assert.equal(statusClass.readOnly, true);
  assert.equal(statusClass.mutatesProtocol, false);

  assert.throws(() => classifyForgeLoopInvocation("not-a-command"));
});

test("shared semantic validation runs identically for any transport", async () => {
  assert.throws(
    () => validateForgeLoopCommandInput({ command: "record-check", input: defaultCommandInputValues() }),
    /record-check requires --id/,
  );
  const envelope = await executeForgeLoopCommand({ command: "record-check", projectPath: ".", input: {} });
  assert.equal(envelope.ok, false);
  assert.match(envelope.error.message, /record-check requires --id/);
});
