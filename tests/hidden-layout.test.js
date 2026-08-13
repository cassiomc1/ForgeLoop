import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { getPackageRoot, readTemplateEntries } from "../src/core/templates.js";
import { sha256 } from "../src/core/manifest.js";

const packageRoot = getPackageRoot();
const cliPath = path.join(packageRoot, "src", "cli.js");

function runCli(target, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: target,
    encoding: "utf8",
  });
}

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-hidden-layout-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

test("init installs canonical kit under .forgeloop/kit and leaves only native shims at root", async () => {
  await withTarget(async (target) => {
    const result = runCli(target, "init");
    assert.equal(result.status, 0, result.stderr);

    const manifest = JSON.parse(await readFile(path.join(target, ".forgeloop/manifest.json"), "utf8"));
    assert.equal(manifest.layoutVersion, 2);
    assert.ok(await readFile(path.join(target, ".forgeloop/kit/LOOP_ENGINEERING.md"), "utf8"));
    assert.ok(await readFile(path.join(target, ".forgeloop/kit/ENG/taste-frontend-eng.md"), "utf8"));
    const profile = await readFile(path.join(target, ".forgeloop/kit/PROJECT_PROFILE.md"), "utf8");
    assert.match(profile, /planned/i);
    assert.match(profile, /present/i);
    assert.match(profile, /profile-status: uninitialized/);
    assert.equal(await readFile(path.join(target, "AGENTS.md"), "utf8").then((text) => text.includes(".forgeloop/kit")), true);
    await assert.rejects(() => readFile(path.join(target, "LOOP_ENGINEERING.md")));
    await assert.rejects(() => readFile(path.join(target, "ENG/clean-code-eng.md")));
    for (const entry of await readTemplateEntries(packageRoot)) {
      if (entry.relativePath !== entry.sourcePath && entry.sourcePath !== ".forgeloop/forgeloop.gitignore") {
        await assert.rejects(() => readFile(path.join(target, entry.sourcePath)));
      }
    }
  });
});

test("init rejects a symlinked hidden kit before writing target files", async () => {
  await withTarget(async (target) => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "forgeloop-hidden-outside-"));
    try {
      await mkdir(path.join(target, ".forgeloop"), { recursive: true });
      await symlink(outside, path.join(target, ".forgeloop", "kit"));
      const result = runCli(target, "init");
      assert.notEqual(result.status, 0);
      await assert.rejects(() => lstat(path.join(target, "AGENTS.md")));
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test("update migrates an unchanged legacy managed root file into the hidden kit", async () => {
  await withTarget(async (target) => {
    const legacyPath = path.join(target, "LOOP_ENGINEERING.md");
    const legacyBytes = await readFile(path.join(packageRoot, "LOOP_ENGINEERING.md"));
    await mkdir(path.join(target, ".forgeloop"), { recursive: true });
    await writeFile(legacyPath, legacyBytes);
    await writeFile(
      path.join(target, ".forgeloop/manifest.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        packageName: "@cassiomc1/forgeloop",
        packageVersion: "0.1.6",
        files: { "LOOP_ENGINEERING.md": { sha256: sha256(legacyBytes), preserve: false } },
      }, null, 2)}\n`,
    );

    const result = runCli(target, "update");

    assert.equal(result.status, 0, result.stderr);
    assert.ok(await readFile(path.join(target, ".forgeloop/kit/LOOP_ENGINEERING.md"), "utf8"));
    await assert.rejects(() => readFile(legacyPath));
    assert.equal(JSON.parse(await readFile(path.join(target, ".forgeloop/manifest.json"), "utf8")).layoutVersion, 2);
  });
});
