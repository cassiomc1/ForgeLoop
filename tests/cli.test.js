import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { sha256 } from "../src/core/manifest.js";
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

function runCliDirect(cwd, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
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
    await readFile(path.join(target, "LICENSE"), "utf8");
    await readFile(path.join(target, "LICENSE-DOCS.md"), "utf8");
    assert.match(
      await readFile(path.join(target, "AGENT_COMPATIBILITY.md"), "utf8"),
      /https:\/\/github\.com\/cassiomc1\/mdfiles#readme/,
    );
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

test("update keeps the previous package version when a conflict remains", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const manifestPath = path.join(target, ".mdfiles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.packageVersion = "0.0.9";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(target, "AGENTS.md"), "# Local change\n");

    const result = runCli(target, "update");
    const after = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.equal(result.status, 1);
    assert.match(result.stdout, /conflict/i);
    assert.equal(after.packageVersion, "0.0.9");
  });
});

test("update does not partially apply safe files when another file conflicts", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const manifestPath = path.join(target, ".mdfiles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const oldAgents = "# Previous managed version\n";
    await writeFile(path.join(target, "AGENTS.md"), oldAgents);
    manifest.files["AGENTS.md"].sha256 = sha256(Buffer.from(oldAgents));
    await writeFile(path.join(target, "CLAUDE.md"), "# Local conflict\n");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = runCli(target, "update");
    const after = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.equal(result.status, 1);
    assert.equal(await readFile(path.join(target, "AGENTS.md"), "utf8"), oldAgents);
    assert.deepEqual(after, manifest);
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

test("doctor strict mode fails when a managed file drifts", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    await writeFile(path.join(target, "AGENTS.md"), "# Drifted local instructions\n");

    const result = runCli(target, "doctor", "--strict");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /unhealthy/i);
    assert.match(result.stdout, /file-drift/i);
  });
});

test("doctor adopts a pre-existing adapter as preserved", async () => {
  await withTarget(async (target) => {
    await writeFile(path.join(target, "AGENTS.md"), "# Local instructions\n");
    assert.equal(runCli(target, "init").status, 0);

    const result = runCli(target, "doctor", "--adopt", "AGENTS.md", "--json");
    const report = JSON.parse(result.stdout);
    const manifest = JSON.parse(
      await readFile(path.join(target, ".mdfiles", "manifest.json"), "utf8"),
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.ok, true);
    assert.ok(report.findings.some((finding) => finding.code === "file-adopted"));
    assert.equal(manifest.files["AGENTS.md"].preserve, true);
  });
});

test("doctor reports manifest entries for templates that are no longer shipped", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const manifestPath = path.join(target, ".mdfiles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.files["obsolete-guide.md"] = { sha256: "a".repeat(64), preserve: false };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(target, "obsolete-guide.md"), "# Old guide\n");

    const result = runCli(target, "doctor", "--json");
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      report.findings.some(
        (finding) => finding.code === "manifest-orphan" && finding.path === "obsolete-guide.md",
      ),
    );
  });
});

test("update prunes removed template entries without deleting target files", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const manifestPath = path.join(target, ".mdfiles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.files["obsolete-guide.md"] = { sha256: "a".repeat(64), preserve: false };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(target, "obsolete-guide.md"), "# Old guide\n");

    const result = runCli(target, "update");
    const after = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pruned/i);
    assert.equal(after.files["obsolete-guide.md"], undefined);
    assert.equal(await readFile(path.join(target, "obsolete-guide.md"), "utf8"), "# Old guide\n");
  });
});

test("top-level help succeeds without a command", async () => {
  await withTarget(async (target) => {
    const result = runCli(target, "--help");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: mdfiles/);
  });
});

test("CLI supports version output and equals-form paths", async () => {
  const version = runCliDirect(repositoryRoot, "--version");
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.1.0");

  await withTarget(async (target) => {
    const result = runCliDirect(repositoryRoot, "init", `--path=${target}`);
    assert.equal(result.status, 0, result.stderr);
    await readFile(path.join(target, "AGENTS.md"), "utf8");
  });
});

test("CLI accepts global options before the command", async () => {
  await withTarget(async (target) => {
    const result = runCliDirect(
      repositoryRoot,
      "--dry-run",
      "init",
      `--path=${target}`,
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readdir(target), []);
  });
});

test("importing the CLI module has no command-line side effect", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", 'await import("./src/cli.js"); console.log("imported")'],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "imported");
});

test("CLI runs when invoked through an npm-style symlink", async () => {
  const binDirectory = await mkdtemp(path.join(os.tmpdir(), "mdfiles-bin-"));
  const linkedCli = path.join(binDirectory, "mdfiles");
  try {
    await symlink(cliPath, linkedCli);
    const result = spawnSync(linkedCli, ["--version"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "0.1.0");
  } finally {
    await rm(binDirectory, { recursive: true, force: true });
  }
});

test("command help lists only the selected command options", () => {
  const result = runCliDirect(repositoryRoot, "doctor", "--help");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--strict/);
  assert.match(result.stdout, /--adopt <path>/);
  assert.doesNotMatch(result.stdout, /--dry-run/);
});

test("rejects options that do not belong to the selected command", async () => {
  await withTarget(async (target) => {
    const initJson = runCli(target, "init", "--json");
    const doctorDryRun = runCli(target, "doctor", "--dry-run");

    assert.equal(initJson.status, 1);
    assert.match(initJson.stderr, /not valid for init/i);
    assert.equal(doctorDryRun.status, 1);
    assert.match(doctorDryRun.stderr, /not valid for doctor/i);
  });
});

test("reports an existing adapter that was not managed by init", async () => {
  await withTarget(async (target) => {
    await writeFile(path.join(target, "AGENTS.md"), "# Unrelated local instructions\n");
    assert.equal(runCli(target, "init").status, 0);

    const result = runCli(target, "doctor", "--json");
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 1);
    assert.equal(report.ok, false);
    assert.ok(
      report.findings.some(
        (finding) => finding.code === "unmanaged-file" && finding.path === "AGENTS.md",
      ),
    );
  });
});

test("does not relabel an existing installation when init is rerun", async () => {
  await withTarget(async (target) => {
    assert.equal(runCli(target, "init").status, 0);
    const manifestPath = path.join(target, ".mdfiles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.packageVersion = "0.0.9";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = runCli(target, "init");
    const after = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.equal(result.status, 1);
    assert.match(result.stderr, /already initialized|update/i);
    assert.equal(after.packageVersion, "0.0.9");
  });
});
