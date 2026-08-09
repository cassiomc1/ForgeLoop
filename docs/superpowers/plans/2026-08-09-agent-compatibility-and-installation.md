# Agent Compatibility and Target Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a tested ten-agent compatibility contract and document `npx` installation into any existing project directory selected by the user.

**Architecture:** A small immutable registry in `src/core/agent-support.js` is the machine-readable contract. `AGENT_COMPATIBILITY.md` is a packaged, target-installed human guide that mirrors the registry; contract tests detect drift between the registry, templates, package tarball, and guide. Existing native adapters remain unchanged, so agents that officially consume `AGENTS.md` share one canonical entry point.

**Tech Stack:** Node.js 20+, native `node:test`, ESM JavaScript, Markdown, npm package files, existing CLI commands `init`, `doctor`, and `update`.

## Global Constraints

- The target directory must already exist and be a directory.
- The package must not install agents, providers, dependencies, or credentials.
- Live LLM sessions are outside the deterministic test contract.
- `init` must preserve existing local instruction files.
- `update` must preserve `PROJECT_PROFILE.md` and locally modified managed files.
- Repository content remains English-only.
- `npm test` and `npm run pack:check` are required final checks.

---

### Task 1: Establish the failing compatibility contracts

**Files:**
- Create: `tests/compatibility.test.js`
- Modify: `tests/cli.test.js`
- Read: `src/core/templates.js`
- Read: `docs/superpowers/specs/2026-08-09-agent-compatibility-and-installation-design.md`

**Interfaces:**
- The test will consume `AGENT_SUPPORT` from `src/core/agent-support.js`.
- The test will consume `TEMPLATE_PATHS` from `src/core/templates.js`.
- Later tasks must make the test assertions pass without weakening them.

- [ ] **Step 1: Write the registry and packaging tests before production code**

Add tests with these behaviors:

```js
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { AGENT_SUPPORT } from "../src/core/agent-support.js";
import { TEMPLATE_PATHS } from "../src/core/templates.js";

const expectedIds = [
  "codex", "claude-code", "cursor", "github-copilot", "antigravity",
  "opencode", "hermes", "pi", "command-code", "freebuff",
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
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
  const paths = JSON.parse(output)[0].files.map((entry) => entry.path);
  assert.ok(paths.includes("src/core/agent-support.js"));
  assert.ok(paths.includes("AGENT_COMPATIBILITY.md"));
});
```

Add one CLI contract to `tests/cli.test.js` before implementation:

```js
test("init installs the compatibility guide only in the selected target", async () => {
  await withTarget(async (target) => {
    const result = runCli(target, "init");
    assert.equal(result.status, 0, result.stderr);
    assert.match(await readFile(path.join(target, "AGENT_COMPATIBILITY.md"), "utf8"), /Codex/);
  });
});
```

The temporary target and the existing `--path` implementation prove that the
write is scoped to the selected project directory.

- [ ] **Step 2: Run the focused test to verify the expected RED state**

Run:

```bash
node --test tests/compatibility.test.js
```

Expected: the run fails because `src/core/agent-support.js` and
`AGENT_COMPATIBILITY.md` do not exist yet. Do not implement production code
until this failure is observed.

- [ ] **Step 3: Commit only the failing test**

```bash
git add tests/compatibility.test.js tests/cli.test.js
git commit -m "test: define agent compatibility contracts"
```

### Task 2: Implement the registry and package/template wiring

**Files:**
- Create: `src/core/agent-support.js`
- Modify: `src/core/templates.js`
- Modify: `package.json`
- Test: `tests/compatibility.test.js`

**Interfaces:**
- Produce `AGENT_SUPPORT`, an immutable array of records with fields `id`,
  `name`, `support`, `instructionFiles`, `officialDocs`, and `notes`.
- Add `AGENT_COMPATIBILITY.md` to `TEMPLATE_PATHS`.
- Add `AGENT_COMPATIBILITY.md` to the npm `files` allowlist.

- [ ] **Step 1: Implement the minimal registry**

Use one record per agent with these instruction mappings:

```text
codex -> ["AGENTS.md"]
claude-code -> ["CLAUDE.md"]
cursor -> ["AGENTS.md", ".cursor/rules/project-loop.mdc"]
github-copilot -> [".github/copilot-instructions.md"]
antigravity -> ["AGENTS.md"]
opencode -> ["AGENTS.md"]
hermes -> ["AGENTS.md"]
pi -> ["AGENTS.md"]
command-code -> ["AGENTS.md"]
freebuff -> ["AGENTS.md"]
```

Freeze both the records and the containing array so tests and callers cannot
mutate the support contract at runtime.

- [ ] **Step 2: Add the compatibility guide template path and npm allowlist entry**

Append `AGENT_COMPATIBILITY.md` to `TEMPLATE_PATHS` and to the root-level npm
`files` array. Keep the existing relative-path safety model unchanged.

- [ ] **Step 3: Run the focused tests to verify GREEN**

Run:

```bash
node --test tests/compatibility.test.js
```

Expected: registry shape and file mappings pass; the guide mirror, tarball guide
entry, and selected-target CLI assertions remain red until Task 3 creates the
guide.

- [ ] **Step 4: Commit the registry wiring**

```bash
git add src/core/agent-support.js src/core/templates.js package.json
git commit -m "feat: add agent compatibility registry"
```

### Task 3: Add the installed compatibility guide

**Files:**
- Create: `AGENT_COMPATIBILITY.md`
- Test: `tests/compatibility.test.js`
- Test: `tests/cli.test.js`

**Interfaces:**
- The guide must use the registry names and support modes from the spec.
- The guide must be included by `init`, `doctor`, `update`, and `npm pack` via
  the template and package allowlists from Task 2.

- [ ] **Step 1: Write the guide with the ten-agent matrix**

Include an English table with these columns: Agent, Support, Reads, Official
documentation. Link each row to the verified official source:

- Codex: `https://developers.openai.com/codex/guides/agents-md`
- Claude Code: `https://code.claude.com/docs/en/memory`
- Cursor: `https://docs.cursor.com/context/rules-for-ai`
- GitHub Copilot: `https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide`
- Antigravity: `https://antigravity.google/docs/cli/best-practices`
- OpenCode: `https://opencode.ai/docs/rules/`
- Hermes: `https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md`
- Pi: `https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md`
- Command Code: `https://commandcode.ai/docs/core-concepts/memory`
- Freebuff: `https://github.com/CodebuffAI/codebuff/blob/main/common/src/constants/knowledge.ts`

Explain direct versus `AGENTS.md` support, Claude’s requirement for
`CLAUDE.md`, target-file precedence, the absence of live-agent testing, and
why no duplicate native adapter is installed.

- [ ] **Step 2: Run focused compatibility tests to verify GREEN**

Run:

```bash
node --test tests/compatibility.test.js
```

Expected: all compatibility and selected-target CLI tests pass.

- [ ] **Step 3: Commit the guide**

```bash
git add AGENT_COMPATIBILITY.md tests/compatibility.test.js tests/cli.test.js
git commit -m "docs: document supported coding agents"
```

### Task 4: Document target installation and update system design

**Files:**
- Modify: `README.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`

**Interfaces:**
- README commands must match the existing `parseArgs` contract: `init`,
  `doctor`, `update`, `--path`, `--dry-run`, and `--json`.
- System design support claims must match `AGENT_SUPPORT` and the guide.

- [ ] **Step 1: Expand README installation instructions**

Document Node.js 20+, current-directory installation, relative and absolute
`--path` examples, the requirement that the target directory already exists,
`--dry-run`, `doctor`, `update`, conflict handling, first-run profile setup,
and launching the preferred agent. Link to `AGENT_COMPATIBILITY.md` and list
the installed files relevant to each support mode.

- [ ] **Step 2: Update `LOOP_SYSTEM_DESIGN.md`**

Replace the four-agent claims with the ten-agent matrix and describe the two
adapter classes: native files for Codex/Claude/Cursor/Copilot and shared
`AGENTS.md` compatibility for the remaining six agents.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md LOOP_SYSTEM_DESIGN.md
git commit -m "docs: explain target installation and agent support"
```

### Task 5: Run complete regression and review the diff

**Files:**
- Read: `docs/superpowers/specs/2026-08-09-agent-compatibility-and-installation-design.md`
- Read: all changed files from Tasks 1–4

**Interfaces:**
- No additional production interface; this task verifies the acceptance
  criteria and records any limitation without weakening tests.

- [ ] **Step 1: Run the complete Node test suite**

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the package-specific tarball check**

```bash
npm run pack:check
```

Expected: the npm dry-run contains the registry, guide, adapters, and license
files and excludes tests and maintenance-only files.

- [ ] **Step 3: Run repository hygiene checks**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only the intended feature files changed.

- [ ] **Step 4: Review the acceptance checklist and record the verified result**

Confirm the target-path workflow, ten-agent matrix, Codex/Claude official links,
preservation behavior, and explicit no-live-agent limitation against the spec.
If any scoped fix remains uncommitted after the checks, commit only that fix:

```bash
git add AGENT_COMPATIBILITY.md README.md LOOP_SYSTEM_DESIGN.md package.json src tests
git commit -m "chore: close agent compatibility verification"
```
