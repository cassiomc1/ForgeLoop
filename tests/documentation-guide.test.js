import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { evaluateRoute } from "../src/core/router.js";
import { GUIDE_IDS } from "../src/core/protocol.js";
import { getPackageRoot } from "../src/core/templates.js";
import { readGuideMetadata } from "../src/core/guide-metadata.js";

const packageRoot = getPackageRoot();

test("documentation guide metadata is registered and matches canonical path", async () => {
  const metadata = await readGuideMetadata(packageRoot);

  for (const guideId of GUIDE_IDS) {
    assert.ok(metadata[guideId], `missing guide metadata for: ${guideId}`);
    assert.equal(metadata[guideId].guideId, guideId);
  }

  assert.equal(metadata.documentation.guideId, "documentation");
  assert.equal(metadata.documentation.path, "ENG/documentation-quality-eng.md");

  const guidePath = path.join(packageRoot, metadata.documentation.path);
  const guide = await readFile(guidePath, "utf8");

  assert.match(guide, /^# Documentation Quality for AI Agents$/m);
  for (const section of [
    "Context",
    "Documentation quality model",
    "Identify the reader and job",
    "Documentation modes",
    "README quality",
    "Canonical sources and docs-as-code",
    "Generated and handwritten documentation",
    "Documentation impact analysis",
    "Freshness and timeless wording",
    "Writing style and terminology",
    "Procedures",
    "Commands and code samples",
    "API documentation",
    "CLI documentation",
    "Configuration and environment documentation",
    "Architecture documentation",
    "Troubleshooting and runbooks",
    "Accessibility",
    "Security and sensitive information",
    "Versioning, deprecation, and migration",
    "Validation and evidence",
    "Anti-patterns",
    "Agent workflow",
    "Documentation Definition of Done",
    "Sources and further reading",
  ]) {
    assert.match(guide, new RegExp(`^## ${section}$`, "m"));
  }
});

test("documentation guide routes deterministically for pure docs and docs surface", () => {
  const pureDocs = evaluateRoute({ workType: "documentation", surfaces: [], platforms: [] });
  assert.equal(pureDocs.primary, "documentation");
  assert.deepEqual(pureDocs.guides, ["documentation"]);
  assert.deepEqual(pureDocs.reasons.documentation, ["WORK_DOCUMENTATION"]);

  const codeWithDocs = evaluateRoute({ workType: "code", surfaces: ["documentation"], platforms: [] });
  assert.equal(codeWithDocs.primary, "clean");
  assert.deepEqual(codeWithDocs.guides, ["clean", "test", "documentation"]);
  assert.deepEqual(codeWithDocs.reasons.documentation, ["SURFACE_DOCUMENTATION"]);
});
