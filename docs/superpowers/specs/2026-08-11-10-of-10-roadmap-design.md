# mdfiles 10/10 roadmap design

## Status

Approved design for implementing all phases of `MDFILES_10_OF_10_ROADMAP.md`.

## Objective

Evolve `mdfiles` into a portable, verifiable engineering protocol for AI
coding agents. The repository must gain deterministic routing, structured
evidence, resumable local state, and framework-neutral delegation contracts
without becoming an LLM runtime or an orchestration framework.

The implementation is complete only when the seven roadmap phases have a
documented contract, machine-readable representation where applicable,
positive and negative validation, backward-compatibility behavior, and
proportional cross-platform evidence.

## Scope and boundaries

The work includes:

- measurable quality criteria, terminology, failure taxonomy, retry rules, and
  loop invariants;
- deterministic routing from declared signals to stable guide sets and reason
  codes;
- `inspect`, explainable findings, and structured execution receipts;
- atomic `.mdfiles/work-state.json` checkpoints with stale-state detection,
  status, validation, and safe clearing;
- framework-neutral delegation briefs, ownership, dependencies, reviewer
  independence, and sequential fallback rules;
- protocol schemas, versions, compatibility policy, security threat model,
  fixtures, validators, and CI portability coverage;
- canonical workflow states, transition semantics, graph-readiness guidance,
  scorecard, glossary, and maintained documentation.

The work explicitly excludes:

- `mdfiles run`, `mdfiles execute`, `mdfiles agent`, or
  `mdfiles orchestrate`;
- LLM/provider/scheduler/database/remote-service dependencies;
- automatic execution of commands found in project profile data;
- telemetry, hidden prompts, chain-of-thought, credentials, or secrets in
  protocol artifacts;
- unrelated documentation or repository cleanup.

## Design principles

1. Markdown remains the human-readable source of operational meaning.
2. JSON and JSON Schema encode only stable, serializable contracts.
3. Existing `init`, `doctor`, and `update` behavior remains compatible unless a
   documented safety correction requires an explicit error.
4. New commands are read-only by default except for explicitly scoped local
   state operations.
5. The CLI validates and explains; the compatible agent performs the task.
6. A result is never considered complete without current evidence.
7. A retry requires new evidence or a changed hypothesis.
8. All local writes are path-safe, secret-free, and atomic where state could be
   partially observed.
9. Stable output uses canonical ordering and reason codes, not private
   reasoning.
10. Features are delivered in dependency order and each phase has targeted and
    regression checks before the next phase is started.

## Architecture

The implementation adds protocol support around the existing template and
manifest model:

```text
declared agent signals
        |
        v
src/core/router.js -----------------------> route result + reasons
        |
        +--> schemas and protocol versions
        +--> src/core/receipts.js ---------> execution receipt validation
        +--> src/core/work-state.js --------> atomic checkpoint/status
        +--> src/core/delegation.js --------> task brief/result contracts
        |
        v
CLI commands: route, inspect, status, validate-state, clear-state
```

The current manifest remains the ownership record for installed templates and
adapters. Work state is separate local task data under `.mdfiles`, is ignored
by Git, and is never treated as a manifest entry. The profile remains a
durable facts template and never becomes a task log.

## Protocol contracts

The first protocol version is `1`. It is independent of the npm package
version. Every structured artifact carries its applicable schema/version field.

### Routing

Routing input contains a declared `workType`, optional `surfaces`, `risks`,
`platforms`, and executable-change signals. The evaluator rejects unknown
signals, duplicate values, contradictory values, and malformed arrays. It
returns a stable guide list with one or more reason codes for each selected
guide. The evaluator never parses natural language and never calls a model.

Precedence is deterministic:

1. explicit supported work type establishes the primary guide;
2. affected surface adds mandatory complements;
3. risk signals add security/performance/accessibility requirements;
4. executable configuration and behavior changes add clean/test;
5. exclusions suppress only optional inferences, never a direct safety
   requirement;
6. required rules win over optional rules;
7. canonical catalog order resolves output ordering.

The command supports human output and `--json`. JSON output contains the
protocol version, selected guides, reason codes, and normalized input. It has
no duplicate guides and no unstable timestamps.

### Workflow state

Canonical phases are:

`RECEIVED`, `DISCOVERING`, `CONTRACT_READY`, `ROUTED`, `DESIGNING`, `PLANNED`,
`EXECUTING`, `VERIFYING`, `DIAGNOSING`, `CORRECTING`, `REVIEWING`, `COMPLETE`,
and `BLOCKED`.

States may skip proportional phases, but transitions into `COMPLETE` require
verification evidence and transitions into `BLOCKED` require a blocker
category. `CORRECTING` requires a diagnosed hypothesis. `REVIEWING` cannot
claim independent review when the reviewer and implementer identities match.

The work-state record contains schema version, task ID, contract fingerprint,
repository fingerprint, phase, selected guides, completed/pending steps,
checks, failures, blockers, and update time. Input is untrusted on read:
unknown fields may be ignored only where the schema permits them, enum values
and string limits are validated, and secret-like values are rejected.

### Receipts

An execution receipt contains task identity, contract fingerprint, selected
guides, changed paths, checks and their results, review status, limitations,
and explicit publication state. Publication fields default to false/null and
cannot be inferred from a passing local check. Receipts do not contain private
reasoning, prompts, credentials, or raw sensitive data.

### Delegation

A task brief contains parent/task IDs, objective, allowed and read-only paths,
dependencies, constraints, required guides, verification, authority, and
deliverables. Overlapping write ownership and dependency cycles are rejected
or explicitly flagged. Delegated results normalize to status, changes,
verification, open findings, and limitations. When the host has no subagents,
the same brief is executed sequentially by the current agent.

## CLI behavior

Existing commands retain their current target and safety rules:

- `init` creates missing managed files and refuses an existing manifest;
- `update` preserves local modifications and the project profile;
- `doctor` reports manifest/template/adaptor health and supports structured
  findings in JSON mode.

New commands are:

- `mdfiles route` — evaluate declared signals; no filesystem mutation;
- `mdfiles inspect` — summarize target, manifest, profile, adapters, protocol,
  state, and compatibility; no mutation;
- `mdfiles status` — inspect local work state and stale/revalidation status;
- `mdfiles validate-state` — validate the work-state file and transition
  semantics; no mutation;
- `mdfiles clear-state` — remove only `.mdfiles/work-state.json` after showing
  the exact target; this is the sole new destructive local operation.

All new commands support `--path` and, where structured output is useful,
`--json`. Unsupported flag combinations fail before filesystem access.

## Failure and recovery behavior

The taxonomy is stable and covers contract, discovery, routing,
implementation, verification, regression, review, capability, authority,
environment, external-service, and stale-state failures. Each class defines
whether retry is allowed, what evidence must change, and when to escalate or
block. Identical evidence and hypothesis cannot create an immediate retry.

State recovery rules are conservative:

- atomic writes use a validated temporary file followed by rename;
- truncated or invalid state is reported and never silently resumed;
- branch, HEAD, contract, or protocol changes require revalidation;
- completed destructive or publication actions are never rerun automatically;
- stale checkpoints can be inspected and cleared without deleting project
  files.

## Security and portability

The threat model covers path traversal, symlink escape, manifest tampering,
untrusted Markdown/profile/state, command injection, credential leakage,
unsafe update overwrite, dependency supply chain, and stale-state replay.
Existing realpath containment and manifest protections remain mandatory for all
new paths. No profile or state command is executed automatically.

Core runtime code uses Node built-ins only. Schemas are validated by a small
internal validator rather than adding a mandatory consumer dependency. Tests
cover Linux, macOS, and Windows CI smoke paths, including spaces, Unicode,
backslashes, CRLF, nested targets, and platform-specific state handling.

## Verification strategy

Each phase adds targeted tests before broader checks:

1. Python structural validator and Node tests for scorecard, taxonomy,
   versions, and semantic invariants;
2. route unit/CLI tests with positive, negative, exclusion, conflict, and
   deterministic-order fixtures;
3. inspect/doctor/receipt schema tests and secret rejection;
4. state tests for valid, truncated, stale, changed-contract, unknown-version,
   atomic-recovery, and clear-state boundaries;
5. delegation tests for ownership overlap, dependency cycles, reviewer
   identity, and sequential fallback;
6. cross-platform path and CRLF fixtures plus CI matrix checks;
7. documentation and graph-readiness conformance checks.

The final regression gate includes npm tests, package-content checks, Python
unit tests, Markdown and loop self-tests/validators, secret scanning, and
`git diff --check`. External publication and remote checks remain separate
from local completion.

## Compatibility and release policy

Patch releases do not break protocol contracts. Minor releases may add
optional fields and enum values only when old consumers can continue to read
the artifact. Major releases may make breaking changes and must include
migration/rejection guidance. Persisted state is never silently reinterpreted.

The package file list must include new runtime modules, schemas, and canonical
protocol documents while excluding local work state and internal planning
records from the consumer tarball unless explicitly required.

## Completion criteria

The roadmap is complete when:

- all seven phases exist in the repository and are represented by tests;
- no prohibited runtime directories or dependencies were introduced;
- current init/update/doctor safety contracts remain green;
- every structured artifact has a version and validation boundary;
- route, inspect, status, validate-state, and clear-state behavior is
  documented and tested;
- local state and receipts are secret-free and publication state is explicit;
- Linux/macOS/Windows compatibility evidence is present in CI configuration;
- the final report distinguishes observed checks, limitations, and publication
  state.
