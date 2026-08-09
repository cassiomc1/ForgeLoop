import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

import { TEMPLATE_PATHS } from "../src/core/templates.js";

test("npm tarball contains the CLI, templates, and license notices only", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const listing = JSON.parse(output)[0].files.map((entry) => entry.path);

  for (const expected of [
    "src/cli.js",
    "src/core/agent-support.js",
    ...TEMPLATE_PATHS,
    "LICENSE",
    "LICENSE-DOCS.md",
  ]) {
    assert.ok(listing.includes(expected), `missing ${expected}`);
  }
  for (const excluded of ["tests/cli.test.js", "scripts/scan_secrets.py"]) {
    assert.equal(listing.includes(excluded), false, `unexpected ${excluded}`);
  }
});

test("CLI package entry is executable by Node-compatible shells", async () => {
  const cli = await readFile("src/cli.js", "utf8");
  const metadata = await stat("src/cli.js");
  assert.match(cli, /^#!\/usr\/bin\/env node\n/);
  assert.notEqual(metadata.mode & 0o111, 0);
});
