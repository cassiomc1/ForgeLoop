import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(".");
const adapters = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursor/rules/project-loop.mdc",
  ".github/copilot-instructions.md",
];
const nonBlocking = [
  "fictional company name",
  "demo phone number",
  "placeholder copy",
  "temporary logo text",
  "palette",
  "typography",
  "local-only fictional identity",
];
const blocking = [
  "real legal business name",
  "real contact details",
  "credentials",
  "deployment target",
  "destructive operation",
  "production endpoint",
  "regulated/legal claim",
  "payment data",
  "irreversible architectural decision",
];

test("canonical policy distinguishes safe assumptions from blocking decisions", async () => {
  const policy = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");
  assert.match(policy, /## Blocking vs Non-Blocking Decisions/);
  assert.match(policy, /NON_BLOCKING/);
  assert.match(policy, /BLOCKING/);
  assert.match(policy, /current-contract\.assumptions\[\]/);
  assert.match(policy, /ASSUMPTION/);
  assert.match(policy, /value.*reason.*scope.*reversible.*source/i);
  assert.match(policy, /source=agent-default/);
  assert.match(policy, /Do not place resolved safe assumptions in unresolvedDecisions/i);
  assert.match(policy, /unresolvedDecisions.*preflight.*BLOCKED/i);
  assert.match(policy, /SAFE \+ REVERSIBLE \+ LOCAL \+ NON-SENSITIVE/);
  for (const example of [...nonBlocking, ...blocking]) {
    assert.match(policy, new RegExp(example, "i"), example);
  }
});

test("adapters delegate autonomy decisions to the canonical policy", async () => {
  for (const relativePath of adapters) {
    const instructions = await readFile(path.join(root, relativePath), "utf8");
    assert.match(instructions, /reversible.*placeholder|Blocking vs Non-Blocking Decisions/i, relativePath);
    assert.match(instructions, /LOOP_ENGINEERING\.md/, relativePath);
  }
});

test("autonomy policy does not prescribe a fabricated brand", async () => {
  const policy = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");
  assert.doesNotMatch(policy, /Smith & Partners|Silva Advocacia|Law Firm XYZ/);
  assert.match(policy, /never.*verified.*user|business fact/i);
});
