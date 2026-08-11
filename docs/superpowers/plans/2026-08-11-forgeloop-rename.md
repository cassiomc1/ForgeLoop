# ForgeLoop Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the active package, CLI, installed target metadata, and public documentation from `mdfiles` to `ForgeLoop`, while adding the approved architecture diagram and preserving protocol version 1.

**Architecture:** `ForgeLoop` becomes the public product name and `forgeloop` becomes the machine-readable package/CLI identifier. The installer and resumable-state boundary moves from `.mdfiles` to `.forgeloop`; the existing command behavior, JSON contracts, schemas, freshness semantics, and safe-path boundaries remain otherwise unchanged. The architecture diagram is canonical in `LOOP_SYSTEM_DESIGN.md` and discoverable from `README.md`.

**Tech Stack:** Node.js built-ins, npm package metadata, Markdown templates, JSON schemas, Node test runner, Python repository validators, GitHub Actions documentation checks.

## Global Constraints

- Keep `schemaVersion: 1` and `protocolVersion: 1`; do not change JSON schema fields or status vocabulary.
- Use `ForgeLoop` for human-facing product text and `forgeloop` for npm, CLI, and filesystem identifiers.
- Use `.forgeloop/manifest.json` and `.forgeloop/work-state.json` as the only new canonical target paths.
- Do not create a dual-write `.mdfiles`/`.forgeloop` implementation or automatic recursive migration.
- Document the manual migration `mv .mdfiles .forgeloop` followed by `npx @cassiomc1/forgeloop update`.
- Keep the current GitHub remote URL `https://github.com/cassiomc1/mdfiles` unchanged; repository rename, push, PR, merge, and npm publication are outside this implementation plan.
- Do not rewrite historical `docs/superpowers/` records solely to remove factual historical `mdfiles` references.
- Preserve Node.js `>=20`, built-in runtime dependencies, safe-path checks, secret scanning, and deterministic output.
- Run the focused test after each behavior slice, then run the full Node, package, Python, Markdown, loop, and secret checks.

---

### Task 1: Add failing ForgeLoop identity and path-contract tests

**Files:**
- Create: `tests/forgeloop-identity.test.js`
- Test: `tests/package.test.js`, `tests/cli.test.js`, `tests/work-state.test.js`
- Reference: `package.json`, `src/core/templates.js`, `src/core/work-state.js`, `src/cli.js`

**Interfaces:**
- Consumes: current package metadata, CLI usage output, template path list, and work-state path constant.
- Produces: executable assertions for the new package name, binary name, product label, `.forgeloop` paths, and diagram markers.

- [ ] **Step 1: Write the failing identity tests.** Assert that `package.json.name` is `@cassiomc1/forgeloop`, `package.json.bin.forgeloop` points to `src/cli.js`, `TEMPLATE_PATHS` contains `.forgeloop/.gitignore` and no canonical `.mdfiles` entry, `WORK_STATE_PATH` is `.forgeloop/work-state.json`, and `node src/cli.js --help` starts with `Usage: forgeloop`.

```js
test("ForgeLoop package and target identity are canonical", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.name, "@cassiomc1/forgeloop");
  assert.equal(packageJson.bin.forgeloop, "src/cli.js");
  assert.equal(TEMPLATE_PATHS.includes(".forgeloop/.gitignore"), true);
  assert.equal(TEMPLATE_PATHS.some((entry) => entry.startsWith(".mdfiles/")), false);
  assert.equal(WORK_STATE_PATH, ".forgeloop/work-state.json");
});
```

- [ ] **Step 2: Run the focused tests and observe the old identity failures.**

Run: `node --test tests/forgeloop-identity.test.js tests/package.test.js`

Expected: FAIL because the current package/bin/path values still use `mdfiles` and `.mdfiles`.

- [ ] **Step 3: Commit the red tests.**

```bash
git add tests/forgeloop-identity.test.js
git commit -m "test: define ForgeLoop identity contract"
```

### Task 2: Rename package metadata, CLI identity, and template path constants

**Files:**
- Modify: `package.json`
- Modify: `src/cli.js`
- Modify: `src/core/templates.js`
- Modify: `src/core/work-state.js`
- Rename: `.mdfiles/.gitignore` → `.forgeloop/.gitignore`
- Test: `tests/forgeloop-identity.test.js`, `tests/cli.test.js`, `tests/package.test.js`

**Interfaces:**
- Consumes: the failing identity assertions from Task 1.
- Produces: `@cassiomc1/forgeloop`, executable `forgeloop`, usage text `forgeloop`, `TEMPLATE_PATHS` rooted at `.forgeloop`, and `WORK_STATE_PATH` rooted at `.forgeloop`.

- [ ] **Step 1: Update package metadata without changing the remote coordinate.** Set `name` to `@cassiomc1/forgeloop` and replace the `bin` key `mdfiles` with `forgeloop`; keep the existing repository and homepage URLs because the GitHub slug is intentionally unchanged in this task.
- [ ] **Step 2: Rename the repository-shipped target ignore template.** Use `git mv .mdfiles/.gitignore .forgeloop/.gitignore` and update `TEMPLATE_PATHS` to the new path.
- [ ] **Step 3: Change the CLI usage identity.** Update the usage string and any user-facing executable references in `src/cli.js` from `mdfiles` to `forgeloop`; retain all command names, options, exit codes, and JSON shapes.
- [ ] **Step 4: Change the runtime state boundary.** Set `WORK_STATE_PATH` to `.forgeloop/work-state.json` and update all manifest/state path construction that currently depends on `.mdfiles`; do not broaden clear-state deletion beyond the exact new state path.
- [ ] **Step 5: Run the focused identity and package tests.**

Run: `node --test tests/forgeloop-identity.test.js tests/package.test.js tests/cli.test.js`

Expected: PASS for package name/bin, CLI usage, template paths, init/update/doctor/status behavior, and package contents.

- [ ] **Step 6: Commit the executable identity slice.**

```bash
git add package.json src/cli.js src/core/templates.js src/core/work-state.js .forgeloop/.gitignore tests/forgeloop-identity.test.js tests/cli.test.js tests/package.test.js
git commit -m "feat: rename package and CLI to ForgeLoop"
```

### Task 3: Align commands, manifests, fixtures, and runtime tests with `.forgeloop`

**Files:**
- Modify: `src/commands/init.js`, `src/commands/update.js`, `src/commands/doctor.js`, `src/commands/inspect.js`, `src/core/manifest.js`, `src/core/inspect.js`
- Modify: `tests/cli.test.js`, `tests/core.test.js`, `tests/json-output.test.js`, `tests/observability.test.js`, `tests/portability.test.js`, `tests/work-state.test.js`, `tests/checkpoint-freshness.test.js`, `tests/validate-protocol-cli.test.js`
- Modify: `tests/fixtures/protocol/v1/work-state.json`, `tests/fixtures/protocol/invalid/*.json` only where a path example is present
- Test: all affected Node tests

**Interfaces:**
- Consumes: `.forgeloop` path constants and template list from Task 2.
- Produces: all installer, update, doctor, inspect, status, validate-state, clear-state, and conformance flows reading/writing the same new target boundary.

- [ ] **Step 1: Search the runtime and current tests for `.mdfiles` path literals.** Use `git grep -n -E '\.mdfiles|mdfiles-cli|mdfiles-target|mdfiles-caller' -- src tests` and classify each occurrence as an operational path, test fixture name, or historical text.
- [ ] **Step 2: Replace operational paths and test fixtures.** Update manifest reads/writes, state reads/writes, target setup assertions, temporary-directory prefixes, and expected error text to `.forgeloop`/`forgeloop`; keep unrelated repository URL evidence unchanged.
- [ ] **Step 3: Add a migration safety assertion.** Verify `clear-state` removes only `.forgeloop/work-state.json`, never recursively removes `.forgeloop`, and does not touch a sibling legacy `.mdfiles` directory that a user has not manually migrated.
- [ ] **Step 4: Run the affected runtime tests.**

Run: `node --test tests/cli.test.js tests/core.test.js tests/json-output.test.js tests/observability.test.js tests/portability.test.js tests/work-state.test.js tests/checkpoint-freshness.test.js tests/validate-protocol-cli.test.js`

Expected: PASS with all target fixtures using `.forgeloop` and no destructive legacy-path behavior.

- [ ] **Step 5: Commit the target-boundary slice.**

```bash
git add src/commands src/core tests
git commit -m "refactor: move target metadata to .forgeloop"
```

### Task 4: Update active documentation and add the canonical architecture diagram

**Files:**
- Modify: `README.md`, `LOOP_SYSTEM_DESIGN.md`, `ORCHESTRATOR_INTEGRATION.md`, `LOOP_ENGINEERING.md`, `GUIDE_ROUTER.md`, `PROJECT_PROFILE.md`, `EXECUTION_STATE.md`, `DELEGATION_PROTOCOL.md`, `THREAT_MODEL.md`, `QUALITY_SCORECARD.md`, `CONTRACT_COVERAGE.md`, `TERMINOLOGY.md`, `AGENT_COMPATIBILITY.md`, `THIRD_PARTY_NOTICES.md`
- Modify: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`
- Modify: active `ENG/*.md` and any shipped root template documents containing the product name or target path
- Test: `tests/forgeloop-identity.test.js`, `tests/test_validate_markdown.py`, `tests/test_validate_loop_system.py`, `tests/test_workflow_policy.py`

**Interfaces:**
- Consumes: `ForgeLoop`/`forgeloop` naming contract and migration boundary from the design spec.
- Produces: active public documentation that teaches the new command/path and one canonical text diagram copied with the kit.

- [ ] **Step 1: Add the diagram to `LOOP_SYSTEM_DESIGN.md`.** Insert the approved `FORGELOOP` text diagram in a fenced `text` block near the objective/architecture section, retaining the labels `ROUTING`, `STATE`, `EVIDENCE`, `repository`, `contract`, `freshness`, `CONFORMANCE`, `DELEGATION`, and `VALID / STALE / INVALID`.
- [ ] **Step 2: Link the diagram from `README.md`.** Add a short architecture paragraph pointing to `LOOP_SYSTEM_DESIGN.md`, update npm examples to `@cassiomc1/forgeloop`, CLI examples to `forgeloop`, and state/manifest examples to `.forgeloop`.
- [ ] **Step 3: Update active operational documents.** Replace active product/command/path references in the listed root documents, adapters, and guides; preserve the current GitHub URL as an explicit operational coordinate and leave historical superpowers records unchanged.
- [ ] **Step 4: Document manual migration.** Add the exact sequence `mv .mdfiles .forgeloop` followed by `npx @cassiomc1/forgeloop update`, explain that no automatic dual-write migration occurs, and state that protocol/schema versions are unchanged.
- [ ] **Step 5: Run documentation validators.**

Run: `python3 -m unittest tests.test_validate_markdown tests.test_validate_loop_system tests.test_workflow_policy -v && python3 scripts/validate_markdown.py --self-test && python3 scripts/validate_markdown.py && python3 scripts/validate_loop_system.py --self-test && python3 scripts/validate_loop_system.py`

Expected: all Python tests and structural validators pass, including the new diagram and link targets.

- [ ] **Step 6: Commit the documentation slice.**

```bash
git add README.md LOOP_SYSTEM_DESIGN.md ORCHESTRATOR_INTEGRATION.md LOOP_ENGINEERING.md GUIDE_ROUTER.md PROJECT_PROFILE.md EXECUTION_STATE.md DELEGATION_PROTOCOL.md THREAT_MODEL.md QUALITY_SCORECARD.md CONTRACT_COVERAGE.md TERMINOLOGY.md AGENT_COMPATIBILITY.md THIRD_PARTY_NOTICES.md AGENTS.md CLAUDE.md .cursor/rules/project-loop.mdc .github/copilot-instructions.md ENG
git commit -m "docs: introduce ForgeLoop architecture and migration"
```

### Task 5: Align identity validators, package assertions, and active-reference audit

**Files:**
- Modify: `scripts/validate_loop_system.py`
- Modify: `tests/test_validate_loop_system.py`, `tests/test_workflow_policy.py`, `tests/package.test.js`, `tests/forgeloop-identity.test.js`
- Modify: `.github/workflows/docs-quality.yml`, `.github/workflows/npm-publish.yml` only for executable/package name references; keep workflow and remote URLs valid

**Interfaces:**
- Consumes: renamed active documents and package metadata from Tasks 2–4.
- Produces: validators and package checks that recognize ForgeLoop while still distinguishing historical records and the unchanged remote slug.

- [ ] **Step 1: Update validator literals.** Change architecture-contract prohibited-runtime checks and documentation expectations from `mdfiles run` to `forgeloop run` where they describe the active product; do not loosen the checks.
- [ ] **Step 2: Update package and workflow assertions.** Assert the new package name/bin/path and retain the Node 20/22/24 matrix, OIDC workflow, remote action URLs, and exact package exclusion rules.
- [ ] **Step 3: Add the active-reference audit.** Make the identity test scan runtime files, shipped templates, and active public docs for accidental `@cassiomc1/mdfiles`, `mdfiles` CLI examples, or `.mdfiles` paths, with explicit exclusions for historical `docs/superpowers` records and the current remote URL.
- [ ] **Step 4: Run the validators and package checks.**

Run: `node --test tests/forgeloop-identity.test.js tests/package.test.js && python3 -m unittest discover -s tests -v && python3 scripts/scan_secrets.py`

Expected: all identity, package, Python, and secret checks pass; the audit reports only documented exceptions.

- [ ] **Step 5: Commit validator alignment.**

```bash
git add scripts/validate_loop_system.py tests .github/workflows
git commit -m "test: enforce ForgeLoop identity boundaries"
```

### Task 6: Full regression, scope review, and final handoff

**Files:**
- Test: entire repository
- Review: all commits and `git diff origin/main...HEAD`

**Interfaces:**
- Consumes: all renamed runtime, package, documentation, validator, and test surfaces.
- Produces: a clean, locally verified ForgeLoop branch with no remote publication claim.

- [ ] **Step 1: Run the official Node suite.**

Run: `npm test`

Expected: every Node test passes on Node.js 20 or newer.

- [ ] **Step 2: Run package, documentation, loop, and security gates.**

Run: `npm run pack:check`

Run: `python3 -m unittest discover -s tests -v`

Run: `python3 scripts/validate_markdown.py --self-test && python3 scripts/validate_markdown.py`

Run: `python3 scripts/validate_loop_system.py --self-test && python3 scripts/validate_loop_system.py`

Run: `python3 scripts/scan_secrets.py`

Expected: all commands exit 0; package listing contains `.forgeloop/.gitignore` and no local `.forgeloop/work-state.json`.

- [ ] **Step 3: Audit the final diff and active identity.** Run `git diff --check`, `git status -sb`, `git diff --name-only origin/main...HEAD`, and the active-reference audit from Task 5. Confirm no schema metadata changed and no remote operation occurred.
- [ ] **Step 4: Report the result.** Include the branch/worktree, commits, tests actually run, migration note, intentional historical/current-remote exceptions, and explicit publication state.

