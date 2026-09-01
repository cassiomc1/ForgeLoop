import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runActivate } from "../src/commands/activate.js";
import { runAdvance } from "../src/commands/advance.js";
import { runNext } from "../src/commands/next.js";
import { runPreflight } from "../src/commands/preflight.js";
import { runQualityBaseline } from "../src/commands/quality-baseline.js";
import { runQualityStatus } from "../src/commands/quality-status.js";
import { runQualityVerify } from "../src/commands/quality-verify.js";
import { runRecordDiagnosis } from "../src/commands/record-diagnosis.js";
import { runRoute } from "../src/commands/route.js";
import { runTaskCreate } from "../src/commands/task-create.js";
import { createConfig, writeConfig } from "../src/core/config.js";
import { createContract, writeContract } from "../src/core/contract.js";
import { createForgeLoopContext } from "../src/core/runtime-context.js";
import { getPackageRoot } from "../src/core/templates.js";
import { readWorkState } from "../src/core/work-state.js";

const packageRoot = getPackageRoot();
const taskId = "structural-quality-lifecycle-task";

function snapshot(qualitySignal) {
  return {
    quality_signal: qualitySignal,
    root_causes: Object.fromEntries([
      "modularity",
      "acyclicity",
      "depth",
      "equality",
      "redundancy",
    ].map((cause) => [cause, { score: qualitySignal, raw: qualitySignal / 10_000 }])),
    files: 3,
    lines: 120,
    import_edges: 4,
    cross_module_edges: 2,
  };
}

async function setupTask(target, selectedTaskId = taskId, qualityConfig = { mode: "gate", provider: "fake" }) {
  await runTaskCreate({ target, packageRoot, taskId: selectedTaskId, claims: [] });
  await writeConfig(target, createConfig({
    complianceMode: "standard",
    structuralQuality: qualityConfig,
  }), packageRoot);
  await writeContract(target, createContract({
    taskId: selectedTaskId,
    objective: "exercise structural-quality lifecycle",
    deliverables: ["src"],
    verification: [],
    successCriteria: [],
  }), packageRoot, { taskId: selectedTaskId });
  // The fixture isolates the structural-quality lifecycle itself; using the
  // documentation route keeps unrelated guide evidence out of its oracle.
  await runRoute({ target, packageRoot, taskId: selectedTaskId, workType: "documentation", surfaces: ["config"] });
  const preflight = await runPreflight({ target, packageRoot, taskId: selectedTaskId });
  assert.equal(preflight.status, "READY", JSON.stringify(preflight.errors));
  await runActivate({ target, packageRoot, taskId: selectedTaskId });
  await runAdvance({ target, packageRoot, taskId: selectedTaskId, to: "PLANNED" });
}

function fakeContext(sequence) {
  let index = 0;
  const provider = {
    id: "fake",
    async detect() {
      return { available: true, providerId: "fake", providerVersion: "1.0.0", transport: "test", reasonCode: null };
    },
    async scan() {
      const value = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      return { snapshot: snapshot(value), provider: { id: "fake", version: "1.0.0", transport: "test", executionMode: "test" } };
    },
  };
  return createForgeLoopContext({ structuralQualityProviders: { fake: provider } });
}

test("gate lifecycle captures a baseline, fails closed on regression, and passes after correction", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-structural-lifecycle-"));
  try {
    await setupTask(target);
    const runtimeContext = fakeContext([9000, 8999, 9000]);

    const baseline = await runQualityBaseline({ target, packageRoot, taskId, runtimeContext });
    assert.equal(baseline.status, "CAPTURED");
    await runAdvance({ target, packageRoot, taskId, to: "EXECUTING" });
    await runAdvance({ target, packageRoot, taskId, to: "VERIFYING" });

    const failed = await runQualityVerify({ target, packageRoot, taskId, runtimeContext });
    assert.equal(failed.evaluation.status, "FAIL");
    assert.equal(failed.check.status, "failed");
    assert.equal(failed.check.evidenceKind, "OBSERVED");
    assert.equal(failed.check.details.bottleneck, "modularity");
    assert.equal((await runQualityStatus({ target, packageRoot, taskId })).current.status, "FAIL");
    assert.equal((await runNext({ target, packageRoot, taskId })).nextAction, "DIAGNOSE_STRUCTURAL_QUALITY_REGRESSION");

    await runAdvance({ target, packageRoot, taskId, to: "DIAGNOSING" });
    await runRecordDiagnosis({
      target,
      packageRoot,
      taskId,
      hypothesis: "The changed graph reduced the aggregate structural signal.",
      failureClass: "REGRESSION_FAILURE",
      evidenceRefs: ["structural-quality"],
      settledBy: "quality-verify artifact",
      nextSafeAction: "Correct the graph and rerun structural-quality verification.",
    });
    await runAdvance({ target, packageRoot, taskId, to: "CORRECTING" });
    await runAdvance({ target, packageRoot, taskId, to: "VERIFYING" });

    const passed = await runQualityVerify({ target, packageRoot, taskId, runtimeContext });
    assert.equal(passed.evaluation.status, "PASS");
    assert.equal(passed.check.status, "passed");
    assert.equal((await runQualityStatus({ target, packageRoot, taskId })).current.status, "PASS");
    const next = await runNext({ target, packageRoot, taskId });
    assert.equal(next.nextAction, "ENTER_REVIEWING", JSON.stringify(next));
    await runAdvance({ target, packageRoot, taskId, to: "REVIEWING" });
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("observe mode records provider absence without blocking the task", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-structural-observe-"));
  try {
    await runTaskCreate({ target, packageRoot, taskId: `${taskId}-observe`, claims: [] });
    await writeConfig(target, createConfig({ structuralQuality: { mode: "observe", provider: "missing" } }), packageRoot);
    const value = createContract({ taskId: `${taskId}-observe`, objective: "observe unavailable provider", verification: [], successCriteria: [] });
    await writeContract(target, value, packageRoot, { taskId: `${taskId}-observe` });
    await runRoute({ target, packageRoot, taskId: `${taskId}-observe`, workType: "code", surfaces: ["config"], executableChange: true });
    await runPreflight({ target, packageRoot, taskId: `${taskId}-observe` });
    await runActivate({ target, packageRoot, taskId: `${taskId}-observe` });
    await runAdvance({ target, packageRoot, taskId: `${taskId}-observe`, to: "PLANNED" });
    const result = await runQualityBaseline({ target, packageRoot, taskId: `${taskId}-observe`, runtimeContext: fakeContext([9000]) });
    assert.equal(result.status, "NOT_OBSERVED");
    await runAdvance({ target, packageRoot, taskId: `${taskId}-observe`, to: "EXECUTING" });
    await runAdvance({ target, packageRoot, taskId: `${taskId}-observe`, to: "VERIFYING" });
    const verification = await runQualityVerify({ target, packageRoot, taskId: `${taskId}-observe`, runtimeContext: fakeContext([9000]) });
    assert.equal(verification.evaluation.status, "NOT_OBSERVED");
    assert.equal(verification.check.status, "not-run");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("concurrent quality evaluations allocate unique attempts under the task lock", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-structural-concurrent-"));
  const selectedTaskId = `${taskId}-concurrent`;
  try {
    await setupTask(target, selectedTaskId, {
      mode: "gate",
      provider: "fake",
      optimization: { mode: "bounded", maxExtraEvaluations: 2, minGainPoints: 25 },
    });
    const runtimeContext = fakeContext([9000, 9000]);
    await runQualityBaseline({ target, packageRoot, taskId: selectedTaskId, runtimeContext });
    await runAdvance({ target, packageRoot, taskId: selectedTaskId, to: "EXECUTING" });
    await runAdvance({ target, packageRoot, taskId: selectedTaskId, to: "VERIFYING" });

    const results = await Promise.all([
      runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext }),
      runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext }),
    ]);
    assert.deepEqual(results.map((result) => result.evaluation.attempt).sort((a, b) => a - b), [1, 2]);
    assert.ok(results.every((result) => result.evaluation.status === "PASS"));
    const status = await runQualityStatus({ target, packageRoot, taskId: selectedTaskId });
    assert.equal(status.current.attempt, 2);
    assert.equal(status.optimization.attempts, 2);
    assert.equal(status.optimization.gain, 0);
    assert.equal(status.optimization.converged, true);
    const state = await readWorkState(target, { packageRoot, taskId: selectedTaskId });
    const qualityCheck = state.checks.find((check) => check.id === "structural-quality");
    assert.equal(qualityCheck.details.attempt, 2);
    assert.equal(qualityCheck.status, "passed");
    const optional = await runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext });
    assert.equal(optional.evaluation.status, "PASS");
    const converged = await runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext });
    assert.equal(converged.status, "CONVERGED");
    assert.equal(converged.evaluation.status, "PASS");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("bounded attempt limits preserve a blocked gate outcome", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-structural-limit-"));
  const selectedTaskId = `${taskId}-limit`;
  try {
    await setupTask(target, selectedTaskId);
    await runQualityBaseline({ target, packageRoot, taskId: selectedTaskId, runtimeContext: fakeContext([9000]) });
    await runAdvance({ target, packageRoot, taskId: selectedTaskId, to: "EXECUTING" });
    await runAdvance({ target, packageRoot, taskId: selectedTaskId, to: "VERIFYING" });
    const unavailable = createForgeLoopContext({ structuralQualityProviders: {
      fake: {
        id: "fake",
        async detect() { return { available: false, providerId: "fake", providerVersion: null, transport: "test", reasonCode: "E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE" }; },
        async scan() { throw new Error("scan must not run when detection is unavailable"); },
      },
    } });
    const first = await runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext: unavailable });
    assert.equal(first.evaluation.status, "BLOCKED");
    const limited = await runQualityVerify({ target, packageRoot, taskId: selectedTaskId, runtimeContext: unavailable });
    assert.equal(limited.status, "BLOCKED");
    assert.equal(limited.evaluation.status, "BLOCKED");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
