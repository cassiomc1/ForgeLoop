import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve("conformance");

test("live-agent conformance scenarios declare route, gates, and evidence contracts", async () => {
  const scenarios = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(scenarios, ["backend-auth", "complete-website", "docs-only", "simple-bug"]);
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
