import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createContract, writeContract } from "../src/core/contract.js";
import { createGate } from "../src/core/gates.js";
import { persistGate } from "../src/core/gate-artifact.js";
import { runPreflight } from "../src/commands/preflight.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute } from "../src/core/route-artifact.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-preflight-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

async function prepareWebsite(target, objective = "Prepare website") {
  const contract = createContract({
    taskId: "website-001",
    objective,
    deliverables: ["website"],
    constraints: ["offline"],
    risks: [],
    verification: ["build"],
    successCriteria: ["build"],
    stopConditions: ["missing evidence"],
    unresolvedDecisions: [],
    sourceRefs: [],
  });
  await writeContract(target, contract, packageRoot);
  const route = evaluateRoute({ workType: "complete-website", surfaces: ["ui"], platforms: ["web"] });
  await persistRoute(target, route, packageRoot, { contractFingerprint: (await import("../src/core/contract.js")).contractFingerprint(contract) });
  for (const gate of ["design", "quality", "threat-boundary"]) {
    await persistGate(target, createGate({
      taskId: contract.taskId,
      gate,
      status: "satisfied",
      requiredBy: ["test"],
      artifacts: [],
      decisions: [],
      unknowns: [],
      approvedAssumptions: [],
      evidence: [],
    }), packageRoot);
  }
  return contract;
}

test("preflight blocks missing contract and route with stable codes", async () => {
  await withTarget(async (target) => {
    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.errors.some((error) => error.code === "E_CONTRACT_MISSING"));
    assert.ok(result.errors.some((error) => error.code === "E_ROUTE_MISSING"));
  });
});

test("complete website preflight is ready only after required gates", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "READY");
    assert.ok(result.requiredGates.includes("design"));
    assert.deepEqual(result.requiredGates, result.satisfiedGates);
  });
});

test("preflight detects a contract changed after route persistence", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target);
    await writeContract(target, createContract({
      taskId: "website-001",
      objective: "Changed objective",
      deliverables: ["website"],
      constraints: ["offline"],
      risks: [],
      verification: ["build"],
      successCriteria: ["build"],
      stopConditions: ["missing evidence"],
      unresolvedDecisions: [],
      sourceRefs: [],
    }), packageRoot);
    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.errors.some((error) => error.code === "E_ROUTE_STALE"));
  });
});
