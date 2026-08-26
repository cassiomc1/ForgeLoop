import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const pinnedAction = /uses:\s+[^\s]+@[0-9a-f]{40}\s+#/g;

async function readWorkflow(name) {
  return (await readFile(`.github/workflows/${name}`, "utf8")).replace(/\r\n/g, "\n");
}

test("quality workflows install the lockfile and enforce the local toolchain", async () => {
  const docs = await readWorkflow("docs-quality.yml");
  const audit = await readWorkflow("forgeloop-audit.yml");
  const publish = await readWorkflow("npm-publish.yml");

  assert.match(docs, /npm ci --ignore-scripts/);
  assert.match(docs, /npm run dependency:policy/);
  assert.match(docs, /npm run lint/);
  assert.match(docs, /npm run coverage/);
  assert.match(docs, /npm run docs:diagrams:check/);
  assert.match(docs, /npm run docs:check/);
  assert.match(docs, /npm run docs:check/);
  assert.match(docs, /--exclude-path '\(\^\|\/\)node_modules\(\/\|\$\)'/);
  assert.match(docs, /--exclude-path '\(\^\|\/\)coverage\(\/\|\$\)'/);
  assert.match(await readFile(".markdownlint-cli2.jsonc", "utf8"), /"ignores"/);
  assert.match(await readFile(".markdownlint-cli2.jsonc", "utf8"), /"\*\*\/node_modules\/\*\*"/);
  assert.match(audit, /npm ci --ignore-scripts/);
  assert.doesNotMatch(audit, /npx @cassiomc1\/forgeloop/);
  assert.match(publish, /npm ci --ignore-scripts/);
  assert.match(publish, /npm run dependency:policy/);

  for (const workflow of [docs, audit, publish]) {
    assert.ok((workflow.match(pinnedAction) ?? []).length > 0);
  }
});

test("CLI portability timeout covers the slowest supported runner", async () => {
  const docs = await readWorkflow("docs-quality.yml");
  const portabilityJob = docs.match(/\n  cli-portability:\n([\s\S]*?)(?=\n  [a-z][^:\n]*:\n|$)/)?.[1];

  assert.ok(portabilityJob, "cli-portability job must exist");
  const timeoutMinutes = Number(
    portabilityJob.match(/^    timeout-minutes:\s*(\d+)\s*$/m)?.[1],
  );
  assert.ok(
    timeoutMinutes >= 15,
    `cli-portability timeout must be at least 15 minutes; found ${timeoutMinutes}`,
  );
});

test("security and release workflows are present and use pinned actions", async () => {
  const codeql = await readWorkflow("codeql.yml");
  const dependencyReview = await readWorkflow("dependency-review.yml");
  const releaseNotes = await readWorkflow("release-notes.yml");

  assert.match(codeql, /github\/codeql-action\/init@[0-9a-f]{40}/);
  assert.match(codeql, /github\/codeql-action\/analyze@[0-9a-f]{40}/);
  assert.match(dependencyReview, /actions\/dependency-review-action@[0-9a-f]{40}/);
  assert.match(releaseNotes, /gh release create/);
  assert.match(releaseNotes, /--generate-notes/);
  assert.match(releaseNotes, /npm pack --json/);
  assert.match(releaseNotes, /sha256sum/);

  for (const workflow of [codeql, dependencyReview, releaseNotes]) {
    assert.ok((workflow.match(pinnedAction) ?? []).length > 0);
  }
});
