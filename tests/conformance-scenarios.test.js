import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { completionEvidenceForGuides, requiredGatesForGuides } from "../src/core/guide-metadata.js";
import { evaluateRoute } from "../src/core/router.js";

const root = path.resolve("conformance");
const packageRoot = path.resolve(".");

test("blind premium request remains exact and protocol-free", async () => {
  const request = await readFile(path.join(root, "blind-premium-website", "REQUEST.md"), "utf8");
  const lines = request.replace(/\r\n/g, "\n").split("\n");
  assert.match(lines[0], /^#\s+\S/, "scenario metadata must satisfy Markdown heading rules");
  const prompt = lines.slice(2).join("\n");
  assert.equal(
    prompt.replace(/\s+/g, " ").trim(),
    "Create a premium website for a law firm. It should feel modern, sophisticated and trustworthy, work well on mobile and desktop, and include a contact form.",
  );
  for (const term of ["ForgeLoop", "contract", "routing", "gate", "preflight", "evidence", "audit", "complete", "protocol"]) {
    assert.doesNotMatch(prompt, new RegExp("\\b" + term + "\\b", "i"), term);
  }
});

test("live-agent conformance scenarios declare route, gates, and evidence contracts", async () => {
  const scenarios = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name !== "runs")
    .map((entry) => entry.name)
    .sort();
  const liveScenarios = [
    "backend-auth",
    "blind-premium-website",
    "complete-website",
    "docs-only",
    "simple-bug",
  ];
  assert.deepEqual(scenarios.filter((scenario) => liveScenarios.includes(scenario)), liveScenarios);
  for (const scenario of liveScenarios) {
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

test("the first live run is preserved as capability-level diagnostic evidence", async () => {
  const record = await readFile(path.join(root, "runs", "2026-08-11-codex-first-live.md"), "utf8");

  for (const heading of [
    "## Environment",
    "## User request",
    "## Artifact evidence",
    "## Capability-level result",
    "## Chronology",
    "## Final classification",
  ]) {
    assert.match(record, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(record, /331e8d4019b61b1decfc063571cb7967238c8037/);
  assert.match(record, /LIFECYCLE \/ COMPLETION TIMEOUT/);
  assert.match(record, /The protocol prevented a false `COMPLETE`/);
  assert.match(record, /Evidence serialization.*FAIL/);
  assert.match(record, /Full conformance.*PARTIAL/);
});

test("the second live run records the pre-implementation clarification stop", async () => {
  const record = await readFile(path.join(root, "runs", "2026-08-11-codex-second-live.md"), "utf8");

  assert.match(record, /## Environment/);
  assert.match(record, /## Observed behavior/);
  assert.match(record, /PROTOCOL ACTIVATION \/ PRE-IMPLEMENTATION CLARIFICATION STOP/);
  assert.match(record, /Pre-contract autonomy.*FAIL/);
  assert.match(record, /current-contract\.json.*Missing/);
  assert.match(record, /Full conformance.*PARTIAL/);
});

test("the fourth live run records the exact ambiguity failure and single-agent topology", async () => {
  const record = await readFile(path.join(root, "runs", "2026-08-13-codex-fourth-live.md"), "utf8");

  assert.match(record, /Create a premium website for a law firm\./);
  assert.match(record, /What kind of law firm should the site represent\?/);
  assert.match(record, /Absence of real brand treated as non-blocking: `FAIL`/);
  assert.match(record, /Pre-contract autonomy: `FAIL`/);
  assert.match(record, /Execution topology: `single-agent`/);
  assert.match(record, /Agent process count: `1`/);
  assert.match(record, /Subagents enabled: `NO`/);
  assert.match(record, /Delegation used: `NO`/);
  assert.match(record, /Parallel agents: `NO`/);
  assert.match(record, /No artifacts were edited manually to make the test pass\./);
});

test("the sixth blind run defines harness-level external workflow exclusion", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");

  assert.match(readme, /## Autonomous blind-run isolation/);
  assert.match(readme, /mandatory-approval workflows enabled: NO/);
  assert.match(readme, /external brainstorming hard gate enabled: NO/);
  assert.match(readme, /external design approval gate enabled: NO/);
  assert.match(readme, /subagents enabled: NO/);
  assert.match(readme, /delegation enabled: NO/);
  assert.match(readme, /TEST_NOT_STARTED/);
  assert.match(readme, /INCOMPATIBLE WITH AUTONOMOUS MODE/);
});
