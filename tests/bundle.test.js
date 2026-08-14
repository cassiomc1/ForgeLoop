import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { exportTaskBundle, readTaskBundle } from "../src/core/bundles.js";
import { ARTIFACT_PATHS, writeJsonArtifact } from "../src/core/artifacts.js";
import { createCheck } from "../src/core/checks.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { runCommandExecution } from "../src/core/execution.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

const safeAssumption = {
  value: "Use local placeholder content",
  reason: "No production content was supplied",
  scope: "local test",
  reversible: true,
  source: "agent-default",
};

function manualContract(taskId, assumptions = []) {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    objective: "bundle protocol state",
    assumptions,
    deliverables: [],
    constraints: [],
    risks: [],
    verification: [],
    successCriteria: [],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  };
}

async function writeManualJson(target, relativePath, value) {
  const artifactPath = path.join(target, relativePath);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function prepareRouteAndState(target, contract) {
  await persistRoute(target, evaluateRoute({ workType: "documentation" }), packageRoot, {
    contractFingerprint: contractFingerprint(contract),
  });
  await writeJsonArtifact(target, ARTIFACT_PATHS.state, {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: contract.taskId,
    contractFingerprint: contractFingerprint(contract),
    repositoryFingerprint: { branch: null, head: null },
    phase: "ROUTED",
    selectedGuides: [],
    completedSteps: [],
    pendingSteps: [],
    requiredArtifacts: [],
    checks: [],
    failures: [],
    blockers: [],
    verificationEvidence: [],
    lastUpdated: "2026-08-11T00:00:00.000Z",
  }, "work-state", packageRoot);
}

test("portable task bundles copy only canonical protocol artifacts", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-bundle-"));
  try {
    const contract = createContract({
      taskId: "bundle-001",
      objective: "bundle protocol state",
      deliverables: [],
      constraints: [],
      risks: [],
      verification: [],
      successCriteria: [],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    });
    await writeContract(target, contract, packageRoot);
    await prepareRouteAndState(target, contract);
    const bundle = await exportTaskBundle(target, contract.taskId, packageRoot);
    assert.equal(bundle.taskId, contract.taskId);
    const loaded = await readTaskBundle(target, contract.taskId, packageRoot);
    assert.deepEqual(loaded.manifest.artifacts.sort(), ["contract.json", "route.json", "state.json"]);
    assert.match(await readFile(path.join(target, ".forgeloop", "tasks", contract.taskId, "bundle.json"), "utf8"), /bundle-001/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("portable task bundles revalidate execution references against bundled artifacts", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-bundle-execution-"));
  try {
    const contract = createContract({
      taskId: "bundle-execution-001",
      objective: "bundle command provenance",
      deliverables: [],
      constraints: [],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests"],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    });
    await writeContract(target, contract, packageRoot);
    await prepareRouteAndState(target, contract);
    const execution = await runCommandExecution({
      target,
      packageRoot,
      taskId: contract.taskId,
      checkId: "tests",
      requirement: "tests",
      argv: [process.execPath, "-e", "process.exit(0)"],
    });
    const check = createCheck({
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: execution.execution.argv.join(" "),
      executionRef: execution.execution.executionId,
      provenance: "FORGELOOP_EXECUTED",
      exitCode: 0,
      details: { verificationCycle: 1 },
    }, {
      target,
      taskId: contract.taskId,
      packageRoot,
      requireCommandProvenance: true,
    });
    const state = JSON.parse(await readFile(path.join(target, ARTIFACT_PATHS.state), "utf8"));
    state.checks = [check];
    await writeJsonArtifact(target, ARTIFACT_PATHS.state, state, "work-state", packageRoot);

    const bundle = await exportTaskBundle(target, contract.taskId, packageRoot);
    const loaded = await readTaskBundle(target, contract.taskId, packageRoot);
    assert.ok(bundle.artifacts.includes(`executions/${execution.execution.executionId}.json`));
    assert.equal(loaded.artifacts.executions[execution.execution.executionId].executionId, execution.execution.executionId);
    assert.equal(loaded.artifacts.state.checks[0].executionRef, execution.execution.executionId);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("bundle export rejects a manually persisted semantically invalid current contract", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-bundle-export-invalid-"));
  try {
    const contract = manualContract("bundle-invalid-export", [{ ...safeAssumption, value: "   " }]);
    await writeManualJson(target, ARTIFACT_PATHS.contract, contract);
    await prepareRouteAndState(target, contract);

    await assert.rejects(
      () => exportTaskBundle(target, contract.taskId, packageRoot),
      /non-empty/i,
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("bundle reads reject a manually persisted secret-like bundled contract", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-bundle-read-invalid-"));
  try {
    const contract = createContract({
      ...manualContract("bundle-invalid-read", [safeAssumption]),
    });
    await writeContract(target, contract, packageRoot);
    await prepareRouteAndState(target, contract);
    await exportTaskBundle(target, contract.taskId, packageRoot);

    const sensitiveValue = "glpat-" + "V".repeat(20);
    const invalidBundledContract = {
      ...contract,
      assumptions: [{ ...safeAssumption, value: sensitiveValue }],
    };
    await writeManualJson(
      target,
      `.forgeloop/tasks/${contract.taskId}/contract.json`,
      invalidBundledContract,
    );

    await assert.rejects(
      () => readTaskBundle(target, contract.taskId, packageRoot),
      (error) => {
        assert.match(error.message, /secret-like/i);
        assert.equal(error.message.includes(sensitiveValue), false);
        return true;
      },
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
