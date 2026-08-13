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
  "practice-area emphasis",
  "fictional positioning",
  "representative specialty mix",
  "tone of the fictional firm",
  "hero messaging",
  "section ordering",
  "fictional partner/attorney profiles",
  "fictional office location",
  "visual identity",
  "demo phone number",
  "demo contact details",
  "placeholder copy",
  "placeholder legal-service descriptions",
  "fictional testimonials",
  "temporary logo text",
  "palette",
  "typography",
  "local-only fictional identity",
  "local-only form behavior",
];
const blocking = [
  "real legal business name",
  "real contact details",
  "real attorney identities",
  "credentials",
  "payment information",
  "deployment target",
  "deployment/domain authority",
  "destructive operation",
  "production endpoints",
  "real compliance representations",
  "regulated/legal claim",
  "real business facts not safely inferable",
  "irreversible architectural decision",
];

test("canonical policy distinguishes safe assumptions from blocking decisions", async () => {
  const policy = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");
  assert.match(policy, /## Blocking vs Non-Blocking Decisions/);
  assert.match(policy, /NON_BLOCKING/);
  assert.match(policy, /BLOCKING/);
  assert.match(policy, /current-contract\.assumptions\[\]/);
  assert.match(policy, /ASSUMPTION/);
  assert.match(policy, /value[\s\S]*reason[\s\S]*scope[\s\S]*reversible[\s\S]*source/i);
  assert.match(policy, /source=agent-default/);
  assert.match(policy, /Do not place resolved[\s\S]*safe assumptions in[\s`]*unresolvedDecisions/i);
  assert.match(policy, /unresolvedDecisions.*preflight.*BLOCKED/i);
  assert.match(policy, /unresolved blocking decisions.*recorded in.*current-contract\.unresolvedDecisions\[\]/i);
  assert.doesNotMatch(
    policy,
    /(?:unresolved(?: blocking)? decisions|remaining blocking items)[^.\n]*prevent contract creation/i,
  );
  assert.match(policy, /SAFE \+ REVERSIBLE \+ LOCAL[\s\n]*\+[\s\n]*NON-SENSITIVE/);
  assert.match(policy, /PRE-QUESTION CHECK/);
  assert.match(policy, /Before asking the user any product-detail question/i);
  assert.match(policy, /NON_BLOCKING[\s\S]{0,320}do not ask[\s\S]{0,320}record it in[\s`]*current-contract\.assumptions/i);
  assert.match(policy, /BLOCKING[\s\S]{0,320}persist the contract[\s\S]{0,320}ask the user/i);
  assert.match(policy, /ask_user|ASK_USER|question.*blockingReason|blockingReason.*question/i);
  assert.match(policy, /current-contract\.json.*before.*clarif|before.*clarif[\s\S]{0,240}current-contract\.json/i);
  for (const example of [...nonBlocking, ...blocking]) {
    assert.match(policy, new RegExp(example, "i"), example);
  }
});

test("adapters delegate autonomy decisions to the canonical policy", async () => {
  for (const relativePath of adapters) {
    const instructions = await readFile(path.join(root, relativePath), "utf8");
    assert.match(instructions, /reversible.*placeholder|Blocking vs Non-Blocking Decisions/i, relativePath);
    assert.match(instructions, /LOOP_ENGINEERING\.md/, relativePath);
    assert.match(instructions, /Before asking any product-detail question/i, relativePath);
    assert.match(instructions, /NON_BLOCKING[\s\S]{0,260}safe reversible local default[\s\S]{0,260}current-contract\.assumptions/i, relativePath);
    assert.match(instructions, /BLOCKING[\s\S]{0,260}current-contract\.json[\s\S]{0,260}unresolvedDecisions/i, relativePath);
    assert.match(instructions, /Do not ask the user to choose among reversible local\s+product-positioning alternatives/i, relativePath);
  }
});

test("autonomy policy does not prescribe a fabricated brand", async () => {
  const policy = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");
  assert.doesNotMatch(policy, /Smith & Partners|Silva Advocacia|Law Firm XYZ/);
  assert.match(policy, /never.*verified.*user|business fact/i);
});

test("external workflow policy preserves autonomous precedence and source attribution", async () => {
  const policy = await readFile(path.join(root, "LOOP_ENGINEERING.md"), "utf8");

  assert.match(policy, /## External Workflow Compatibility/);
  assert.match(policy, /NON_BLOCKING[\s\S]{0,260}WORKFLOW_CONFLICT[\s\S]{0,260}unresolvedDecisions/);
  assert.match(policy, /E_EXTERNAL_WORKFLOW_APPROVAL_CONFLICT/);
  assert.match(policy, /E_EXTERNAL_WORKFLOW_BLOCKS_NON_BLOCKING/);
  assert.match(policy, /E_EXTERNAL_WORKFLOW_REQUIRES_USER_GATE/);
  assert.match(policy, /autonomousMode=true/);
  assert.match(policy, /autonomousMode=false/);
  assert.match(policy, /USER_REQUIREMENT/);
  assert.match(policy, /FORGELOOP_BLOCKING_DECISION/);
  assert.match(policy, /EXTERNAL_WORKFLOW_POLICY/);
  assert.match(policy, /MODEL_PREFERENCE/);
  assert.match(policy, /INCOMPATIBLE WITH AUTONOMOUS MODE/);
  assert.match(policy, /mandatory-approval workflows enabled: NO/);
  assert.match(policy, /TEST_NOT_STARTED/);
});
