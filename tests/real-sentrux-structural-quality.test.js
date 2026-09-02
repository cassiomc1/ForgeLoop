import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { runActivate } from "../src/commands/activate.js";
import { runAdvance } from "../src/commands/advance.js";
import { runPreflight } from "../src/commands/preflight.js";
import { runQualityBaseline } from "../src/commands/quality-baseline.js";
import { runQualityVerify } from "../src/commands/quality-verify.js";
import { runRoute } from "../src/commands/route.js";
import { runTaskCreate } from "../src/commands/task-create.js";
import { createConfig, writeConfig } from "../src/core/config.js";
import { createContract, writeContract } from "../src/core/contract.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "structural-quality");
const sentruxAvailable = spawnSync("sentrux", ["--version"], { stdio: "ignore" }).status === 0;

test("real Sentrux 0.5.7 public integration detects a dependency-cycle regression", { skip: !sentruxAvailable }, async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-real-sentrux-e2e-"));
  const taskId = "real-sentrux-structural-quality-task";
  try {
    await cp(path.join(fixtureRoot, "healthy"), target, { recursive: true });
    await runTaskCreate({ target, packageRoot, taskId, claims: [] });
    await writeConfig(target, createConfig({
      complianceMode: "standard",
      structuralQuality: { mode: "gate", provider: "sentrux", forbidNewCycles: true },
    }), packageRoot);
    await writeContract(target, createContract({
      taskId,
      objective: "exercise real Sentrux structural-quality interoperability",
      deliverables: ["tests/fixtures/structural-quality"],
      verification: [],
      successCriteria: [],
    }), packageRoot, { taskId });
    await runRoute({ target, packageRoot, taskId, workType: "documentation", surfaces: ["config"] });
    assert.equal((await runPreflight({ target, packageRoot, taskId })).status, "READY");
    await runActivate({ target, packageRoot, taskId });
    await runAdvance({ target, packageRoot, taskId, to: "PLANNED" });

    const baseline = await runQualityBaseline({ target, packageRoot, taskId });
    assert.equal(baseline.status, "CAPTURED");
    assert.equal(baseline.baseline.detection.available, true);
    assert.equal(baseline.baseline.detection.providerVersion, "0.5.7");
    assert.equal(baseline.baseline.detection.compatibilityKey, "sentrux-structural-root-causes-v1");
    assert.equal(baseline.baseline.provider.transport, "mcp-stdio");
    assert.equal(baseline.baseline.provider.measurementModel, "structural-root-causes-v1");
    assert.equal(baseline.baseline.sourceObservation.stable, true);

    await mkdir(path.join(target, ".sentrux"), { recursive: true });
    await writeFile(path.join(target, ".sentrux", "rules.toml"), 'rule = "forbid-cycle"\n');
    await runAdvance({ target, packageRoot, taskId, to: "EXECUTING" });
    await runAdvance({ target, packageRoot, taskId, to: "VERIFYING" });
    await cp(path.join(fixtureRoot, "regression", "c.js"), path.join(target, "c.js"));

    const result = await runQualityVerify({ target, packageRoot, taskId });
    assert.equal(result.evaluation.status, "FAIL");
    assert.equal(result.check.status, "failed");
    assert.equal(result.check.evidenceKind, "OBSERVED");
    assert.match(result.evaluation.comparison.failedConditions.join(","), /acyclicity:new-cycles/);
    assert.equal(result.evaluation.sourceObservation.stable, true);
    assert.equal(result.evaluation.provider.version, "0.5.7");
    assert.match(result.evaluation.scope.architectureRulesFingerprint, /^[a-f0-9]{64}$/);
  } finally {
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
