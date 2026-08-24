import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package and lock metadata agree on the release version", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages?.[""]?.version, pkg.version);
});
