import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { completionEvidenceForGuides, requiredGatesForGuides } from "../src/core/guide-metadata.js";
import { evaluateRoute } from "../src/core/router.js";

const root = path.resolve("conformance");
const packageRoot = path.resolve(".");

test("live-agent conformance scenarios declare route, gates, and evidence contracts", async () => {
  const scenarios = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(scenarios, [
    "backend-auth",
    "blind-premium-website",
    "complete-website",
    "docs-only",
    "simple-bug",
  ]);
  for (const scenario of scenarios) {
    await readFile(path.join(root, scenario, "REQUEST.md"), "utf8");
    const route = JSON.parse(await readFile(path.join(root, scenario, "EXPECTED_ROUTE.json"), "utf8"));
    const gates = JSON.parse(await readFile(path.join(root, scenario, "REQUIRED_GATES.json"), "utf8"));
    const evidence = JSON.parse(await readFile(path.join(root, scenario, "REQUIRED_EVIDENCE.json"), "utf8"));
    assert.ok(Array.isArray(route.guides));
    assert.ok(Array.isArray(gates.required));
    assert.ok(Array.isArray(evidence.required));
  }
});

test("blind premium website stays protocol-free while matching deterministic metadata", async () => {
  const scenarioRoot = path.join(root, "blind-premium-website");
  const request = await readFile(path.join(scenarioRoot, "REQUEST.md"), "utf8");
  for (const term of ["ForgeLoop", "contract", "routing", "gate", "preflight", "evidence", "audit", "complete", "protocol"]) {
    assert.doesNotMatch(request, new RegExp(`\\b${term}\\b`, "i"), term);
  }

  const route = JSON.parse(await readFile(path.join(scenarioRoot, "EXPECTED_ROUTE.json"), "utf8"));
  const gates = JSON.parse(await readFile(path.join(scenarioRoot, "REQUIRED_GATES.json"), "utf8"));
  const evidence = JSON.parse(await readFile(path.join(scenarioRoot, "REQUIRED_EVIDENCE.json"), "utf8"));
  const evaluated = evaluateRoute({
    workType: "complete-website",
    surfaces: ["ui", "forms"],
    risks: ["accessibility"],
    platforms: ["web"],
  });

  assert.equal(route.workType, evaluated.input.workType);
  assert.deepEqual([...route.surfaces].sort(), evaluated.input.surfaces);
  assert.deepEqual([...route.risks].sort(), evaluated.input.risks);
  assert.deepEqual([...route.platforms].sort(), evaluated.input.platforms);
  assert.deepEqual(route.guides, evaluated.guides);
  assert.deepEqual(gates.required, await requiredGatesForGuides(route.guides, packageRoot));
  assert.deepEqual(evidence.required, await completionEvidenceForGuides(route.guides, packageRoot));
});
