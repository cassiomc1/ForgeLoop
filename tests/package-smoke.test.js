import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("package smoke workflow exercises installed tarballs on Linux, macOS, and Windows", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const workflow = await readFile(".github/workflows/package-smoke.yml", "utf8");
  assert.equal(packageJson.scripts["pack:smoke"], "node scripts/package_smoke.mjs");
  for (const os of ["ubuntu-latest", "macos-latest", "windows-latest"]) assert.match(workflow, new RegExp(os));
  assert.match(workflow, /npm run pack:smoke/);
});
