import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const repositoryRoot = path.resolve(".");

test("ForgeLoop audit checks for a receipt only after checkout", async () => {
  const workflow = (await readFile(
    path.join(repositoryRoot, ".github/workflows/forgeloop-audit.yml"),
    "utf8",
  )).replaceAll("\r\n", "\n");

  assert.doesNotMatch(workflow, /audit:\n\s+if:/);
  assert.match(workflow, /audit:\n\s+runs-on: ubuntu-latest\n\s+steps:/);
  assert.match(
    workflow,
    /- name: Check out repository\n\s+uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/,
  );
  assert.match(
    workflow,
    /- name: Set up Node\.js\n\s+uses: actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/,
  );
  assert.match(
    workflow,
    /- name: Audit ForgeLoop receipt\n\s+if: \$\{\{ hashFiles\('\.forgeloop\/execution-receipt\.json'\) != '' \}\}\n\s+run: npx @cassiomc1\/forgeloop audit --strict/,
  );
});

test("Lychee excludes only documented unavailable references", async () => {
  const config = (await readFile(path.join(repositoryRoot, ".lychee.toml"), "utf8"))
    .replaceAll("\r\n", "\n");

  assert.ok(config.includes("  '^https://fast-check\\.dev/$',"));
  assert.ok(config.includes("  '^https://gradientsaas\\.blogspot\\.com(?:/|$)',"));
});

test("Lychee throttles the Ansible documentation host", async () => {
  const config = (await readFile(path.join(repositoryRoot, ".lychee.toml"), "utf8"))
    .replaceAll("\r\n", "\n");

  assert.match(config, /\[hosts\."docs\.ansible\.com"\]/);
  assert.match(config, /concurrency = 1/);
  assert.match(config, /request_interval = "5s"/);
});

test("Lychee fallback excludes only Ansible Molecule documentation paths", async () => {
  const config = (await readFile(path.join(repositoryRoot, ".lychee.toml"), "utf8"))
    .replaceAll("\r\n", "\n");

  assert.ok(config.includes("  '^https://docs\\.ansible\\.com/projects/molecule(?:/.*)?$',"));
});
