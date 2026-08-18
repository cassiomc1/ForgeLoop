# Orchestrator integration contract

`ForgeLoop` is a portable protocol, not an orchestrator. A compatible harness
may map these serializable contracts to its own state machine, worker pool, or
review primitive without adding that framework to the package.

## Canonical workflow diagram

```text
RECEIVED → DISCOVERING → CONTRACT_READY → ROUTED
                                      ├→ DESIGNING → PLANNED
                                      └→ PLANNED
PLANNED → EXECUTING → VERIFYING
VERIFYING ├→ DIAGNOSING → CORRECTING → VERIFYING
          └→ REVIEWING → COMPLETE
                         └→ VERIFYING when completion is rejected only for evidence
Any non-terminal state → BLOCKED when a genuine blocker is evidenced
```

## Phase names

- `RECEIVED`
- `DISCOVERING`
- `CONTRACT_READY`
- `ROUTED`
- `DESIGNING`
- `PLANNED`
- `EXECUTING`
- `VERIFYING`
- `DIAGNOSING`
- `CORRECTING`
- `REVIEWING`
- `COMPLETE`
- `BLOCKED`

## Canonical transition table

| From | Condition | To |
| --- | --- | --- |
| `RECEIVED` | context is required | `DISCOVERING` |
| `DISCOVERING` | sufficient sourced context | `CONTRACT_READY` |
| `CONTRACT_READY` | route is resolved | `ROUTED` |
| `ROUTED` | design decision is required | `DESIGNING` |
| `ROUTED` | no design gate is required | `PLANNED` |
| `DESIGNING` | design is approved | `PLANNED` |
| `PLANNED` | task work begins | `EXECUTING` |
| `EXECUTING` | targeted check is ready | `VERIFYING` |
| `VERIFYING` | a check fails | `DIAGNOSING` |
| `DIAGNOSING` | a fix hypothesis exists | `CORRECTING` |
| `CORRECTING` | the fix is applied | `VERIFYING` |
| `VERIFYING` | checks pass | `REVIEWING` |
| `REVIEWING` | completion is rejected only for evidence | `VERIFYING` |
| `REVIEWING` | contract and quality are accepted | `COMPLETE` |
| `Any non-terminal state` | a genuine external blocker is evidenced | `BLOCKED` |

The host may skip proportional phases, but it must preserve the state
invariants and record why a skipped phase was not applicable.

## State invariants

- `COMPLETE` requires verification evidence current to the task.
- `BLOCKED` requires blocker evidence, a category, and a safe next action.
- `CORRECTING` requires an append-only diagnosis event recorded in the event ledger (`DIAGNOSIS_RECORDED`) with non-zero information gain (`informationGain !== "NONE"`).
- `REVIEWING` cannot claim independent review when reviewer and implementer
  identities are equal.
- `REVIEWING → VERIFYING` requires a persisted evidence-only completion
  rejection and starts a new `verificationCycle`.
- A retry requires new evidence or a changed hypothesis; repeating the same diagnosis produces `informationGain: NONE` and stalls progression (`CHANGE_STRATEGY`).
- `forgeloop progress` deterministically evaluates task progress across cycles as `ADVANCING`, `WATCH`, or `STALLED`.
- `forgeloop record-decision-criterion` attaches contract-bound guidance to unresolved decisions without breaking the schema.

## Serializable interfaces

The following JSON Schemas define the boundaries a host may implement:

- `schemas/routing-input.schema.json` and
  `schemas/routing-result.schema.json` define deterministic guide selection
  after semantic signals are declared.
- `schemas/work-state.schema.json` defines local checkpoint/resume data.
- `schemas/execution-receipt.schema.json` defines structured evidence and
  explicit publication state.
- `schemas/task-brief.schema.json` and
  `schemas/delegated-result.schema.json` define optional delegation.
- `schemas/evidence.schema.json` defines the shared evidence vocabulary.
- `schemas/current-contract.schema.json`, `schemas/gate.schema.json`,
  `schemas/preflight.schema.json`, and `schemas/source-registry.schema.json`
  define preparation and provenance artifacts.
- `schemas/check.schema.json` and `schemas/evidence-coverage.schema.json`
  define observed verification and load-bearing success coverage.
- `schemas/event.schema.json`, `schemas/activation.schema.json`,
  `schemas/config.schema.json`, `schemas/policy.schema.json`, and
  `schemas/task-bundle.schema.json` define chronology, mode, policy, and
  handoff boundaries.

`src/core/conformance.js` validates relationships that individual schemas
cannot express: route/state protocol versions, route/state guide sets,
state/receipt contract fingerprints, and delegated-result/task-brief IDs. Its
statuses are `VALID`, `INCOMPLETE`, `STALE`, `INCONSISTENT`, and `INVALID`.
`forgeloop validate-protocol` is read-only and reports the exact failed
invariant.

The preparation and completion commands are also local validators:
`preflight` must be `READY` before executable work, `audit` is a consistency
report, and `complete` returns `VALID` only after current evidence, coverage,
receipt relationships, and ledger chronology pass. None of these commands
execute a project command or a model.

Every artifact is JSON-compatible, carries `schemaVersion: 1` and
`protocolVersion: 1`, and contains no executable callbacks, provider-specific
tool objects, credentials, hidden prompts, or remote database references.

## Host responsibilities

The compatible harness owns model execution, tool execution, scheduling,
parallelism, lifecycle, isolation, and any remote services. It must pass
validated inputs to the protocol, preserve file ownership, report unavailable
capabilities, and never turn local success into an unverified publication
claim.

## No-runtime boundary

The protocol does not provide a graph runtime.
The protocol does not provide a provider adapter.
The protocol does not provide a scheduler.
No runtime required: inline execution is the valid fallback when the host has
no subagents or worktrees. A future host may add those capabilities outside the
package, but must preserve the serialized contracts and explicit limitations.
