import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("documentation index exposes the canonical operational sources", async () => {
  const index = await readFile("DOCS_INDEX.md", "utf8");
  assert.match(index, /LOOP_ENGINEERING\.md/);
  assert.match(index, /PROTOCOL_INTEGRATION\.md/);
  assert.match(index, /Python validators/);
  assert.match(index, /CI-only/);
});

test("README keeps the lifecycle contract and accessible flow fallback", async () => {
  const readme = await readFile("README.md", "utf8");
  for (const marker of [
    "LOOP_SYSTEM_DESIGN.md",
    "forgeloop-flow.svg",
    "PREFLIGHT_READY",
    "append-only event ledger",
    "VALID",
    "INCOMPLETE",
    "STALE",
    "INCONSISTENT",
    "INVALID",
  ]) {
    assert.match(readme, new RegExp(marker.replaceAll(".", "\\.")), marker);
  }
  assert.ok(readme.length < 30000, "README should remain a catalog and quickstart");
});

test("the Mermaid source is canonical and the renderer consumes it", async () => {
  const source = await readFile("docs/forgeloop-flow.mmd", "utf8");
  const renderer = await readFile("scripts/generate-readme-flow.mjs", "utf8");
  const rendered = await readFile("docs/assets/forgeloop-flow.svg", "utf8");
  assert.match(source, /flowchart/);
  assert.match(source, /subgraph/);
  assert.match(source, /classDef/);
  assert.match(source, /PREFLIGHT_READY/);
  assert.match(renderer, /mermaid-cli|mmdc/);
  assert.match(renderer, /forgeloop-flow\.mmd/);
  assert.match(rendered, /<svg[\s>]/);
  assert.match(rendered, /PREFLIGHT_READY/);
});
