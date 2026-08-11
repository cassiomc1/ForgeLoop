# Orchestrator integration contract

`mdfiles` is a portable protocol, not an orchestrator. A future harness may map
these serializable contracts to its own state machine, worker pool, or review
primitive without adding that framework to the package.

## State mapping

| mdfiles phase | Required input/output boundary |
| --- | --- |
| `RECEIVED` | task request and authority boundary |
| `DISCOVERING` | sourced project facts and Git/package context |
| `CONTRACT_READY` | objective, deliverables, constraints, risks, checks, stop condition |
| `ROUTED` | declared routing input and deterministic route result |
| `DESIGNING` | approved design when the task needs one |
| `PLANNED` | ordered task briefs or inline steps |
| `EXECUTING` | changed paths owned by the active harness |
| `VERIFYING` | structured checks and current results |
| `DIAGNOSING` | failure class, evidence delta, and hypothesis |
| `CORRECTING` | bounded correction tied to the hypothesis |
| `REVIEWING` | specification/quality result and reviewer identity |
| `COMPLETE` | verification evidence, limitations, and publication state |
| `BLOCKED` | blocker category, evidence, and safe next action |

The host may skip proportional phases, but it must preserve the mdfiles
invariants: completion requires verification, blocking requires evidence,
correction requires a hypothesis, and independent review requires a distinct
identity.

## Serializable interfaces

- `schemas/routing-input.schema.json` and `schemas/routing-result.schema.json`
  define deterministic guide selection after semantic signals are declared.
- `schemas/work-state.schema.json` defines local checkpoint/resume data.
- `schemas/execution-receipt.schema.json` defines structured evidence and
  explicit publication state.
- `schemas/task-brief.schema.json` and
  `schemas/delegated-result.schema.json` define optional delegation.

Every artifact is JSON-compatible, carries `schemaVersion: 1` and
`protocolVersion: 1`, and contains no executable callbacks, provider-specific
tool objects, credentials, hidden prompts, or remote database references.

## Host responsibilities

The compatible harness owns model execution, tool execution, scheduling,
parallelism, lifecycle, isolation, and any remote services. It must pass
validated inputs to the protocol, preserve file ownership, report unavailable
capabilities, and never turn local success into an unverified publication
claim.

`mdfiles` does not provide a graph runtime, a provider adapter, a scheduler, or
an `mdfiles run` command. Inline execution is the valid fallback when the host
has no subagents or worktrees.
