import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { TEMPLATE_PATHS } from "../src/core/templates.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repositoryRoot, "src", "cli.js");

async function withTarget(run) {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-cli-"));
  try {
    await run(target);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

function runCliFrom(cwd, target, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args, "--path", target], {
    cwd,
    encoding: "utf8",
  });
}

function runCli(target, ...args) {
  return runCliFrom(repositoryRoot, target, ...args);
}

test("init copies canonical files and creates a manifest", async () => {
  await withTarget(async (target) => {
    const result = runCli(target, "init");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /created/i);
    assert.match(await readFile(path.join(target, "AGENTS.md"), "utf8"), /LOOP_ENGINEERING/);

    const manifest = JSON.parse(
      await readFile(path.join(target, ".mdfiles", "manifest.json"), "utf8"),
    );
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.packageVersion, "0.1.0");
    assert.equal(manifest.files["PROJECT_PROFILE.md"].preserve, true);
    assert.ok(manifest.files["AGENTS.md"].sha256);
  });
});

test("init preserves a pre-existing adapter", async () => {
  await withTarget(async (target) => {
    const existing = "# Local instructions\n";
    await writeFile(path.join(target, "AGENTS.md"), existing);

    const result = runCli(target, "init");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(path.join(target, "AGENTS.md"), "utf8"), existing);
  });
});

test("doctor returns healthy after init and explains profile initialization", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const result = runCli(target, "doctor");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /healthy/i);
    assert.match(result.stdout, /profile/i);
  });
});

test("update reports a local conflict without changing the file", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const agentsPath = path.join(target, "AGENTS.md");
    await writeFile(agentsPath, "# Local change\n");

    const result = runCli(target, "update");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /conflict/i);
    assert.equal(await readFile(agentsPath, "utf8"), "# Local change\n");
  });
});

test("update always preserves the project profile", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const profilePath = path.join(target, "PROJECT_PROFILE.md");
    const profile = await readFile(profilePath, "utf8");
    await writeFile(profilePath, `${profile}\n# Project-specific note\n`);

    const result = runCli(target, "update");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(profilePath, "utf8"), `${profile}\n# Project-specific note\n`);
  });
});

test("init dry-run does not write files", async () => {
  await withTarget(async (target) => {
    const result = runCli(target, "init", "--dry-run");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /would create|dry-run/i);
    assert.deepEqual(await readdir(target), []);
  });
});

test("init installs all templates only in the selected target", async () => {
  const caller = await mkdtemp(path.join(os.tmpdir(), "mdfiles-caller-"));
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-target-"));
  try {
    const result = runCliFrom(caller, target, "init");

    assert.equal(result.status, 0, result.stderr);
    for (const relativePath of TEMPLATE_PATHS) {
      await readFile(path.join(target, relativePath), "utf8");
    }
    assert.deepEqual(await readdir(caller), []);
  } finally {
    await rm(caller, { recursive: true, force: true });
    await rm(target, { recursive: true, force: true });
  }
});
