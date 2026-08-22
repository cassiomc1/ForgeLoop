# Cross-Harness Execution Continuity

This guide explains how to resume and transfer ForgeLoop tasks across different AI harnesses, IDEs, terminals, and agent runtimes without losing lifecycle state or re-explaining context.

---

## 1. Core Invariants

1. **Harness identity $\neq$ Task identity**
2. **Session identity $\neq$ Task identity**

Switching between execution environments (for example Codex $\rightarrow$ Claude Code, Claude Code $\rightarrow$ Cursor, or terminal A $\rightarrow$ terminal B) **does not create a new ForgeLoop task**.

```text
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Harness A   │       │  Harness B   │       │  Developer   │
│ (Claude Code)│       │   (Cursor)   │       │  (Terminal)  │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └───────────────┬──────┴──────────────────────┘
                       ▼
         ┌───────────────────────────────────────────────┐
         │              ForgeLoop Task                   │
         │ .forgeloop/task-state/<taskKey>/work-state.json│
         │ .forgeloop/task-state/<taskKey>/continuity.json│
         │            Hash-chained Event Log             │
         └───────────────────────────────────────────────┘
```

When a new harness starts in a repository where an active task exists, it must discover the existing task, reconcile continuity when present, inspect the checkout, and proceed from the recorded state rather than overwriting the contract.

Before it touches task state, a harness can verify the public compatibility
handshake it will use for the handoff:

<!-- FORGELOOP EXAMPLE: cross-harness:handshake | exit=0 | json.lifecycle.phases.0=RECEIVED -->
```bash
forgeloop protocol-info --json
```
<!-- END FORGELOOP EXAMPLE -->

Key continuity invariants:

- **Continuity is optional**: A missing `continuity.json` file does not invalidate an otherwise resumable task.
- **Continuity is non-authoritative**: It provides operational resume hints, not lifecycle truth.
- **Continuity is not evidence**: It cannot satisfy contract verification requirements.
- **Task identity survives harness changes**: Work state remains the single source of lifecycle truth.
- **Stale continuity cannot authorize transitions**: Forward lifecycle progression requires valid work-state checkpoints.

---

## 2. Source-of-Truth Hierarchy

| Layer | File / Source | Responsibility | Trust Level |
| --- | --- | --- | --- |
| **Task Descriptor** | `.forgeloop/task-state/<taskKey>/task.json` | Task ID, write claims, and task registration | Descriptor authority |
| **Lifecycle Checkpoint** | `.forgeloop/task-state/<taskKey>/work-state.json` | Current phase, cycle, active guides, preflight binding | Canonical lifecycle truth |
| **Recovery State** | `.forgeloop/task-state/<taskKey>/recovery.json` | Suspended mutation authority and released effective claims | Canonical claim-recovery truth; never completion evidence |
| **Operational Continuity** | `.forgeloop/task-state/<taskKey>/continuity.json` | Active focus, remaining items, known issues, inspect-first paths | Operational context only (non-evidence) |
| **Implementation Truth** | Git checkout / filesystem | Actual source code and files | Ground truth for changes |
| **Task Intent** | `.forgeloop/task-state/<taskKey>/contract.json` | Objectives, constraints, deliverables, verification requirements | Contract authority |
| **Task Policy Snapshot** | `.forgeloop/task-state/<taskKey>/policy-snapshot.json` | Effective policy rules and baseline authorized at preflight | Policy integrity binding; a replacement harness must resume against this snapshot, not re-discover policy |
| **Execution Guidance** | `.forgeloop/task-state/<taskKey>/routing-result.json` | Deterministically selected engineering guides | Guidance |
| **Verification Provenance** | `.forgeloop/task-state/<taskKey>/executions/*.json` | Attested process execution records | Verification truth |
| **Next Action** | `forgeloop next` | Deterministic computation of the valid next command | Control authority |

> [!IMPORTANT]
> `continuity.json` provides operational resume context to make transitions smooth. It is **never verification evidence** and **never grants authority**.

---

## 3. Cross-Harness Workflow

```text
HARNESS A (Finishing / Pausing)
   │
   ├── Commits or edits code in checkout
   ├── Updates work-state via ForgeLoop CLI
   └── Records operational handoff: `forgeloop record-continuity --task <id>`
          │
          ▼
      Shared Checkout (.forgeloop/task-state/<taskKey>/)
          │
          ▼
HARNESS B (Starting / Taking Over)
   │
   ├── 1. Discovers tasks: `forgeloop task-list --json`
   ├── 2. Inspects state: `forgeloop status --task <id> --json`
   ├── 3. Reads continuity: `forgeloop continuity --task <id> --json`
   ├── 4. Reconciles continuity: `forgeloop reconcile-continuity --task <id> --json`
   ├── 5. Inspects modified files: `forgeloop inspect --task <id> --json`
   └── 6. Asks for next action: `forgeloop next --task <id> --json`
          │
          ▼
     Continues execution without duplicating planning
```

---

## 4. Harness A — Recording Handoff Context

Before pausing, exiting, or transferring control, Harness A records its work in progress:

```bash
forgeloop record-continuity \
  --task auth-feature \
  --focus-id auth-refresh \
  --focus-summary "Implement refresh-token rotation" \
  --remaining "tests:Add refresh token expiration tests" \
  --remaining "docs:Document token rotation in API guide" \
  --known-issue "rotation:Old token revocation requires redis TTL sync" \
  --changed-area src/auth \
  --changed-area tests/auth \
  --inspect-first src/auth/refresh-token.js \
  --resume-note "Access-token validation is done; continue with refresh-token rotation in src/auth/refresh-token.js."
```

### Options Breakdown

- `--task <id>`: Target task identifier (or set `FORGELOOP_TASK`).
- `--focus-id <id>`: Short identifier for the active sub-task.
- `--focus-summary <text>`: Concise summary of what is currently being worked on.
- `--remaining <id:summary>`: Remaining work items (repeatable).
- `--known-issue <id:summary>`: Discovered blockers or edge cases to address (repeatable).
- `--changed-area <path>`: Directories or file trees modified during this session (repeatable).
- `--inspect-first <path>`: Recommended starting file for the next harness to read first.
- `--resume-note <text>`: Operational note explaining immediate context to the next actor.

---

## 5. Harness B — Resuming the Task

When Harness B starts in the repository:

### Step 1: Select and Check Task Status

If multiple tasks are active, select the target task explicitly using `--task` or `FORGELOOP_TASK`:

```bash
export FORGELOOP_TASK="auth-feature"

forgeloop status --json
```

Or with explicit flag:

<!-- FORGELOOP EXAMPLE: cross-harness:status | fixture=task:auth-feature | exit=0 | json.taskId=auth-feature -->
```bash
forgeloop status --task auth-feature --json
```
<!-- END FORGELOOP EXAMPLE -->

Verify that the task exists and observe the current lifecycle phase (e.g. `EXECUTING` or `VERIFYING`). If multiple tasks exist and no selector is provided, ForgeLoop returns `E_TASK_AMBIGUOUS`.

### Step 2: Read Continuity Context

```bash
forgeloop continuity --task auth-feature --json
```

Examine the handoff note, focus ID, remaining items, and inspect-first recommendations.

### Step 3: Reconcile Continuity with Work State

```bash
forgeloop reconcile-continuity --task auth-feature --json
```

Reconciliation validates that `continuity.json` matches the current `work-state.json` fingerprint and was not corrupted by external changes.

### Step 4: Inspect Checkout Changes

```bash
forgeloop inspect --task auth-feature --json
```

Review modified and newly created files against the contract deliverables and task claims.

### Step 5: Query Next Lifecycle Action

```bash
forgeloop next --task auth-feature --json
```

Follow the deterministic action returned by ForgeLoop (e.g. `CONTINUE_IMPLEMENTATION`, `ENTER_VERIFYING`, or `RECORD_CHECK`).

If `next` returns `RESUME_RECOVERED_TASK`, the handoff is still the same task,
but ordinary mutation is suspended. Inspect the recovery metadata and current
claim owners, then reacquire claims explicitly:

```bash
forgeloop task-show --task auth-feature --json
forgeloop task-resume --task auth-feature --json
```

Do not edit or delete `recovery.json` manually. If another task owns an
overlapping path, `task-resume` fails with `E_TASK_SCOPE_CONFLICT` and leaves
the recovery state intact.

---

## 6. Stale, Inconsistent, or Missing Handoffs

ForgeLoop handles edge cases deterministically:

| Scenario | Condition | Protocol Behavior | Recommended Action |
| --- | --- | --- | --- |
| **Fresh Handoff** | Matching state fingerprint & clean checkout | `VALID` | Continue directly via `forgeloop next` |
| **Checkout Drift** | State fresh, but files modified out-of-band | `CONTINUITY_RECONCILED` | Run `reconcile-continuity`, inspect diff, continue |
| **Stale Continuity** | Continuity references older work-state | `STALE_CONTINUITY` | Reconcile or clear continuity (`clear-continuity`), rely on `work-state.json` |
| **Missing Continuity** | `work-state.json` exists, `continuity.json` absent | `VALID_STATE` | Normal resume from `work-state.json` (continuity is optional) |
| **Multiple Active Tasks** | No `--task` or `FORGELOOP_TASK` supplied | `E_TASK_AMBIGUOUS` | List tasks with `task-list` and supply `--task` |
| **Different Task ID** | Contract / state ID mismatch | `TASK_MISMATCH` | Do not merge contexts; complete or clear previous state |
| **Malformed State** | Corrupted JSON or invalid hash chain | `INVALID` | Fails closed; inspect errors via `forgeloop doctor --json` |
| **Recovered Task** | Valid `recovery.json` releases effective claims | `RESUME_RECOVERED_TASK` | Inspect ownership, then use `task-resume`; recovery is not completion |
| **Recovery Inconsistency** | Artifact/event, lock, or freshness evidence is unreadable | `RESOLVE_RECOVERY_INCONSISTENCY` | Run `validate-protocol`; repair the named artifact instead of forcing recovery |

---

## 7. Discovery Adapter Integration

Every discovery adapter (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, `.github/copilot-instructions.md`) reinforces this invariant:

> Before creating or activating new lifecycle state:
> Discover task namespaces with ForgeLoop; if exactly one active task is healthy it may be selected implicitly; if multiple active tasks exist, select with `--task` or `FORGELOOP_TASK`.
> Inspect the existing task, reconcile continuity when present, inspect the checkout, and run `forgeloop next`.
> A change of harness, model, provider, IDE, process, terminal, or session does not create a new task.
