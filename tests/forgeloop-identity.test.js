import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { TEMPLATE_PATHS } from "../src/core/templates.js";
import { WORK_STATE_PATH } from "../src/core/work-state.js";

const repoRoot = new URL("../", import.meta.url);

async function readPackage() {
  return JSON.parse(await readFile(new URL("package.json", repoRoot), "utf8"));
}

test("package identity is ForgeLoop", async () => {
  const packageJson = await readPackage();

  assert.equal(packageJson.name, "@cassiomc1/forgeloop");
  assert.equal(packageJson.bin?.forgeloop, "src/cli.js");
  assert.equal(packageJson.bin?.mdfiles, undefined);
});

test("runtime paths use the ForgeLoop namespace", () => {
  assert.ok(TEMPLATE_PATHS.includes(".forgeloop/.gitignore"));
  assert.equal(TEMPLATE_PATHS.some((path) => path.startsWith(".mdfiles/")), false);
  assert.equal(WORK_STATE_PATH, ".forgeloop/work-state.json");
});

test("CLI help presents the ForgeLoop executable", () => {
  const result = spawnSync(process.execPath, ["src/cli.js", "--help"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Usage: forgeloop/m);
});

test("architecture diagram is canonical and discoverable", async () => {
  const design = await readFile(new URL("LOOP_SYSTEM_DESIGN.md", repoRoot), "utf8");
  const readme = await readFile(new URL("README.md", repoRoot), "utf8");

  for (const marker of [
    "FORGELOOP",
    "ROUTING",
    "STATE",
    "EVIDENCE",
    "repository",
    "contract",
    "freshness",
    "CONFORMANCE",
    "DELEGATION",
    "VALID / STALE / INVALID",
    "compatible harness",
  ]) {
    assert.match(design, new RegExp(marker.replaceAll("/", "\\/")));
  }
  assert.match(readme, /LOOP_SYSTEM_DESIGN\.md/);
});
