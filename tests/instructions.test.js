import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(".");
const adapterFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursor/rules/project-loop.mdc",
  ".github/copilot-instructions.md",
];

test("canonical instructions require post-implementation lifecycle closure", async () => {
  const instructions = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");

  assert.match(instructions, /POST-IMPLEMENTATION CLOSURE/i);
  assert.match(instructions, /EXECUTING[\s\S]{0,500}VERIFYING[\s\S]{0,500}REVIEWING/i);
  assert.match(instructions, /record verification evidence/i);
  assert.match(instructions, /execution receipt/i);
  assert.match(instructions, /must not terminate in EXECUTING/i);
  assert.match(instructions, /BLOCKED|PARTIALLY VERIFIED/i);
});
test("shipped adapter entry points repeat the closure trigger", async () => {
  for (const relativePath of adapterFiles) {
    const instructions = await readFile(path.join(root, relativePath), "utf8");
    assert.match(instructions, /EXECUTING/i, relativePath);
    assert.match(instructions, /VERIFYING/i, relativePath);
    assert.match(instructions, /REVIEWING/i, relativePath);
    assert.match(instructions, /receipt/i, relativePath);
    assert.match(instructions, /COMPLETE.*VALID|validator-backed/i, relativePath);
    assert.match(instructions, /blocked|partial/i, relativePath);
  }
});

test("shipped instructions require querying the next lifecycle action", async () => {
  const trigger = /After implementation work for the current task is complete, run `forgeloop next`/i;
  for (const file of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/project-loop.mdc", ".github/copilot-instructions.md"]) {
    assert.match(await readFile(file, "utf8"), trigger, file);
  }
  assert.match(await readFile("LOOP_ENGINEERING.md", "utf8"), /ACT.*QUERY NEXT.*ACT/s);
  assert.match(await readFile("README.md", "utf8"), /forgeloop next(?: --task \S+)? --json/);
});
