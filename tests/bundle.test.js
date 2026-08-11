import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { exportTaskBundle, readTaskBundle } from "../src/core/bundles.js";
import { ARTIFACT_PATHS, writeJsonArtifact } from "../src/core/artifacts.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

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
    const bundle = await exportTaskBundle(target, contract.taskId, packageRoot);
    assert.equal(bundle.taskId, contract.taskId);
    const loaded = await readTaskBundle(target, contract.taskId, packageRoot);
    assert.deepEqual(loaded.manifest.artifacts.sort(), ["contract.json", "route.json", "state.json"]);
    assert.match(await readFile(path.join(target, ".forgeloop", "tasks", contract.taskId, "bundle.json"), "utf8"), /bundle-001/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
