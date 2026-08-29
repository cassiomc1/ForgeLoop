import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

const repositoryRoot = process.cwd();
const cliPath = path.join(repositoryRoot, "src", "cli.js");

test("CLI parser failures use the stable JSON error envelope when requested", () => {
  const child = spawnSync(process.execPath, [cliPath, "route", "--json", "--behavior-change=true"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(child.status, 2);
  const stdout = JSON.parse(child.stdout);
  const stderr = JSON.parse(child.stderr);
  assert.deepEqual(stdout, stderr);
  assert.equal(stdout.status, "ERROR");
  assert.equal(stdout.ok, false);
  assert.equal(stdout.error.code, "E_CLI_INVOCATION_INVALID");
  assert.equal(typeof stdout.error.message, "string");
  assert.equal("stack" in stdout, false);
});
