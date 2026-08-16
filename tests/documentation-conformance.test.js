import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { COMMANDS } from "../src/cli.js";
import { DISCOVERY_SURFACES } from "../src/core/discovery-surfaces.js";
import { nativeShim } from "../src/core/native-adapters.js";
import { FAILURE_CODES } from "../src/core/protocol.js";
import { readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";
import {
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  E_COMMAND_RESOLUTION_AMBIGUOUS,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_VERIFICATION_TOOL_UNAVAILABLE,
} from "../src/core/verification-constants.js";

const packageRoot = getPackageRoot();

test("ARTIFACT_REFERENCE documents only real fields from canonical JSON schemas", async () => {
  const content = await readFile("docs/ARTIFACT_REFERENCE.md", "utf8");

  // 1. current-contract.json
  const contractSchema = await readSchema("current-contract", packageRoot);
  assert.ok(contractSchema.properties.taskId);
  assert.ok(contractSchema.properties.objective);
  assert.ok(contractSchema.properties.deliverables);
  assert.ok(contractSchema.properties.constraints);
  assert.ok(contractSchema.properties.risks);
  assert.ok(contractSchema.properties.verification);
  assert.ok(contractSchema.properties.successCriteria);
  assert.ok(contractSchema.properties.stopConditions);
  assert.ok(contractSchema.properties.unresolvedDecisions);
  assert.ok(contractSchema.properties.sourceRefs);
  // Source allows only agent-default in current schema
  assert.equal(contractSchema.properties.assumptions.items.properties.source.const, "agent-default");
  assert.doesNotMatch(content, /source.*operator/i, "contract assumptions must not document non-existent operator source");

  // 2. work-state.json
  const workStateSchema = await readSchema("work-state", packageRoot);
  assert.equal(workStateSchema.properties.session, undefined, "work-state schema does not have session property");
  assert.equal(workStateSchema.properties.fingerprints, undefined, "work-state schema does not have fingerprints wrapper");
  assert.ok(workStateSchema.properties.contractFingerprint);
  assert.ok(workStateSchema.properties.routeFingerprint);
  assert.ok(workStateSchema.properties.repositoryFingerprint);
  assert.ok(workStateSchema.properties.phase);
  assert.ok(workStateSchema.properties.selectedGuides);
  assert.ok(workStateSchema.properties.checks);
  assert.ok(workStateSchema.properties.failures);
  assert.ok(workStateSchema.properties.blockers);
  assert.ok(workStateSchema.properties.lastUpdated);

  // ARTIFACT_REFERENCE.md must not document session under work-state
  const workStateSection = content.split("### 2.4 `work-state.json`")[1]?.split("---")[0] ?? "";
  assert.doesNotMatch(workStateSection, /`session`\s*\(/i, "work-state section must not document nonexistent session field");

  // 3. continuity.json
  const continuitySchema = await readSchema("continuity", packageRoot);
  assert.ok(continuitySchema.properties.currentFocus);
  assert.ok(continuitySchema.properties.remainingWork);
  assert.ok(continuitySchema.properties.knownIssues);
  assert.ok(continuitySchema.properties.changedAreas);
  assert.ok(continuitySchema.properties.inspectFirst);
  assert.ok(continuitySchema.properties.resumeNote);
  assert.ok(continuitySchema.properties.workStateFingerprint);
  assert.ok(continuitySchema.properties.contractFingerprint);

  // 4. execution.schema.json
  const executionSchema = await readSchema("execution", packageRoot);
  assert.ok(executionSchema.properties.executionId);
  assert.ok(executionSchema.properties.taskId);
  assert.ok(executionSchema.properties.checkId);
  assert.ok(executionSchema.properties.requirement);
  assert.ok(executionSchema.properties.verificationCycle);
  assert.ok(executionSchema.properties.kind);
  assert.ok(executionSchema.properties.argv);
  assert.ok(executionSchema.properties.cwd);
  assert.ok(executionSchema.properties.resolution);
  assert.ok(executionSchema.properties.startedAt);
  assert.ok(executionSchema.properties.finishedAt);
  assert.ok(executionSchema.properties.status);
  assert.ok(executionSchema.properties.exitCode);
  assert.equal(executionSchema.properties.command, undefined);
  assert.equal(executionSchema.properties.provenance, undefined);
});

test("CLI_REFERENCE documents all 27 CLI commands and valid options", async () => {
  const content = await readFile("docs/CLI_REFERENCE.md", "utf8");

  for (const command of COMMANDS) {
    const headingPattern = new RegExp(`### \`${command}\``);
    assert.match(content, headingPattern, `CLI_REFERENCE.md must document command: ${command}`);
  }

  // Preflight is mutating
  const preflightSection = content.split("### `preflight`")[1]?.split("###")[0] ?? "";
  assert.match(preflightSection, /Persists `\.forgeloop\/preflight\.json`/i);
  assert.doesNotMatch(preflightSection, /Mutation:\s*Read-only/i);

  // Activate creates activation marker
  const activateSection = content.split("### `activate`")[1]?.split("###")[0] ?? "";
  assert.match(activateSection, /activation marker/i);
  assert.doesNotMatch(activateSection, /creates the canonical lifecycle work state/i);

  // Clear-state removes work-state.json only
  const clearStateSection = content.split("### `clear-state`")[1]?.split("###")[0] ?? "";
  assert.match(clearStateSection, /Removes `\.forgeloop\/work-state\.json` only/i);
  assert.match(clearStateSection, /Sibling ForgeLoop artifacts.*preserved/i);

  // Reconcile-continuity is read-only
  const reconcileSection = content.split("### `reconcile-continuity`")[1]?.split("###")[0] ?? "";
  assert.match(reconcileSection, /\*\*Mutation\*\*:\s*Read-only/i);
});

test("TROUBLESHOOTING error codes match real exported protocol constants", async () => {
  const content = await readFile("docs/TROUBLESHOOTING.md", "utf8");
  const extractedCodes = [...new Set(content.match(/\bE_[A-Z0-9_]+\b/g) ?? [])];

  const knownCodes = new Set([
    ...FAILURE_CODES,
    E_VERIFICATION_TOOL_UNAVAILABLE,
    E_INSTALLATION_AUTHORITY_REQUIRED,
    E_COMMAND_RESOLUTION_AMBIGUOUS,
    E_AUTHORITY_INVALID,
    E_AUTHORITY_SCOPE_MISMATCH,
    "E_AUTHORITY_UNTRUSTED_SOURCE",
    "E_EXECUTION_REF_INVALID",
    "E_NATIVE_ADAPTER_STALE",
    "E_NATIVE_ADAPTER_TARGET_MISSING",
    "E_MIGRATION_INCOMPLETE",
    "E_MIGRATION_WRITE_VERIFY",
  ]);

  for (const code of extractedCodes) {
    assert.ok(knownCodes.has(code), `Documented error code ${code} must exist in exported protocol constants`);
  }
});

test("all discovery surfaces and native shim require cross-harness resume rule", async () => {
  const resumePattern = /work-state\.json`?\s+exists/i;

  for (const surface of DISCOVERY_SURFACES) {
    const content = await readFile(surface.path, "utf8");
    assert.match(content, resumePattern, `Discovery surface ${surface.path} must contain resume rule`);
    assert.match(content, /forgeloop next/i, `Discovery surface ${surface.path} must reference forgeloop next`);
  }

  for (const surface of DISCOVERY_SURFACES) {
    const shim = nativeShim(surface.path);
    assert.match(shim, resumePattern, `Native shim for ${surface.path} must contain resume rule`);
    assert.match(shim, /forgeloop next/i, `Native shim for ${surface.path} must reference forgeloop next`);
  }
});
