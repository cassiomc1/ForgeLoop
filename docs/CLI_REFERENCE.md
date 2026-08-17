# ForgeLoop CLI Reference

This document provides a complete operational reference for every ForgeLoop CLI command.

```text
Usage: forgeloop <command> [options]
```

## Common Options

<!-- BEGIN FORGELOOP GENERATED: cli-common-options -->

- `--path <directory>`: target project directory (default: current directory)
- `--help`: show this help
- `--version`: show the installed package version

Commands that support structured machine-readable output document `--json` in their command-specific option list.

<!-- END FORGELOOP GENERATED: cli-common-options -->

---

## CLI Syntax Contract

ForgeLoop uses a definition-driven command-line parser:

- **Bootstrap Options**: Before the command, only common options (`--path <directory>`, `--help`, `--version`, `-h`, `-v`) are accepted.
- **Command-Specific Options**: Available after command discovery.
- **Equals Syntax**: All value-taking long options support both `--option value` and `--option=value`.
- **String Options**: Reject empty values by default (e.g. `--path=` or `--task=""` are rejected).
- **Boolean Flags**: Never accept inline values (e.g. `--json=false` is rejected).
- **Argv Passthrough**: Everything after a command's `--` passthrough marker is preserved exactly and is not parsed as ForgeLoop syntax.

---

## Command Index by Purpose

<!-- BEGIN FORGELOOP GENERATED: cli-command-index -->

| Category | Commands |
| --- | --- |
| **Setup & Maintenance** | [`init`](#init), [`update`](#update), [`task-migrate`](#task-migrate), [`task-unlock`](#task-unlock) |
| **Inspection & Diagnostics** | [`doctor`](#doctor), [`inspect`](#inspect), [`status`](#status), [`validate-state`](#validate-state), [`validate-protocol`](#validate-protocol) |
| **Lifecycle & State** | [`activate`](#activate), [`route`](#route), [`preflight`](#preflight), [`advance`](#advance), [`next`](#next), [`complete`](#complete), [`clear-state`](#clear-state), [`task-create`](#task-create), [`task-list`](#task-list), [`task-show`](#task-show), [`task-scope`](#task-scope) |
| **Cross-Harness Continuity** | [`continuity`](#continuity), [`record-continuity`](#record-continuity), [`reconcile-continuity`](#reconcile-continuity), [`clear-continuity`](#clear-continuity) |
| **Verification & Completion** | [`prepare-completion`](#prepare-completion), [`run-check`](#run-check), [`record-check`](#record-check), [`record-terminal-result`](#record-terminal-result), [`audit`](#audit), [`report`](#report), [`validate-receipt`](#validate-receipt) |
| **Policy & Auditing** | [`policy`](#policy), [`bundle`](#bundle) |

<!-- END FORGELOOP GENERATED: cli-command-index -->

---

## 1. Setup & Maintenance

### `init`

Initializes ForgeLoop in a target repository.

- **Purpose**: Installs canonical instruction templates under `.forgeloop/kit/`, creates discovery shims at root, and prepares `.forgeloop/`.
- **When to use**: Once when onboarding a new repository to ForgeLoop.
- **Mutation**: Writes `.forgeloop/kit/`, `.forgeloop/forgeloop.gitignore`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--dry-run`: show planned writes without changing files

<!-- END FORGELOOP GENERATED: cli:init:options -->

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

<!-- BEGIN FORGELOOP GENERATED: cli:doctor:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--json`: emit doctor findings as JSON
- `--strict`: treat warnings as unhealthy
- `--fix`: restore missing managed template files
- `--adopt <path>`: preserve an existing adapter in the manifest (repeatable)

<!-- END FORGELOOP GENERATED: cli:doctor:options -->

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

<!-- BEGIN FORGELOOP GENERATED: cli:update:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--dry-run`: show planned writes without changing files

<!-- END FORGELOOP GENERATED: cli:update:options -->

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

<!-- BEGIN FORGELOOP GENERATED: cli:route:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--work <type>`: declared work type
- `--surface <value>`: affected surface (repeatable)
- `--risk <value>`: task risk (repeatable)
- `--platform <value>`: affected platform (repeatable)
- `--behavior-change`: declare behavior change
- `--executable-change`: declare executable/configuration change
- `--json`: emit route result as JSON

<!-- END FORGELOOP GENERATED: cli:route:options -->

- **Example**:

  ```bash
  forgeloop route --work complete-website --surface ui --risk untrusted-input --json
  ```

### `preflight`

Validates pre-implementation readiness and establishes protocol readiness state.

- **Purpose**: Verifies that the contract, route, profile facts, and mandatory pre-implementation gates (e.g. `design`) are satisfied and consistent.
- **When to use**: Before starting implementation.
- **Mutation**: Persists `.forgeloop/preflight.json` and, when the protocol is ready, may create or synchronize resumable work state and lifecycle events.
- **Return Status**: `READY` or `BLOCKED`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:preflight:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--strict`: require strict protocol compliance
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:preflight:options -->

- **Example**:

  ```bash
  forgeloop preflight --json
  ```

### `activate`

Creates a protocol/session activation marker for the current harness session.

- **Purpose**: Creates an activation marker containing `sessionId`, `activationMarker`, and `createdAt` for the current harness session. It does not create the canonical lifecycle work state.
- **When to use**: When starting a session after `preflight` is established.
- **Mutation**: Writes `.forgeloop/session.json`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:activate:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:activate:options -->

- **Example**:

  ```bash
  forgeloop activate --json
  ```

### `advance`

Advances the protocol lifecycle phase.

- **Purpose**: Transitions between valid protocol phases (`PLANNED`, `EXECUTING`, `VERIFYING`, `REVIEWING`).
- **When to use**: To declare transitions between workflow stages.
- **Mutation**: Updates `.forgeloop/work-state.json` and appends transition event to ledger.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:advance:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--to <phase>`: destination workflow phase
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:advance:options -->

- **Example**:

  ```bash
  forgeloop advance --to EXECUTING
  ```

### `next`

Computes the deterministic next action required by the protocol.

- **Purpose**: Tells the executing agent or harness exactly what action or command to perform next based on current state, evidence, and continuity.
- **When to use**: Continuously after each step, and upon starting any session.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:next:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:next:options -->

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
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:continuity:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:continuity:options -->

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

<!-- BEGIN FORGELOOP GENERATED: cli:record-continuity:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--focus-id <id>`: current implementation focus ID
- `--focus-summary <text>`: current implementation focus summary
- `--remaining <id:summary>`: remaining implementation item (repeatable)
- `--known-issue <id:summary>`: known implementation issue (repeatable)
- `--changed-area <path>`: changed project area (repeatable)
- `--inspect-first <path>`: suggested inspection path (repeatable)
- `--resume-note <text>`: bounded operational resume note
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:record-continuity:options -->

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

- **Purpose**: Compares continuity bindings against the canonical work state, contract, phase, repository fingerprint, and checkout state.
- **When to use**: When starting a session in an active task.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:reconcile-continuity:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:reconcile-continuity:options -->

- **Example**:

  ```bash
  forgeloop reconcile-continuity --json
  ```

### `clear-continuity`

Clears operational continuity context while preserving canonical work state.

- **Purpose**: Removes stale or corrupt continuity handoff data when starting fresh from the last work-state checkpoint.
- **When to use**: When continuity is unrecoverably stale or no longer relevant.
- **Mutation**: Removes `.forgeloop/continuity.json`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:clear-continuity:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:clear-continuity:options -->

- **Example**:

  ```bash
  forgeloop clear-continuity
  ```

---

## 4. Verification

### `run-check`

Executes a verification command with ForgeLoop-attested provenance.

- **Purpose**: Runs an exact command, records the execution artifact in `.forgeloop/executions/`, and binds the resulting observed check evidence to that execution through `executionRef`.
- **When to use**: During `VERIFYING` phase to execute test suites, linters, or validators.
- **Mutation**: Writes `.forgeloop/executions/exec-*.json`, updates `.forgeloop/execution-receipt.json`, appends to ledger.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:run-check:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--id <id>`: stable check identifier
- `--requirement <id>`: completion requirement covered by the check
- `--details <json>`: additional structured check details
- `-- <argv...>`: exact command argv to classify, execute, and attest
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:run-check:options -->

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

<!-- BEGIN FORGELOOP GENERATED: cli:record-check:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--id <id>`: stable check identifier
- `--requirement <id>`: completion requirement covered by the check
- `--kind <kind>`: check kind (default: command; use manual-review for manual evidence)
- `--status <status>`: passed, failed, blocked, or not-run
- `--evidence-kind <kind>`: OBSERVED, INFERRED, NOT_VERIFIED, or BLOCKED
- `--command <text>`: recorded only as metadata; it is never executed
- `--result <text>`: observed result supplied by the actor
- `--exit-code <number>`: observed process exit code
- `--execution-ref <id>`: ForgeLoop execution artifact reference
- `--provenance <value>`: FORGELOOP_EXECUTED, ACTOR_REPORTED, or MANUAL_OBSERVATION
- `--details <json>`: additional structured check details
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:record-check:options -->

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
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:validate-state:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:validate-state:options -->

- **Example**:

  ```bash
  forgeloop validate-state --json
  ```

### `validate-receipt`

Validates `.forgeloop/execution-receipt.json` schema and check references.

- **Purpose**: Integrity check for completion receipt.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:validate-receipt:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--file <path>`: receipt file relative to target
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:validate-receipt:options -->

- **Example**:

  ```bash
  forgeloop validate-receipt --json
  ```

### `validate-protocol`

Performs comprehensive protocol validation across all active artifacts.

- **Purpose**: Validates contract, route, state, receipt, executions, and event ledger freshness and consistency.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:validate-protocol:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--contract-file <path>`: current JSON contract used for freshness comparison
- `--route-file <path>`: routing-result JSON relative to target
- `--state-file <path>`: work-state JSON relative to target
- `--receipt-file <path>`: execution-receipt JSON relative to target
- `--continuity-file <path>`: optional execution-continuity JSON relative to target
- `--task-brief-file <path>`: task brief JSON file (repeatable)
- `--delegated-result-file <path>`: delegated result JSON file (repeatable)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:validate-protocol:options -->

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
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:prepare-completion:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:prepare-completion:options -->

- **Example**:

  ```bash
  forgeloop prepare-completion --json
  ```

### `record-terminal-result`

Records external publication or production-readiness observations.

- **Purpose**: Records evidence for terminal requirements (e.g. git push, npm publish, staging deploy).
- **When to use**: When the contract contains explicit publication or production-readiness requirements.
- **Mutation**: Updates work state and receipt with terminal status.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:record-terminal-result:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--requirement <id>`: terminal requirement covered by the result
- `--type <type>`: PUBLICATION or PRODUCTION_READINESS
- `--status <status>`: observed terminal status
- `--source <text>`: external action source (e.g. npm publish, git push)
- `--result <text>`: observed external result description
- `--details <json>`: additional structured result details
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:record-terminal-result:options -->

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
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:audit:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--strict`: require strict protocol compliance
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:audit:options -->

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
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:complete:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--strict`: require strict protocol compliance
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:complete:options -->

- **Example**:

  ```bash
  forgeloop complete --json
  ```

### `report`

Emits an independent multi-dimensional status report.

- **Purpose**: Reports task completion, publication status, and production readiness as independent dimensions.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:report:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--strict`: require strict protocol compliance
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:report:options -->

- **Example**:

  ```bash
  forgeloop report --json
  ```

### `bundle`

Exports a portable, self-contained task bundle.

- **Purpose**: Bundles contract, route, state, receipt, executions, and ledger for archiving or cross-environment migration.
- **Mutation**: Writes portable bundle under `.forgeloop/tasks/<taskId>`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:bundle:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:bundle:options -->

- **Example**:

  ```bash
  forgeloop bundle --task task-001 --json
  ```

---

## 6. Inspection & Recovery

### `status`

Displays human-readable or structured summary of current task state.

- **Purpose**: Quick overview of task ID, phase, cycle, active guides, and completion status.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:status:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--contract-file <path>`: current JSON contract used for freshness comparison
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:status:options -->

- **Example**:

  ```bash
  forgeloop status --json
  ```

### `inspect`

Inspects checkout changes and compares them against contract deliverables.

- **Purpose**: Shows modified files, untracked files, and deliverable coverage.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:inspect:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--contract-file <path>`: current JSON contract used for freshness comparison
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:inspect:options -->

- **Example**:

  ```bash
  forgeloop inspect --json
  ```

### `policy`

Evaluates compliance against a named policy pack.

- **Purpose**: Checks repository conformity against organizational or protocol policy packs.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:policy:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `<name>`: policy pack name
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:policy:options -->

- **Example**:

  ```bash
  forgeloop policy default --json
  ```

### `clear-state`

Clears canonical work-state checkpoint for the current task.

- **Purpose**: Emergency reset of local work-state checkpoint.
- **When to use**: Only when abandoning a task or resetting state after an unrecoverable corruption.
- **Mutation**: Removes `.forgeloop/work-state.json` only. Sibling ForgeLoop artifacts (such as contracts, routes, gates, and ledger history) are preserved.
- **Safety Note**: This is not a full `.forgeloop/` reset command.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:clear-state:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:clear-state:options -->

- **Example**:

  ```bash
  forgeloop clear-state
  ```

---

## 7. Multi-Task Management

### `task-create`

Initializes a new isolated task namespace with write claims and contract.

- **Purpose**: Creates `.forgeloop/task-state/<taskKey>/task.json` descriptor.
- **Mutation**: Writes task descriptor.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-create:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--claim <path>`: scoped file path or directory prefix claimed for mutation (repeatable)
- `--contract-file <path>`: path to initial contract file
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-create:options -->

- **Example**:

  ```bash
  forgeloop task-create --id task-001 --claim src/auth --prompt "Add auth module" --json
  ```

### `task-list`

Lists all tasks discovered in `.forgeloop/task-state/`.

- **Purpose**: Discovers tasks, their keys, phases, write claims, and lock status.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-list:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-list:options -->

- **Example**:

  ```bash
  forgeloop task-list --json
  ```

### `task-show`

Displays details of a specific task by ID or storage key.

- **Purpose**: Inspects task descriptor, write claims, active lock, and lifecycle state.
- **Mutation**: Read-only.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-show:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-show:options -->

- **Example**:

  ```bash
  forgeloop task-show --task task-001 --json
  ```

### `task-scope`

Updates or inspects write claims for a task.

- **Purpose**: Modifies write claims before execution starts.
- **Mutation**: Updates `task.json`.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-scope:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--claim <path>`: scoped file path or directory prefix claimed for mutation (repeatable)
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-scope:options -->

- **Example**:

  ```bash
  forgeloop task-scope --task task-001 --claim src/auth tests/auth --json
  ```

### `task-migrate`

Migrates a legacy 1.0 single-task `.forgeloop/` layout into a namespaced task directory.

- **Purpose**: Converts root `.forgeloop/` artifacts into `.forgeloop/task-state/<taskKey>/`.
- **Mutation**: Moves task artifacts into task state subfolder.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-migrate:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--dry-run`: show planned migration actions without moving files
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-migrate:options -->

- **Example**:

  ```bash
  forgeloop task-migrate --json
  ```

### `task-unlock`

Forces the release of a stale task lock.

- **Purpose**: Removes `.lock` file from the task directory when process crashed.
- **Mutation**: Deletes task lock file.
- **Options**:

<!-- BEGIN FORGELOOP GENERATED: cli:task-unlock:options -->

- `--path <directory>`: target project directory (default: current directory)
- `--task <id>`: task ID to operate on (when omitted, resolved from context or single active task)
- `--force`: force release of an orphaned task lock
- `--json`: emit structured output as JSON

<!-- END FORGELOOP GENERATED: cli:task-unlock:options -->

- **Example**:

  ```bash
  forgeloop task-unlock --task task-001 --force --json
  ```
