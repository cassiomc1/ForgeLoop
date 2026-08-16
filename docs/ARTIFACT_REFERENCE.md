# ForgeLoop Artifact & Schema Reference

This document details every artifact stored under `.forgeloop/`, including its schema, ownership, mutability, trust classification, and freshness bindings.

---

## 1. Artifact Summary Table

| Artifact Path | Canonical Owner | Purpose | Mutability | Evidence? | Authority? |
|---|---|---|---|---|---|
| `.forgeloop/current-contract.json` | Contract Layer | Task intent, deliverables, success criteria | Agent / CLI | Context | No |
| `.forgeloop/routing-result.json` | Routing Layer | Deterministically selected engineering guides | CLI | Context | No |
| `.forgeloop/gates/<gate>.json` | Preflight Layer | Pre-implementation gate satisfaction records | Agent / CLI | Gate Record | No |
| `.forgeloop/preflight.json` | Preflight Layer | Pre-implementation authorization checkpoint | CLI | Protocol State | No |
| `.forgeloop/work-state.json` | Lifecycle Layer | Canonical resumable phase checkpoint | **CLI Only** | Protocol State | No |
| `.forgeloop/continuity.json` | Continuity Layer | Granular operational handoff context | Agent / CLI | **No** | **No** |
| `.forgeloop/events.ndjson` | Ledger Layer | Hash-chained append-only protocol event chronology | **Append Only** | Supporting History | No |
| `.forgeloop/executions/exec-*.json`| Execution Layer | Attested command provenance & output logs | **Append Only** | **Yes** | No |
| `.forgeloop/execution-receipt.json` | Completion Layer| Coverage mapping & completion binding | **CLI Only** | Completion Record | No |

---

## 2. Artifact Details

### 2.1 `current-contract.json`

- **Schema**: [`schemas/current-contract.schema.json`](../schemas/current-contract.schema.json)
- **Ownership**: `AGENT_AUTHORED`
- **Purpose**: Defines the task scope, deliverables, assumptions, constraints, risks, and verification requirements.
- **Key Fields**:
  - `taskId` (string): Stable unique identifier for the task.
  - `objective` (string): Human-readable goal statement.
  - `assumptions` (array): Explicit assumptions with `value`, `reason`, `scope`, `reversible` (boolean), `source` (`agent-default` or `operator`).
  - `deliverables` (array of paths): Expected created or modified files.
  - `constraints` (array of strings): Technical or architectural boundaries.
  - `verification` (array of objects): Success criteria with `id`, `text`, `type` (`VERIFICATION`, `PRODUCT`, `LIFECYCLE`, `PUBLICATION`, `PRODUCTION_READINESS`).
  - `unresolvedDecisions` (array): Open decisions requiring user input.
- **Freshness**: Binds by SHA-256 fingerprint (`contractFingerprint`). Changing the contract marks downstream state `STALE`.

---

### 2.2 `routing-result.json`

- **Schema**: [`schemas/routing-result.schema.json`](../schemas/routing-result.schema.json)
- **Ownership**: `CLI_OWNED` (Generated via `forgeloop route`)
- **Purpose**: Records the deterministic selection of engineering guides from `GUIDE_ROUTER.md`.
- **Key Fields**:
  - `input`: The work type, surfaces, risks, and platforms evaluated.
  - `guides` (array): Active guide IDs (e.g. `["clean", "test", "design"]`).
  - `reasons` (object): Machine reason codes justifying each selected guide.
  - `excluded` (object): Justifications for unselected guides.
- **Freshness**: Binds to `contractFingerprint`.

---

### 2.3 `gates/<gate>.json`

- **Schema**: [`schemas/gate.schema.json`](../schemas/gate.schema.json)
- **Ownership**: `AGENT_AUTHORED` / `CLI_OWNED`
- **Purpose**: Records satisfaction of mandatory pre-implementation gates (e.g. `design`, `threat-boundary`).
- **Key Fields**:
  - `gate` (string): Gate identifier matching guide `requires-gates`.
  - `status`: `"satisfied"`, `"unverified"`, or `"blocked"`.
  - `artifacts`: Referenced file paths and their SHA-256 hashes.
  - `decisions`: Documented technical decisions.

---

### 2.4 `work-state.json`

- **Schema**: [`schemas/work-state.schema.json`](../schemas/work-state.schema.json)
- **Ownership**: **`CLI_OWNED` (DO NOT EDIT MANUALLY)**
- **Purpose**: Canonical lifecycle state tracking current phase, verification cycle, active guides, and git repository binding.
- **Key Fields**:
  - `taskId`: Task ID bound to contract.
  - `phase`: Current lifecycle phase (`PLANNED`, `EXECUTING`, `VERIFYING`, `REVIEWING`, `COMPLETE`, `BLOCKED`).
  - `verificationCycle` (integer): Monotonically increasing verification attempt counter.
  - `fingerprints`: Cryptographic hashes of contract, route, profile, and git HEAD.
  - `session`: Unique session identifier.

---

### 2.5 `continuity.json`

- **Schema**: [`schemas/continuity.schema.json`](../schemas/continuity.schema.json)
- **Ownership**: `AGENT_AUTHORED` / `CLI_OWNED` (via `forgeloop record-continuity`)
- **Purpose**: Operational handoff notes across harnesses and sessions.
- **Key Fields**:
  - `focusId` & `focusSummary`: Active sub-task being worked on.
  - `remaining`: List of pending checklist items.
  - `knownIssues`: Known edge cases or temporary blockers.
  - `changedAreas`: Directories modified during the session.
  - `inspectFirst`: Suggested starting files for the resuming actor.
  - `resumeNote`: Unstructured operational note.
- **Trust Rule**: Operational context only. **Continuity is never verification evidence.**

---

### 2.6 `events.ndjson`

- **Schema**: [`schemas/event.schema.json`](../schemas/event.schema.json)
- **Ownership**: **`APPEND_ONLY` (CLI Managed)**
- **Purpose**: Append-only, hash-chained ledger recording every protocol state transition, check execution, and gate event.
- **Key Fields**:
  - `eventId`: UUID for the event.
  - `sequence` (integer): Sequential event index.
  - `type`: Event type (e.g. `PHASE_TRANSITION`, `CHECK_RECORDED`, `GATE_SATISFIED`).
  - `prevHash` & `hash`: SHA-256 hash chaining ensuring ledger tamper-resistance.

---

### 2.7 `executions/exec-*.json`

- **Schema**: [`schemas/execution.schema.json`](../schemas/execution.schema.json)
- **Ownership**: **`APPEND_ONLY` (Generated via `forgeloop run-check`)**
- **Purpose**: Immutable record of executed verification processes with exit codes, timestamps, and stdout/stderr hashes.
- **Key Fields**:
  - `executionRef`: Unique execution identifier.
  - `command`: Array of argv arguments executed.
  - `exitCode`: Process exit code (0 = success).
  - `provenance`: `"FORGELOOP_EXECUTED"`.

---

### 2.8 `execution-receipt.json`

- **Schema**: [`schemas/execution-receipt.schema.json`](../schemas/execution-receipt.schema.json)
- **Ownership**: **`CLI_OWNED` (DO NOT EDIT MANUALLY)**
- **Purpose**: Maps contract requirements to observed check evidence and computes completion coverage.
- **Key Fields**:
  - `evidenceCoverage`: Array mapping each requirement to observed evidence and coverage status (`COVERED` or `NOT_VERIFIED`).
  - `checks`: Summary of all recorded checks.
  - `verificationStatus`: `"VALID"`, `"FAILED"`, or `"NOT_VERIFIED"`.

---

## 3. Protocol Status Precedence

When evaluating protocol health, ForgeLoop resolves statuses using strict precedence:

```text
INVALID  >  INCONSISTENT  >  STALE  >  INCOMPLETE  >  VALID
(Highest)                                             (Lowest)
```

| Status | Meaning | Resolution |
|---|---|---|
| **`INVALID`** | Structural or cryptographic failure (e.g. broken schema, broken ledger hash chain, illegal phase jump). | Fail closed; inspect errors via `doctor`. |
| **`INCONSISTENT`** | Conflicting state across artifacts (e.g. contract taskId $\neq$ work-state taskId). | Reconcile or align artifact identifiers. |
| **`STALE`** | Upstream dependency changed (e.g. contract modified after route or state was created). | Re-run `route`, re-evaluate gates, and run `preflight`. |
| **`INCOMPLETE`** | Requirements remain unverified or checks failed. | Complete remaining checks in `VERIFYING` phase. |
| **`VALID`** | All artifacts, hashes, coverage, and evidence are coherent and verified. | Ready for completion or merge. |

---

## 4. Lifecycle Phase State Machine

```text
                  ┌──────────────────────┐
                  │       RECEIVED       │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │     DISCOVERING      │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    CONTRACT_READY    │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │        ROUTED        │
                  └────┬────────────┬────┘
                       │            │
                       ▼            │
         ┌──────────────────┐       │
         │    DESIGNING     │       │
         └─────────────┬────┘       │
                       │            │
                       ▼            ▼
                  ┌──────────────────────┐
                  │       PLANNED        │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │      EXECUTING       │
                  └──────────┬───────────┘
                             │
                             ▼
         ┌────────►┌───────────────────┐
         │         │     VERIFYING     ├──────────┐
         │         └─────────┬─────────┘          │ (failed check)
         │                   │ (all checks pass)  ▼
         │                   ▼           ┌──────────────────┐
(retry)  │         ┌───────────────────┐ │    DIAGNOSING    │
         │         │     REVIEWING     │ └────────┬─────────┘
         │         └─────────┬─────────┘          │
         │                   │                    ▼
         │                   ▼           ┌──────────────────┐
         └───────────────────┴───────────┤    CORRECTING    │
                             │           └──────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │       COMPLETE       │
                  └──────────────────────┘
```
