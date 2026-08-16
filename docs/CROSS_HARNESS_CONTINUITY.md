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
         ┌───────────────────────────┐
         │     ForgeLoop Task        │
         │ .forgeloop/work-state.json│
         │ .forgeloop/continuity.json│
         │  Hash-chained Event Log   │
         └───────────────────────────┘
```

When a new harness starts in a repository where an active task exists, it must discover the existing task, reconcile continuity, and proceed from the recorded state rather than overwriting the contract.

---

## 2. Source-of-Truth Hierarchy

| Layer | File / Source | Responsibility | Trust Level |
|---|---|---|---|
| **Lifecycle Checkpoint** | `.forgeloop/work-state.json` | Current phase, cycle, active guides, preflight binding | Canonical lifecycle truth |
| **Operational Continuity** | `.forgeloop/continuity.json` | Active focus, remaining items, known issues, inspect-first paths | Operational context only (non-evidence) |
| **Implementation Truth** | Git checkout / filesystem | Actual source code and files | Ground truth for changes |
| **Task Intent** | `.forgeloop/current-contract.json` | Objectives, constraints, deliverables, verification requirements | Contract authority |
| **Execution Guidance** | `.forgeloop/routing-result.json` | Deterministically selected engineering guides | Guidance |
| **Verification Provenance**| `.forgeloop/executions/*.json` | Attested process execution records | Verification truth |
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
   └── Records operational handoff: `forgeloop record-continuity`
          │
          ▼
      Shared Checkout (.forgeloop/)
          │
          ▼
HARNESS B (Starting / Taking Over)
   │
   ├── 1. Discovers ForgeLoop (via AGENTS.md / .forgeloop)
   ├── 2. Inspects state: `forgeloop status --json`
   ├── 3. Reads continuity: `forgeloop continuity --json`
   ├── 4. Reconciles continuity: `forgeloop reconcile-continuity --json`
   ├── 5. Inspects modified files: `forgeloop inspect --json`
   └── 6. Asks for next action: `forgeloop next --json`
          │
          ▼
     Continues execution without duplicating planning
```

---

## 4. Harness A — Recording Handoff Context

Before pausing, exiting, or transferring control, Harness A records its work in progress:

```bash
forgeloop record-continuity \
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

### Step 1: Check Current Status
```bash
forgeloop status --json
```
Verify that an active task exists and observe the current lifecycle phase (e.g. `EXECUTING` or `VERIFYING`).

### Step 2: Read Continuity Context
```bash
forgeloop continuity --json
```
Examine the handoff note, focus ID, remaining items, and inspect-first recommendations.

### Step 3: Reconcile Continuity with Work State
```bash
forgeloop reconcile-continuity --json
```
Reconciliation validates that `continuity.json` matches the current `work-state.json` fingerprint and was not corrupted by external changes.

### Step 4: Inspect Checkout Changes
```bash
forgeloop inspect --json
```
Review modified and newly created files against the contract deliverables.

### Step 5: Query Next Lifecycle Action
```bash
forgeloop next --json
```
Follow the deterministic action returned by ForgeLoop (e.g. `CONTINUE_IMPLEMENTATION`, `ENTER_VERIFYING`, or `RECORD_CHECK`).

---

## 6. Stale, Inconsistent, or Missing Handoffs

ForgeLoop handles edge cases deterministically:

| Scenario | Condition | Protocol Behavior | Recommended Action |
|---|---|---|---|
| **Fresh Handoff** | Matching state fingerprint & clean checkout | `VALID` | Continue directly via `forgeloop next` |
| **Checkout Drift** | State fresh, but files modified out-of-band | `CONTINUITY_RECONCILED` | Run `reconcile-continuity`, inspect diff, continue |
| **Stale Continuity** | Continuity references older work-state | `STALE_CONTINUITY` | Reconcile or clear continuity (`clear-continuity`), rely on `work-state.json` |
| **Missing Continuity** | `work-state.json` exists, `continuity.json` absent | `VALID_STATE` | Normal resume from `work-state.json` (continuity is optional) |
| **Different Task ID** | Contract / state ID mismatch | `TASK_MISMATCH` | Do not merge contexts; complete or clear previous state |
| **Malformed State** | Corrupted JSON or invalid hash chain | `INVALID` | Fails closed; inspect errors via `forgeloop doctor --json` |

---

## 7. Discovery Adapter Integration

Every discovery adapter (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`) reinforces this invariant:

> Before creating a contract or starting new task state, check whether `.forgeloop/work-state.json` exists. If active state exists, reconcile continuity, inspect checkout, and run `forgeloop next`. A change of agent, harness, or session does not create a new task.
