# Public npm Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Add a safe, dependency-free Node.js CLI that distributes this instruction kit through a public npm package with `init`, `doctor`, and `update` commands.

**Architecture:** Keep the repository's Markdown files as the single template source. Add a small ESM Node CLI under `src/` that resolves those canonical files from the installed package, stores per-project state in `.mdfiles/manifest.json`, and performs hash-based conflict detection. Publish metadata lives at the repository root; the existing Python validators remain independent regression checks.

**Tech Stack:** Node.js 20+, npm, ECMAScript modules, Node built-ins (`node:fs`, `node:path`, `node:crypto`, `node:test`), Python standard-library validators, Markdown quality workflow.

## Global Constraints

- `mdfiles init` never overwrites existing files.
- `mdfiles update` never overwrites a locally modified managed file, `PROJECT_PROFILE.md`, local instructions, or unmanaged files.
- All target paths stay within the requested project directory.
- `--dry-run` performs no writes.
- Runtime dependencies remain empty; development uses only npm's built-in test runner.
- Node.js 20+ is the supported runtime; the publishing workflow uses Node.js 22.14+ and npm 11.5.1+.
- The package name is `@cassiomc1/mdfiles` and its executable is `mdfiles`.
- Publishing remains blocked until license and third-party provenance review is complete.
- Every implementation task follows RED → verify failure → GREEN → verify pass → refactor.

---

### Task 1: Add package metadata and behavior-first CLI tests

**Files:**

- Create: `package.json`
- Create: `tests/cli.test.js`

**Interfaces:**

- Tests invoke `node src/cli.js <command>` in temporary directories.
- The package exposes `mdfiles` through the `bin` field and runs tests with `node --test tests/*.test.js`.

- [ ] **Step 1: Write the failing tests**

  Add tests that assert:

  - `init` copies a canonical file and creates `.mdfiles/manifest.json`.
  - `init` preserves a pre-existing `AGENTS.md`.
  - `doctor` reports a healthy initialized target.
  - `update` detects a locally edited file and leaves its bytes unchanged.
  - `update` preserves `PROJECT_PROFILE.md`.
  - `--dry-run` reports actions without creating files.

- [ ] **Step 2: Run the focused tests and verify the expected RED state**

  Run: `npm test -- --test-name-pattern="init|doctor|update|dry-run"`

  Expected: FAIL because `src/cli.js` does not exist yet.

- [ ] **Step 3: Add package metadata only**

  Create `package.json` with:

  ```json
  {
    "name": "@cassiomc1/mdfiles",
    "version": "0.1.0",
    "description": "Portable, verifiable instruction kit for AI agents and developers",
    "type": "module",
    "engines": { "node": ">=20" },
    "bin": { "mdfiles": "src/cli.js" },
    "files": ["src", "ENG", "AGENTS.md", "CLAUDE.md", "GUIDE_ROUTER.md", "LOOP_ENGINEERING.md", "LOOP_SYSTEM_DESIGN.md", "PROJECT_PROFILE.md", "THIRD_PARTY_NOTICES.md", ".cursor", ".github/copilot-instructions.md", "README.md"],
    "scripts": { "test": "node --test tests/*.test.js", "pack:check": "node --test tests/package.test.js" }
  }
  ```

- [ ] **Step 4: Run the focused tests again**

  Run: `npm test -- --test-name-pattern="init|doctor|update|dry-run"`

  Expected: the same functional failures, now with valid test discovery and no package configuration errors.

- [ ] **Step 5: Commit the test contract**

  ```bash
  git add package.json tests/cli.test.js
  git commit -m "test: define npm cli behavior"
  ```

### Task 2: Implement safe path, template, and manifest primitives

**Files:**

- Create: `src/core/filesystem.js`
- Create: `src/core/templates.js`
- Create: `src/core/manifest.js`
- Test: `tests/cli.test.js`

**Interfaces:**

- `resolveTarget(cwd, requestedPath)` returns an existing absolute directory or throws a user-facing error.
- `readTemplateEntries(packageRoot)` returns canonical relative paths and source bytes.
- `sha256(bytes)` returns a lowercase hexadecimal digest.
- `readManifest(target)` returns a validated manifest or `null`.
- `writeManifest(target, manifest, dryRun)` writes atomically when not dry-running.

- [ ] **Step 1: Add primitive-specific failing assertions**

  Assert that a path such as `../outside` is rejected, manifest hashes round-trip, and template paths all remain relative to the package root.

- [ ] **Step 2: Run the primitive tests and verify RED**

  Run: `npm test -- --test-name-pattern="path|manifest|template"`

  Expected: FAIL because the core modules do not exist.

- [ ] **Step 3: Implement the minimal primitives**

  Use `path.resolve`, `path.relative`, `fs.readFile`, `fs.stat`, `crypto.createHash("sha256")`, JSON schema checks for `schemaVersion: 1`, and a temporary sibling file followed by `rename` for atomic manifest writes. Reject absolute template paths and any path whose normalized relative form begins with `..`.

- [ ] **Step 4: Run the primitive tests and verify GREEN**

  Run: `npm test -- --test-name-pattern="path|manifest|template"`

  Expected: all selected tests pass.

- [ ] **Step 5: Commit the primitives**

  ```bash
  git add src/core tests/cli.test.js
  git commit -m "feat: add safe cli primitives"
  ```

### Task 3: Implement `init`

**Files:**

- Create: `src/commands/init.js`
- Modify: `src/cli.js`
- Test: `tests/cli.test.js`

**Interfaces:**

- `runInit({ target, dryRun, packageRoot, packageVersion })` returns `{ actions, manifest }`.
- The command copies absent canonical files, records only files it owns, and marks `PROJECT_PROFILE.md` with `preserve: true`.

- [ ] **Step 1: Add the first `init` assertion and verify RED**

  Assert that an empty temporary project receives `AGENTS.md`, `ENG/`, and `.mdfiles/manifest.json` with non-empty hashes.

  Run: `npm test -- --test-name-pattern="copies canonical files"`

  Expected: FAIL because the command is not implemented.

- [ ] **Step 2: Implement `runInit`**

  Iterate the canonical template list, skip existing destination files, create parent directories, write new files atomically, and serialize the manifest only after successful writes. Return human-readable action records for created and skipped files.

- [ ] **Step 3: Add and verify preservation and dry-run tests**

  Assert that a pre-existing `AGENTS.md` keeps its exact bytes and that dry-run leaves the temporary directory unchanged.

  Run: `npm test -- --test-name-pattern="init"`

  Expected: PASS for all `init` tests.

- [ ] **Step 4: Commit `init`**

  ```bash
  git add src/commands/init.js src/cli.js tests/cli.test.js
  git commit -m "feat: add safe init command"
  ```

### Task 4: Implement `doctor`

**Files:**

- Create: `src/commands/doctor.js`
- Modify: `src/cli.js`
- Test: `tests/cli.test.js`

**Interfaces:**

- `runDoctor({ target, packageRoot, json })` returns `{ ok, findings }`.
- Findings include stable `code`, `path`, `message`, and `severity` fields.

- [ ] **Step 1: Add failing doctor assertions**

  Assert that an initialized target is healthy, a missing canonical file is reported, a malformed manifest is reported, and a `PROJECT_PROFILE.md` still in template mode produces an actionable profile finding.

  Run: `npm test -- --test-name-pattern="doctor"`

  Expected: FAIL because the command is not implemented.

- [ ] **Step 2: Implement `runDoctor`**

  Validate required files, manifest JSON and hashes, tracked drift, and profile frontmatter. `--json` emits only JSON; default output uses one finding per line and a final summary. Return exit code 1 whenever an error finding exists; informational profile guidance and local drift warnings remain report-only.

- [ ] **Step 3: Run doctor tests and verify GREEN**

  Run: `npm test -- --test-name-pattern="doctor"`

  Expected: PASS with deterministic finding codes.

- [ ] **Step 4: Commit `doctor`**

  ```bash
  git add src/commands/doctor.js src/cli.js tests/cli.test.js
  git commit -m "feat: add doctor command"
  ```

### Task 5: Implement conflict-safe `update`

**Files:**

- Create: `src/commands/update.js`
- Modify: `src/cli.js`
- Test: `tests/cli.test.js`

**Interfaces:**

- `runUpdate({ target, dryRun, packageRoot, packageVersion })` returns `{ actions, conflicts, manifest }`.
- A conflict never writes the destination and causes exit code 1 after all safe files are processed.

- [ ] **Step 1: Add failing update assertions**

  Assert that an untouched managed file updates to new template bytes, a locally edited file is reported and unchanged, an absent new file is added, and `PROJECT_PROFILE.md` remains unchanged even when its source template differs.

  Run: `npm test -- --test-name-pattern="update"`

  Expected: FAIL because the command is not implemented.

- [ ] **Step 2: Implement `runUpdate`**

  Load the manifest, compare each destination hash with its recorded hash, write only safe updates, skip preserved files, add absent entries, and write the new manifest only when every write completes. Use the same dry-run action planner as `init`.

- [ ] **Step 3: Run update tests and verify GREEN**

  Run: `npm test -- --test-name-pattern="update"`

  Expected: PASS with conflict bytes preserved.

- [ ] **Step 4: Commit `update`**

  ```bash
  git add src/commands/update.js src/cli.js tests/cli.test.js
  git commit -m "feat: add conflict-safe update command"
  ```

### Task 6: Add package quality gates and user documentation

**Files:**

- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Create: `LICENSE`
- Create: `LICENSE-DOCS.md`
- Create: `.npmignore`
- Create: `.github/workflows/npm-publish.yml`
- Modify: `package.json`

**Interfaces:**

- `npm test` runs Node tests.
- `npm run pack:check` proves the package allowlist contains the CLI and all templates without local tests, caches, or worktrees.
- The README documents `npx @cassiomc1/mdfiles init`, `doctor`, `update`, the manifest behavior, Node 20+ support, and license boundaries.

- [ ] **Step 1: Add documentation and packaging assertions before edits**

  Extend the Node tests to run `npm pack --dry-run --json` and assert that `src/cli.js`, `ENG/`, and all adapters are included while `tests/`, `.worktrees/`, and `scripts/__pycache__/` are excluded.

- [ ] **Step 2: Run the packaging assertion and verify RED**

  Run: `npm run pack:check`

  Expected: FAIL until the package allowlist and workflow are complete.

- [ ] **Step 3: Implement the package quality gates**

  Add an MIT notice for CLI code, a CC BY 4.0 documentation notice that explicitly excludes separately licensed third-party material, retain attribution in `THIRD_PARTY_NOTICES.md`, exclude local files in `.npmignore`, and add a tag-triggered GitHub Actions workflow that runs tests and publishes with OIDC provenance using Node 22.14+ and npm 11.5.1+.

- [ ] **Step 4: Update README and verify package contents**

  Remove the stale private-repository wording, add the npm quickstart and safe update examples, and run:

  ```bash
  npm run pack:check
  npm test
  ```

  Expected: both commands pass and the package listing contains only intentional files.

- [ ] **Step 5: Commit package and documentation changes**

  ```bash
  git add README.md THIRD_PARTY_NOTICES.md LICENSE LICENSE-DOCS.md .npmignore .github/workflows/npm-package.yml package.json tests/cli.test.js
  git commit -m "feat: package mdfiles as public npm cli"
  ```

### Task 7: Run proportional regression and local smoke test

**Files:**
- No source changes expected; inspect the complete diff and generated package list.

- [ ] **Step 1: Run the repository validators**

  ```bash
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  python3 -m unittest discover -s tests -v
  python3 scripts/scan_secrets.py
  ```

- [ ] **Step 2: Run Node checks and package smoke test**

  ```bash
  npm test
  npm run pack:check
  smoke_dir="$(mktemp -d)"
  node src/cli.js init --path "$smoke_dir"
  node src/cli.js doctor --path "$smoke_dir"
  node src/cli.js update --path "$smoke_dir"
  ```

  Expected: all commands exit 0; the smoke target contains the manifest and canonical files.

- [ ] **Step 3: Inspect final state**

  Run `git diff --check`, `git status --short --branch`, and `git diff HEAD~4..HEAD --stat`. Confirm no secrets, caches, worktrees, or unintended files are included.

- [ ] **Step 4: Commit only if verification is green**

  If the previous task commits already contain all changes, do not create an empty commit. Otherwise stage only the files shown by the final diff and use `git commit -m "chore: verify public npm package"`.
