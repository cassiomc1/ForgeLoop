import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  GUIDE_FILES,
  GUIDE_IDS,
  GUIDE_REGISTRY,
  GUIDE_TEMPLATE_PATHS,
} from "../src/core/guide-registry.js";
import { TEMPLATE_PATHS, getPackageRoot } from "../src/core/templates.js";
import { readGuideMetadata } from "../src/core/guide-metadata.js";

const packageRoot = getPackageRoot();

test("guide registry keys match definitions and use canonical format", () => {
  for (const [guideId, definition] of Object.entries(GUIDE_REGISTRY)) {
    assert.equal(definition.id, guideId);
    assert.match(guideId, /^[a-z][a-z0-9-]*$/);
    assert.ok(definition.path.startsWith("ENG/"));
    assert.ok(definition.path.endsWith(".md"));
  }
});

test("guide registry paths and IDs are unique", () => {
  const paths = Object.values(GUIDE_REGISTRY).map((def) => def.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(GUIDE_IDS).size, GUIDE_IDS.length);
});

test("GUIDE_IDS and GUIDE_FILES are derived from GUIDE_REGISTRY", () => {
  assert.deepEqual(GUIDE_IDS, Object.keys(GUIDE_REGISTRY));
  for (const [id, def] of Object.entries(GUIDE_REGISTRY)) {
    assert.equal(GUIDE_FILES[id], def.path);
  }
});

test("every registered guide file exists on disk", async () => {
  for (const definition of Object.values(GUIDE_REGISTRY)) {
    const fullPath = path.join(packageRoot, definition.path);
    await assert.doesNotReject(async () => {
      await access(fullPath);
    }, `Guide file missing: ${definition.path}`);
  }
});

test("all installable guides are included in TEMPLATE_PATHS", () => {
  for (const definition of Object.values(GUIDE_REGISTRY)) {
    if (definition.install) {
      assert.ok(
        TEMPLATE_PATHS.includes(definition.path),
        `Template paths missing: ${definition.path}`,
      );
      assert.ok(
        GUIDE_TEMPLATE_PATHS.includes(definition.path),
        `Guide template paths missing: ${definition.path}`,
      );
    }
  }
});

test("guide frontmatter guide-id matches registry key", async () => {
  const metadata = await readGuideMetadata(packageRoot);
  for (const guideId of GUIDE_IDS) {
    assert.ok(metadata[guideId], `Metadata missing for: ${guideId}`);
    assert.equal(metadata[guideId].guideId, guideId);
    assert.equal(metadata[guideId].path, GUIDE_REGISTRY[guideId].path);
  }
});
