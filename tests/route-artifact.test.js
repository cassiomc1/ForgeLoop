import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readGuideMetadata } from "../src/core/guide-metadata.js";
import { evaluateRoute } from "../src/core/router.js";
import { persistRoute, readPersistedRoute } from "../src/core/route-artifact.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("guide metadata declares gates and completion evidence", async () => {
  const metadata = await readGuideMetadata(repositoryRoot);
  assert.deepEqual(metadata.premium.requiresGates, ["design", "quality"]);
  assert.ok(metadata.premium.completionEvidence.includes("build"));
  assert.deepEqual(metadata.security.requiresGates, ["threat-boundary"]);
});

test("route results persist and round-trip through the canonical artifact", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-route-artifact-"));
  try {
    const route = evaluateRoute({
      workType: "complete-website",
      surfaces: ["ui"],
      risks: [],
      platforms: ["web"],
      executableChange: true,
    });
    const written = await persistRoute(target, route, repositoryRoot);
    const loaded = await readPersistedRoute(target, repositoryRoot);
    assert.equal(written.fingerprint, loaded.fingerprint);
    assert.deepEqual(loaded.value, route);
    assert.match(await readFile(path.join(target, ".forgeloop", "routing-result.json"), "utf8"), /complete-website/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
