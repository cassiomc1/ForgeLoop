import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("npm tarball contains the CLI, templates, and license notices only", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const listing = JSON.parse(output)[0].files.map((entry) => entry.path);

  for (const expected of [
    "src/cli.js",
    "ENG/sec-code-eng.md",
    "AGENTS.md",
    "LICENSE",
    "LICENSE-DOCS.md",
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
  for (const excluded of ["tests/cli.test.js", "scripts/scan_secrets.py", "docs/superpowers/plans/2026-08-09-public-npm-framework.md"]) {
    assert.equal(listing.includes(excluded), false, `unexpected ${excluded}`);
  }
});
