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
    "forgeloop-engineering-flow.svg",
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
    /!\[ForgeLoop evidence-first engineering flow\]\(\.\/docs\/assets\/diagrams\/forgeloop-engineering-flow\.svg\)/,
  );
  assert.doesNotMatch(
    readme,
    /<img[^>]+forgeloop-engineering-flow\.svg/i,
  );
  assert.match(readme, /project-scoped configuration/i);
  assert.match(readme, /task-scoped/i);
  assert.doesNotMatch(
    readme,
    /mutable protocol artifacts remain directly under `?\.forgeloop\/`?/i,
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

test("the typed Archify source and generated outputs are canonical and self-contained", async () => {
  const source = JSON.parse(await readFile("docs/diagrams/forgeloop-engineering-flow.workflow.json", "utf8"));
  const manifest = JSON.parse(await readFile("docs/diagrams/manifest.json", "utf8"));
  const rendered = await readFile("docs/assets/diagrams/forgeloop-engineering-flow.svg", "utf8");
  const receipt = JSON.parse(await readFile("docs/assets/diagrams/forgeloop-engineering-flow.receipt.json", "utf8"));
  assert.equal(source.diagram_type, "workflow");
  assert.equal(source.meta.visual_preset, "signal-flow");
  assert.match(JSON.stringify(source), /PREFLIGHT/);
  assert.equal(manifest.renderer.name, "archify");
  assert.equal(manifest.renderer.version, "2.15.0");
  assert.equal(receipt.renderer.commit, manifest.renderer.commit);
  assert.match(rendered, /<svg[\s>]/);
  assert.match(rendered, /data-forgeloop-source-sha256="[a-f0-9]{64}"/);
  assert.match(rendered, /data-theme="dark"/);
  assert.match(rendered, /role="img"/);
  assert.match(rendered, /<title/);
  assert.match(rendered, /<desc/);
  assert.doesNotMatch(rendered, /@import/);
  assert.doesNotMatch(rendered, /fonts\.googleapis\.com/);
  assert.doesNotMatch(rendered, /<script\b/i);
  assert.doesNotMatch(rendered, /<foreignObject\b/i);
});
