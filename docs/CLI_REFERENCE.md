# ForgeLoop CLI Reference

This document provides a complete operational reference for every ForgeLoop CLI command.

```text
Usage: forgeloop <command> [options]
```

Global options:
- `--path <directory>`: Target project directory (default: current directory).
- `--json`: Output structured JSON for automation and tool integrations.
- `--help`: Show CLI help and usage information.
- `--version`: Show the installed package version.

---

## Command Index by Purpose

| Category | Commands |
|---|---|
| **Setup & Maintenance** | [`init`](#init), [`doctor`](#doctor), [`update`](#update) |
| **Activation & Planning** | [`route`](#route), [`preflight`](#preflight), [`activate`](#activate), [`advance`](#advance), [`next`](#next) |
| **Continuity & Handoff** | [`continuity`](#continuity), [`record-continuity`](#record-continuity), [`reconcile-continuity`](#reconcile-continuity), [`clear-continuity`](#clear-continuity) |
| **Verification** | [`run-check`](#run-check), [`record-check`](#record-check), [`validate-state`](#validate-state), [`validate-receipt`](#validate-receipt), [`validate-protocol`](#validate-protocol) |
| **Completion & Reporting** | [`prepare-completion`](#prepare-completion), [`record-terminal-result`](#record-terminal-result), [`audit`](#audit), [`complete`](#complete), [`report`](#report), [`bundle`](#bundle) |
| **Inspection & Recovery** | [`status`](#status), [`inspect`](#inspect), [`policy`](#policy), [`clear-state`](#clear-state) |

---

## 1. Setup & Maintenance

### `init`
Initializes ForgeLoop in a target repository.

- **Purpose**: Installs canonical instruction templates under `.forgeloop/kit/`, creates discovery shims at root, and prepares `.forgeloop/`.
- **When to use**: Once when onboarding a new repository to ForgeLoop.
- **Mutation**: Writes `.forgeloop/kit/`, `.forgeloop/forgeloop.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`.
- **Options**:
  - `--adopt <path>`: Adopt an existing custom adapter path into the manifest.
  - `--dry-run`: Show planned writes without modifying files.
- **Example**:
  ```bash
  forgeloop init
  ```

### `doctor`
Inspects repository health, adapter synchronization, and template integrity.

- **Purpose**: Diagnose missing files, unmanaged adapters, profile issues, and broken kit references.
- **When to use**: After initialization, after git merges, or when troubleshooting.
- **Mutation**: Read-only (unless `--fix` is passed).
- **Options**:
  - `--fix`: Automatically restore missing managed template files.
  - `--strict`: Treat warnings as unhealthy errors.
  - `--json`: Output findings as structured JSON.
- **Example**:
  ```bash
  forgeloop doctor --json
  ```

### `update`
Updates the managed instruction kit to match the current ForgeLoop package version.

- **Purpose**: Safely updates `.forgeloop/kit/` while preserving project profile facts and local modifications.
- **When to use**: After upgrading `@cassiomc1/forgeloop` package version.
- **Mutation**: Updates `.forgeloop/kit/` and adapter shims.
- **Options**:
  - `--dry-run`: Preview changes without writing.
- **Example**:
  ```bash
  forgeloop update
  ```

---

## 2. Activation & Planning

### `route`
Calculates and persists deterministic engineering guide routing.

- **Purpose**: Selects relevant technical guides (e.g. `clean`, `test`, `security`, `design`) based on declared work attributes.
- **When to use**: During discovery before preflight.
- **Mutation**: Writes `.forgeloop/routing-result.json`.
- **Options**:
  - `--work <type>`: Declared work type (e.g. `complete-website`, `api`, `refactor`, `documentation`).
  - `--surface <name>`: Affected surface (repeatable: `ui`, `forms`, `api`, `auth`, `data`, `mobile`, `ci`).
  - `--risk <name>`: Task risk (repeatable: `untrusted-input`, `personal-data`, `secrets`, `publication`).
  - `--platform <name>`: Target platform (`web`, `mobile`, `desktop`, `server`, `ci`).
  - `--behavior-change`: Declares behavioral changes to code.
  - `--executable-change`: Declares configuration or executable changes.
- **Example**:
  ```bash
  forgeloop route --work complete-website --surface ui --risk untrusted-input --json
  ```

### `preflight`
Validates pre-implementation readiness.

- **Purpose**: Verifies that the contract, route, and mandatory pre-implementation gates (e.g. `design`) are satisfied and consistent.
- **When to use**: Before starting implementation.
- **Mutation**: Read-only (validates contract and gate files).
- **Return Status**: `READY` or `BLOCKED`.
- **Example**:
  ```bash
  forgeloop preflight --json
  ```

### `activate`
Initializes active work state and begins protocol event logging.

- **Purpose**: Creates the initial `.forgeloop/work-state.json` and begins the hash-chained `.forgeloop/events.ndjson` ledger.
- **When to use**: After `preflight` returns `READY`.
- **Mutation**: Writes `.forgeloop/work-state.json` and appends to `.forgeloop/events.ndjson`.
- **Example**:
  ```bash
  forgeloop activate --json
  ```

### `advance`
Advances the protocol lifecycle phase.

- **Purpose**: Transitions between valid protocol phases (`PLANNED`, `EXECUTING`, `VERIFYING`, `REVIEWING`).
- **When to use**: To declare transitions between workflow stages.
- **Mutation**: Updates `.forgeloop/work-state.json` and appends transition event.
- **Options**:
  - `--to <phase>`: Target phase (`PLANNED`, `EXECUTING`, `VERIFYING`, `REVIEWING`).
- **Example**:
  ```bash
  forgeloop advance --to EXECUTING
  ```

### `next`
Computes the deterministic next action required by the protocol.

- **Purpose**: Tells the executing agent or harness exactly what action or command to perform next based on current state, evidence, and continuity.
- **When to use**: Continuously after each step, and upon starting any session.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop next --json
  ```

---

## 3. Continuity & Handoff

### `continuity`
Reads current operational continuity context.

- **Purpose**: Retrieves the active focus, remaining items, known issues, and inspect-first notes recorded by the previous harness.
- **When to use**: When resuming an existing task.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop continuity --json
  ```

### `record-continuity`
Records operational handoff context before pausing or switching tools.

- **Purpose**: Stores immediate work-in-progress notes to help the next harness continue without confusion.
- **When to use**: Before ending a session or transferring control.
- **Mutation**: Writes `.forgeloop/continuity.json`.
- **Options**:
  - `--focus-id <id>`: Current focus identifier.
  - `--focus-summary <text>`: Description of active work.
  - `--remaining <id:summary>`: Remaining work items (repeatable).
  - `--known-issue <id:summary>`: Discovered issues (repeatable).
  - `--changed-area <path>`: Modified directories (repeatable).
  - `--inspect-first <path>`: Suggested starting file (repeatable).
  - `--resume-note <text>`: Operational resume note.
- **Example**:
  ```bash
  forgeloop record-continuity \
    --focus-id auth-jwt \
    --focus-summary "Implement JWT refresh token rotation" \
    --remaining "tests:Add token expiration test" \
    --inspect-first src/auth/token.js \
    --resume-note "Access tokens are working; refresh token rotation is in progress."
  ```

### `reconcile-continuity`
Reconciles continuity with the active work state and checkout.

- **Purpose**: Validates that continuity matches the current work state fingerprint and identifies any checkout drift.
- **When to use**: When starting a session in an active task.
- **Mutation**: Updates continuity reconciliation status.
- **Example**:
  ```bash
  forgeloop reconcile-continuity --json
  ```

### `clear-continuity`
Clears operational continuity context while preserving canonical work state.

- **Purpose**: Removes stale or corrupt continuity handoff data when starting fresh from the last work-state checkpoint.
- **When to use**: When continuity is unrecoverably stale or no longer relevant.
- **Mutation**: Removes `.forgeloop/continuity.json`.
- **Example**:
  ```bash
  forgeloop clear-continuity
  ```

---

## 4. Verification

### `run-check`
Executes a verification command with ForgeLoop-attested provenance.

- **Purpose**: Runs an exact command line, captures exit code and output, stores execution provenance in `.forgeloop/executions/`, and records check evidence.
- **When to use**: During `VERIFYING` phase to execute test suites, linters, or validators.
- **Mutation**: Writes `.forgeloop/executions/exec-*.json`, updates `.forgeloop/execution-receipt.json`, appends to ledger.
- **Options**:
  - `--id <id>`: Stable check identifier.
  - `--requirement <id>`: Contract completion requirement covered.
  - `-- <argv...>`: Exact command line to execute.
- **Example**:
  ```bash
  forgeloop run-check --id unit-tests --requirement "All unit tests pass" -- npm test
  ```

### `record-check`
Records an observed or manual verification check result without executing commands.

- **Purpose**: Records manual review evidence or external observations.
- **When to use**: For manual reviews, accessibility inspections, or external validations.
- **Mutation**: Updates `.forgeloop/execution-receipt.json` and appends to ledger.
- **Options**:
  - `--id <id>`: Stable check identifier.
  - `--requirement <id>`: Requirement covered.
  - `--status <status>`: `passed`, `failed`, `blocked`, or `not-run`.
  - `--kind <kind>`: Check kind (`manual-review`, `command`, etc.).
  - `--evidence-kind <kind>`: `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, or `BLOCKED`.
  - `--result <text>`: Description of the observed result.
- **Example**:
  ```bash
  forgeloop record-check \
    --id manual-a11y-review \
    --requirement "WCAG AA contrast compliant" \
    --status passed \
    --kind manual-review \
    --evidence-kind OBSERVED \
    --result "Verified contrast ratios exceed 4.5:1 across all color schemes"
  ```

### `validate-state`
Validates `.forgeloop/work-state.json` structure, hash chain, and repository binding.

- **Purpose**: Integrity check for work state.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop validate-state --json
  ```

### `validate-receipt`
Validates `.forgeloop/execution-receipt.json` schema and check references.

- **Purpose**: Integrity check for completion receipt.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop validate-receipt --json
  ```

### `validate-protocol`
Performs comprehensive protocol validation across all active artifacts.

- **Purpose**: Validates contract, route, state, receipt, executions, and event ledger freshness and consistency.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop validate-protocol --json
  ```

---

## 5. Completion & Reporting

### `prepare-completion`
Initializes or refreshes `.forgeloop/execution-receipt.json`.

- **Purpose**: Maps contract requirements to evidence coverage slots.
- **When to use**: Upon entering the `VERIFYING` phase before recording checks.
- **Mutation**: Writes `.forgeloop/execution-receipt.json`.
- **Example**:
  ```bash
  forgeloop prepare-completion --json
  ```

### `record-terminal-result`
Records external publication or production-readiness observations.

- **Purpose**: Records evidence for terminal requirements (e.g. git push, npm publish, staging deploy).
- **When to use**: When the contract contains explicit publication or production-readiness requirements.
- **Options**:
  - `--requirement <id>`: Terminal requirement ID.
  - `--type <type>`: `PUBLICATION` or `PRODUCTION_READINESS`.
  - `--status <status>`: `passed`, `failed`, or `blocked`.
  - `--source <text>`: Source of external action (e.g. `npm publish`).
  - `--result <text>`: Description of the observed outcome.
- **Example**:
  ```bash
  forgeloop record-terminal-result \
    --requirement release-publish \
    --type PUBLICATION \
    --status passed \
    --source "npm publish" \
    --result "v1.1.0 published to registry"
  ```

### `audit`
Performs a read-only dry-run evaluation of completion readiness.

- **Purpose**: Checks if all requirements are covered, ledger is valid, and fingerprints are fresh without changing lifecycle phase.
- **When to use**: In `REVIEWING` phase before running `complete`.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop audit --json
  ```

### `complete`
Validates protocol completion and transitions the task to `COMPLETE`.

- **Purpose**: Authoritative protocol validation of the entire task lifecycle.
- **When to use**: In `REVIEWING` phase when all checks have passed.
- **Mutation**: Updates `.forgeloop/work-state.json` to `COMPLETE` and records completion event.
- **Return Status**: `VALID`, `INCOMPLETE`, `STALE`, `INCONSISTENT`, or `INVALID`.
- **Example**:
  ```bash
  forgeloop complete --json
  ```

### `report`
Emits an independent multi-dimensional status report.

- **Purpose**: Reports task completion, publication status, and production readiness as independent dimensions.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop report --json
  ```

### `bundle`
Exports a portable, self-contained task bundle.

- **Purpose**: Bundles contract, route, state, receipt, executions, and ledger for archiving or cross-environment migration.
- **Options**:
  - `--task <id>`: Task ID to export.
- **Example**:
  ```bash
  forgeloop bundle --json
  ```

---

## 6. Inspection & Recovery

### `status`
Displays human-readable or structured summary of current task state.

- **Purpose**: Quick overview of task ID, phase, cycle, active guides, and completion status.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop status --json
  ```

### `inspect`
Inspects checkout changes and compares them against contract deliverables.

- **Purpose**: Shows modified files, untracked files, and deliverable coverage.
- **Mutation**: Read-only.
- **Example**:
  ```bash
  forgeloop inspect --json
  ```

### `policy`
Evaluates compliance against a named policy pack.

- **Purpose**: Checks repository conformity against organizational or protocol policy packs.
- **Example**:
  ```bash
  forgeloop policy --json
  ```

### `clear-state`
Clears mutable `.forgeloop/` state for the current task.

- **Purpose**: Emergency reset of local task state when starting a completely new task.
- **When to use**: Only when abandoning a task or resetting state after an unrecoverable corruption.
- **Mutation**: Deletes active task artifacts under `.forgeloop/`.
- **Example**:
  ```bash
  forgeloop clear-state
  ```
