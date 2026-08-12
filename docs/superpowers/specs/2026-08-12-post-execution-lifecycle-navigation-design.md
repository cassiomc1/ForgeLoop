# Post-Execution Lifecycle Navigation Design

**Date:** 2026-08-12

**Status:** Approved for implementation

## Objective

Add deterministic, read-only lifecycle guidance so a compatible agent can query
the next legal ForgeLoop action after implementation instead of relying on
memory. The change must address the observed `EXECUTING` → `VERIFYING` stall
without weakening completion validation or turning ForgeLoop into an
orchestrator.

## Scope and constraints

- Add the `forgeloop next` command and its `--json` representation.
- Derive all decisions from persisted protocol artifacts and validated state.
- Keep the command read-only: it must not run project commands, mutate files,
  invoke an agent, schedule work, publish, or deploy.
- Preserve protocol version 1, the existing phases, transitions, routing,
  gates, preflight, evidence, receipt, checkpoint, security, and completion
  semantics.
- Reuse `advance --to VERIFYING` as the canonical mutation. Do not add a
  redundant step-completion command.
- When the legal `EXECUTING` → `VERIFYING` transition occurs, reconcile the
  implementation step in `completedSteps`/`pendingSteps`; this records the
  explicit lifecycle boundary and does not claim verification.
- Stale or inconsistent artifacts must produce repair/blocker guidance rather
  than unsafe forward progress.
- Adapter instructions should contain one concise boundary rule and delegate
  the detailed decision policy to `LOOP_ENGINEERING.md`.

## Selected guides

- `clean`: new CLI/core modules, stable interfaces, and safe repair errors.
- `test`: behavior changes, phase matrix, regression fixture, and read-only
  guarantees.
- `security`: untrusted persisted JSON is read through existing bounded,
  schema-validating artifact APIs and the command must not execute data.

## Architecture

### Next-action decision module

Create `src/core/next-action.js` as the single decision boundary. It will
export stable action identifiers and a read-only function that loads the
current work state plus the relevant contract, route, preflight, event ledger,
checks, and receipt artifacts. It returns a versioned JSON-safe object with:

- `schemaVersion` and `protocolVersion`;
- `taskId` and `currentPhase`;
- stable `nextAction`;
- `terminal`;
- deterministic `reasonCodes` and human-readable `reasons`;
- actionable existing CLI `commands` where a canonical command exists;
- `requiredArtifacts` and `missingArtifacts`.

The module will distinguish missing initial state from invalid/stale state,
will reuse existing validator error codes where applicable, and will never
infer progress from source files, timestamps, agent prose, or completion
claims.

### CLI boundary

Create `src/commands/next.js` for human formatting and expose it through
`src/cli.js`. `forgeloop next` prints a concise `FORGELOOP NEXT:` heading and
the next guidance. `forgeloop next --json` prints deterministic JSON. Both
paths call the same core decision function.

### Lifecycle mapping

The decision table is:

| Current phase/state | Next action |
| --- | --- |
| no checkpoint / `RECEIVED` | `DISCOVER` |
| `DISCOVERING` | `CREATE_CONTRACT` |
| `CONTRACT_READY` | `ROUTE` |
| `ROUTED` with missing required gates | `SATISFY_GATES` |
| `ROUTED` with gates ready | `RUN_PREFLIGHT` or the legal planning transition |
| `DESIGNING` | `SATISFY_GATES` or `PLAN` according to gate state |
| `PLANNED` with no READY preflight | `RUN_PREFLIGHT` |
| `PLANNED` with READY preflight | `START_EXECUTION` |
| `EXECUTING` with valid READY prerequisites | `ENTER_VERIFYING` |
| `VERIFYING` with no complete observed evidence | `RECORD_VERIFICATION` |
| `VERIFYING` with failed observed checks | `DIAGNOSE` |
| `VERIFYING` with sufficient valid coverage | `ENTER_REVIEWING` |
| `DIAGNOSING` | `CORRECT` |
| `CORRECTING` | `ENTER_VERIFYING` |
| `REVIEWING` without a valid receipt | `PREPARE_COMPLETION` |
| `REVIEWING` with a valid receipt | `RUN_COMPLETE` |
| `COMPLETE` | `NONE`, terminal |
| `BLOCKED` or unsafe inconsistent state | `RESOLVE_BLOCKER` |

The implementation will not recommend `RUN_COMPLETE` when verification
coverage is missing, even if a malformed or premature `REVIEWING` state is
present.

## Implementation-boundary reconciliation

`advanceWorkState` remains the only phase mutation. On the legal transition
from `EXECUTING` to `VERIFYING`, it will move the `implementation` step from
`pendingSteps` to `completedSteps` if present, without changing evidence or
claiming that checks ran. Existing callers that already marked the step
complete remain idempotent.

## Adapter and documentation changes

Add the concise rule to the shipped native entry points:

> After implementation work for the current task is complete, run `forgeloop
> next` before returning a final result. Follow the returned lifecycle action
> until ForgeLoop reaches a terminal state or an explicit blocker.

Add the broader ACT → QUERY NEXT → ACT guidance to the canonical
`LOOP_ENGINEERING.md`, then document the command and lifecycle interaction in
`README.md` and `conformance/README.md`. Add separate scorecard evidence for
agent lifecycle navigation and execution-to-verification handoff. No new
runtime, scheduler, watchdog, graph executor, phase, or evidence type will be
introduced.

## Testing strategy

Add `tests/next-action.test.js` with:

- every phase-to-action mapping;
- missing/failed/sufficient verification evidence decisions;
- valid and missing/invalid receipts;
- exact third-run regression state (`EXECUTING`, implementation present,
  preflight ready, no verification or receipt) mapping to `ENTER_VERIFYING`;
- stale route, missing preflight, and premature review safety cases;
- deterministic JSON output and proof that `next` does not write artifacts.

Extend lifecycle/CLI coverage to prove `advance --to VERIFYING` reconciles
implementation steps and emits no verification claim beyond the existing
`VERIFICATION_STARTED` event.

## Acceptance criteria

- `forgeloop next` and `forgeloop next --json` are available in the CLI.
- JSON action identifiers and reason codes are stable and deterministic.
- The third-run state recommends `ENTER_VERIFYING`, never `COMPLETE`.
- Missing or stale prerequisites never produce unsafe forward guidance.
- The command is read-only and does not execute command text from artifacts.
- Existing completion rejection and evidence requirements remain strict.
- Shipped adapters tell the agent to query `next` after implementation.
- Unit, CLI, package, protocol, Markdown, loop, secret, and portability checks
  remain green.
