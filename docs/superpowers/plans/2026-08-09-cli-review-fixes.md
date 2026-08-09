# CLI Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as falhas reproduzidas no instalador npm, ampliar as regressões e alinhar CI, publicação, documentação e metadados para uma entrega segura.

**Architecture:** Preserve the existing dependency-free ESM CLI and its command/core split. Harden filesystem containment at the target boundary, make command parsing explicit, keep manifest ownership conservative, and surface unmanaged adapters in `doctor`. Add behavior tests before each production change and run repository plus package gates before GitHub integration.

**Tech Stack:** Node.js 20+, native `node:test`, ESM JavaScript, Python standard-library validators, GitHub Actions, Markdown, npm package metadata.

## Global Constraints

- Preserve existing local instruction files and `PROJECT_PROFILE.md`.
- Never write through a symlink outside the requested target directory.
- `--dry-run` must perform no writes; incompatible options must fail clearly.
- Keep runtime dependencies empty and retain Node.js `>=20` support.
- Do not publish until package tests, documentation validators, secret scanning, and package-content checks pass.
- Keep the change limited to the reproduced logic, usability, CI, publication, and documentation findings.

---

### Task 1: Add failing CLI regression tests

**Files:**
- Modify: `tests/cli.test.js`
- Modify: `tests/core.test.js`
- Modify: `tests/package.test.js`

**Interfaces:**
- Tests invoke `node src/cli.js` in isolated temporary directories.
- Tests cover top-level help, option validation, symlink containment, unmanaged adapters, existing-initialization guards, and executable package metadata.

- [x] **Step 1: Write failing tests** for each reproduced behavior: `--help` succeeds; incompatible flags fail; `init` rejects a symlinked parent; `doctor` reports an unmanaged pre-existing adapter; rerunning `init` does not relabel an older manifest; and the CLI has a Node shebang.
- [x] **Step 2: Run the focused tests** with `npm test -- --test-name-pattern='help|option|symlink|unmanaged|re-run|shebang'` and confirm expected failures.

### Task 2: Harden CLI behavior and filesystem boundaries

**Files:**
- Modify: `src/cli.js`
- Modify: `src/core/filesystem.js`
- Modify: `src/commands/init.js`
- Modify: `src/commands/doctor.js`

**Interfaces:**
- `parseArgs(argv)` accepts global help and rejects options not supported by the selected command.
- `ensureWithin(root, relativePath)` validates lexical and real filesystem containment before writes.
- `runInit` preserves an existing manifest version and directs initialized targets to `update`.
- `runDoctor` emits a stable warning/error for existing template paths absent from the managed manifest.

- [x] **Step 1: Implement the minimal fixes** after the tests are RED, including `#!/usr/bin/env node` in `src/cli.js`.
- [x] **Step 2: Run focused tests** and confirm GREEN.
- [x] **Step 3: Run the complete Node suite** with `npm test`.

### Task 3: Align packaging, CI, and release safety

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/docs-quality.yml`
- Modify: `.github/workflows/npm-publish.yml`
- Modify: `tests/package.test.js`

**Interfaces:**
- Package tests verify the executable entry contract and included files.
- Documentation CI runs Node tests and package-content checks in addition to existing validators.
- Publication runs the complete local quality gate and validates the tag version against `package.json` before `npm publish`.

- [x] **Step 1: Add failing package/CI assertions** where behavior can be tested locally.
- [x] **Step 2: Implement package and workflow changes** without adding runtime dependencies.
- [x] **Step 3: Run package tests and inspect workflow YAML** for valid syntax and complete gates.

### Task 4: Correct user-facing documentation and license metadata

**Files:**
- Modify: `README.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`
- Modify: `AGENT_COMPATIBILITY.md`
- Modify: `package.json`

**Interfaces:**
- README installation commands describe the current registry state and a working local/repository fallback until publication exists.
- Local checks include `npm test` and `npm run pack:check`.
- Documentation distinguishes MIT CLI code, CC BY documentation, and third-party notices.

- [x] **Step 1: Update documentation** to match implemented behavior and release state.
- [x] **Step 2: Run Markdown, relative-link, frontmatter, and secret validators** available in the repository.

### Task 5: Verify, commit, publish, and merge

**Files:**
- All files changed by Tasks 1–4.

- [x] **Step 1: Run fresh full verification**: Node tests, Python tests, loop self-test/validation, secret scan, package check, YAML parse, and `git diff --check`.
- [ ] **Step 2: Inspect the complete diff and stage only scoped files.**
- [ ] **Step 3: Commit with a focused message and push the current branch with tracking.**
- [ ] **Step 4: Open the pull request against the repository default branch, wait for all checks, diagnose/retry transient failures, and merge only after every required check is green.**
- [ ] **Step 5: Verify the post-merge branch and remote state.**
