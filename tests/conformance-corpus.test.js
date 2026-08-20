import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarios = ["cross-harness-resume", "policy-drift", "verification-recovery", "concurrent-claims", "interrupted-transaction"];

test("published conformance corpus documents every required cross-harness scenario", async () => {
  const corpus = await readFile(path.join(root, "conformance", "README.md"), "utf8");
  for (const scenario of scenarios) {
    assert.match(corpus, new RegExp(`\\\`${scenario}\\\``));
  }
});
