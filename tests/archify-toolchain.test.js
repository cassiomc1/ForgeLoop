import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ARCHIFY_COMMIT,
  ARCHIFY_VERSION,
  inspectArchifyToolchain,
  requireArchify,
} from "../scripts/archify-toolchain.mjs";

test("Archify toolchain is locally pinned to the reviewed release", async () => {
  const report = await inspectArchifyToolchain();
  assert.equal(report.name, "archify");
  assert.equal(report.version, ARCHIFY_VERSION);
  assert.equal(report.commit, ARCHIFY_COMMIT);
  assert.equal(report.license, "MIT");
  assert.match(report.root, /vendor\/archify\/v2\.15\.0\/archify$/);
});

test("pinned Archify doctor command passes without installing dependencies", async () => {
  const result = requireArchify(["doctor"]);
  assert.match(result.stdout, /Archify is ready\./);
});
