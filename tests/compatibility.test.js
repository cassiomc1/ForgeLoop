import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { AGENT_SUPPORT } from "../src/core/agent-support.js";
import { TEMPLATE_PATHS } from "../src/core/templates.js";

const expectedIds = [
  "codex",
  "claude-code",
  "cursor",
  "github-copilot",
  "antigravity",
  "opencode",
  "hermes",
  "pi",
  "command-code",
  "freebuff",
];

test("agent registry covers every supported agent exactly once", () => {
  assert.deepEqual(AGENT_SUPPORT.map((agent) => agent.id), expectedIds);
  assert.equal(new Set(AGENT_SUPPORT.map((agent) => agent.id)).size, expectedIds.length);
});

test("agent registry uses valid support records and packaged instruction files", () => {
  for (const agent of AGENT_SUPPORT) {
    assert.match(agent.name, /\S/);
    assert.ok(["direct", "agents-md"].includes(agent.support));
    assert.ok(agent.instructionFiles.length > 0);
    assert.ok(agent.instructionFiles.every((file) => TEMPLATE_PATHS.includes(file)));
    assert.match(agent.officialDocs, /^https:\/\//);
  }
});

test("compatibility guide mirrors every registry entry", async () => {
  const guide = await readFile("AGENT_COMPATIBILITY.md", "utf8");
  for (const agent of AGENT_SUPPORT) {
    assert.match(guide, new RegExp(`\\| ${agent.name} \\|`));
    assert.match(guide, new RegExp(`\\| ${agent.name} \\| [^|]+ \\|`));
  }
});

test("npm package contains the registry and compatibility guide", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
  });
  const paths = JSON.parse(output)[0].files.map((entry) => entry.path);
  assert.ok(paths.includes("src/core/agent-support.js"));
  assert.ok(paths.includes("AGENT_COMPATIBILITY.md"));
});
