import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { evaluateRoute } from "../src/core/router.js";
import { getPackageRoot } from "../src/core/templates.js";
import { readGuideMetadata } from "../src/core/guide-metadata.js";

const packageRoot = getPackageRoot();

test("Taste routes only to contextual premium frontend work", async () => {
  const website = evaluateRoute({ workType: "complete-website", surfaces: ["ui"], platforms: ["web"] });
  const backend = evaluateRoute({ workType: "api", surfaces: ["api"], platforms: ["server"] });
  const docs = evaluateRoute({ workType: "documentation", surfaces: [], platforms: [] });

  assert.ok(website.guides.includes("taste"));
  assert.equal(backend.guides.includes("taste"), false);
  assert.equal(docs.guides.includes("taste"), false);
  assert.ok(website.reasons.taste?.length > 0);
  assert.equal(backend.excluded.taste?.[0], "NO_TASTE_FRONTEND_CONTEXT");
});

test("Taste guide is package-managed, contextual, and subordinate to accessibility and performance", async () => {
  const metadata = await readGuideMetadata(packageRoot);
  const guidePath = path.join(packageRoot, metadata.taste.path);
  const guide = await readFile(guidePath, "utf8");
  const notices = await readFile(path.join(packageRoot, "THIRD_PARTY_NOTICES.md"), "utf8");

  assert.equal(metadata.taste.guideId, "taste");
  for (const section of ["Design Read", "Design Dials", "Anti-Slop Checks", "Typography Quality", "Layout Composition", "Motion Restraint", "Responsive Composition", "Visual Pre-Flight"]) {
    assert.match(guide, new RegExp(`^## ${section}$`, "m"));
  }
  assert.match(guide, /accessibility|performance/i);
  assert.match(guide, /contextual|route/i);
  assert.match(notices, /Taste Skill/);
  assert.match(notices, /Leonxlnx/i);
});
