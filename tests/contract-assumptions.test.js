import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createContract, validateContract, writeContract } from "../src/core/contract.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const safeAssumption = {
  value: "Use a fictional law-firm identity",
  reason: "No real branding was supplied",
  scope: "local prototype",
  reversible: true,
  source: "agent-default",
};

const validContractInput = {
  taskId: "law-firm-site",
  objective: "Create a premium law-firm website",
  deliverables: [],
  constraints: [],
  risks: [],
  verification: [],
  successCriteria: [],
  stopConditions: [],
  unresolvedDecisions: [],
  sourceRefs: [],
};

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-contract-assumptions-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("createContract normalizes assumptions and preserves the canonical shape", () => {
  const contract = createContract({
    ...validContractInput,
    assumptions: [safeAssumption],
  });

  assert.deepEqual(contract.assumptions, [safeAssumption]);
});

test("createContract serializes an omitted assumptions field as an empty list", () => {
  const contract = createContract({
    taskId: "task-without-assumptions",
    objective: "Validate compatibility",
  });

  assert.deepEqual(contract.assumptions, []);
});

test("validateContract accepts a legacy protocol-v1 contract without assumptions", async () => {
  const legacyContract = {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId: "legacy-task",
    objective: "Keep an existing contract valid",
    deliverables: [],
    constraints: [],
    risks: [],
    verification: [],
    successCriteria: [],
    stopConditions: [],
    unresolvedDecisions: [],
    sourceRefs: [],
  };

  await assert.doesNotReject(() => validateContract(legacyContract, packageRoot));
});

const invalidAssumptionCases = [
  ["rejects assumptions with reversible=false", { ...safeAssumption, reversible: false }],
  ["rejects assumptions with a non-agent-default source", { ...safeAssumption, source: "manual" }],
  ["rejects assumptions with an empty value", { ...safeAssumption, value: "" }],
  ["rejects assumptions with an empty reason", { ...safeAssumption, reason: "" }],
  ["rejects assumptions with an empty scope", { ...safeAssumption, scope: "" }],
  ["rejects assumptions with an unknown property", { ...safeAssumption, extra: "unexpected" }],
  ["rejects assumptions with a non-object entry", "not-an-assumption"],
  ["rejects assumptions with secret-like content", {
    ...safeAssumption,
    value: "sk-" + "A".repeat(20),
  }],
];

for (const [title, assumption] of invalidAssumptionCases) {
  test(title, async () => {
    const invalidContract = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "invalid-assumption-task",
      objective: "Exercise assumption validation",
      assumptions: [assumption],
      deliverables: [],
      constraints: [],
      risks: [],
      verification: [],
      successCriteria: [],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    };

    await assert.rejects(() => validateContract(invalidContract, packageRoot));
  });

  test(`${title} when writing`, async () => {
    const invalidContract = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "invalid-assumption-task",
      objective: "Exercise assumption validation",
      assumptions: [assumption],
      deliverables: [],
      constraints: [],
      risks: [],
      verification: [],
      successCriteria: [],
      stopConditions: [],
      unresolvedDecisions: [],
      sourceRefs: [],
    };

    await withTarget(async (target) => {
      await assert.rejects(() => writeContract(target, invalidContract, packageRoot));
    });
  });
}
