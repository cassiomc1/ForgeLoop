import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createContract, writeContract } from "../src/core/contract.js";
import { createGate } from "../src/core/gates.js";
import { persistGate } from "../src/core/gate-artifact.js";
import { formatPreflightResult, runPreflight } from "../src/commands/preflight.js";
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

async function prepareWebsite(target, options = {}) {
  const {
    objective = "Prepare website",
    assumptions = [],
    unresolvedDecisions = [],
  } = options;
  const contract = createContract({
    taskId: "website-001",
    objective,
    assumptions,
    deliverables: ["website"],
    constraints: ["offline"],
    risks: [],
    verification: ["build"],
    successCriteria: ["build"],
    stopConditions: ["missing evidence"],
    unresolvedDecisions,
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

test("preflight blocks unresolved contract decisions with stable guidance", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target, {
      unresolvedDecisions: ["Need the real production domain"],
    });

    const result = await runPreflight({ target, packageRoot });
    const issue = result.errors.find((error) => error.code === "E_CONTRACT_UNRESOLVED_DECISION");

    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(issue?.decisions, ["Need the real production domain"]);
    assert.equal(issue?.decisionCount, 1);
    assert.match(issue?.next ?? "", /Resolve the blocking decision/);
    assert.match(formatPreflightResult(result), /NEXT: Resolve the blocking decision/);

    const events = (await readFile(path.join(target, ".forgeloop/events.ndjson"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.ok(events.some((event) => event.event === "PREFLIGHT_BLOCKED"));
    assert.equal(events.some((event) => event.event === "PREFLIGHT_READY"), false);
  });
});

test("safe assumptions do not block an otherwise valid preflight", async () => {
  await withTarget(async (target) => {
    await prepareWebsite(target, {
      assumptions: [{
        value: "Use a fictional law-firm identity",
        reason: "No real branding was supplied",
        scope: "local prototype",
        reversible: true,
        source: "agent-default",
      }],
      unresolvedDecisions: [],
    });

    const result = await runPreflight({ target, packageRoot });
    assert.equal(result.status, "READY");
    assert.equal(result.errors.some((error) => error.code === "E_CONTRACT_UNRESOLVED_DECISION"), false);
  });
});
