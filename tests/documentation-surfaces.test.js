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

test("README keeps the lifecycle contract, modern multi-task layout, and accessible flow fallback", async () => {
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
  assert.match(readme, /\.forgeloop\/task-state\/<taskKey>\//);
  assert.match(
    readme,
    /!\[ForgeLoop evidence-first engineering flow\]\(\.\/docs\/assets\/forgeloop-flow\.svg\)/,
  );
  assert.doesNotMatch(
    readme,
    /<img[^>]+forgeloop-flow\.svg/i,
  );
  assert.ok(readme.length < 30000, "README should remain a catalog and quickstart");
});

test("Getting Started creates task before route and preflight", async () => {
  const gettingStarted = await readFile("docs/GETTING_STARTED.md", "utf8");
  const taskCreatePos = gettingStarted.indexOf("forgeloop task-create");
  const routePos = gettingStarted.indexOf("forgeloop route");
  const preflightPos = gettingStarted.indexOf("forgeloop preflight");

  assert.ok(taskCreatePos !== -1, "task-create must be present");
  assert.ok(routePos !== -1, "route must be present");
  assert.ok(preflightPos !== -1, "preflight must be present");
  assert.ok(taskCreatePos < routePos, "task-create must precede route");
  assert.ok(routePos < preflightPos, "route must precede preflight");
});

test("Cross-Harness continuity mentions task selectors and ambiguity", async () => {
  const crossHarness = await readFile("docs/CROSS_HARNESS_CONTINUITY.md", "utf8");
  assert.match(crossHarness, /--task/);
  assert.match(crossHarness, /FORGELOOP_TASK/);
  assert.match(crossHarness, /E_TASK_AMBIGUOUS/);
});

test("the Mermaid source is canonical and the rendered SVG is self-contained", async () => {
  const source = await readFile("docs/forgeloop-flow.mmd", "utf8");
  const renderer = await readFile("scripts/generate-readme-flow.mjs", "utf8");
  const puppeteerConfig = await readFile("scripts/mermaid-puppeteer-ci.json", "utf8");
  const rendered = await readFile("docs/assets/forgeloop-flow.svg", "utf8");
  assert.match(source, /flowchart/);
  assert.match(source, /subgraph/);
  assert.match(source, /classDef/);
  assert.match(source, /PREFLIGHT_READY/);
  assert.match(renderer, /mermaid-cli|mmdc/);
  assert.match(renderer, /forgeloop-flow\.mmd/);
  assert.match(renderer, /data-forgeloop-source-sha256/);
  assert.match(renderer, /mermaid-puppeteer-ci\.json/);
  assert.match(puppeteerConfig, /no-sandbox/);
  assert.match(rendered, /<svg[\s>]/);
  assert.match(rendered, /data-forgeloop-source-sha256="[a-f0-9]{64}"/);
  assert.match(rendered, /PREFLIGHT_READY/);

  // Assert GitHub-safe and self-contained SVG
  assert.doesNotMatch(rendered, /@import/);
  assert.doesNotMatch(rendered, /fonts\.googleapis\.com/);
  assert.doesNotMatch(rendered, /<script\b/i);
  assert.doesNotMatch(rendered, /<foreignObject\b/i);
});
