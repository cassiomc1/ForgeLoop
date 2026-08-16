# ForgeLoop Artifact & Schema Reference

This document details every artifact stored under `.forgeloop/`, including its schema, ownership, mutability, trust classification, and freshness bindings.

---

## 1. Artifact Summary Table

| Artifact Path | Canonical Owner | Purpose | Mutability | Evidence? | Authority? |
| --- | --- | --- | --- | --- | --- |
| `.forgeloop/current-contract.json` | Contract Layer | Task intent, deliverables, success criteria | Agent / CLI | Context | No |
| `.forgeloop/routing-result.json` | Routing Layer | Deterministically selected engineering guides | CLI | Context | No |
| `.forgeloop/gates/<gate>.json` | Preflight Layer | Pre-implementation gate satisfaction records | Agent / CLI | Gate Record | No |
| `.forgeloop/preflight.json` | Preflight Layer | Pre-implementation authorization checkpoint | CLI | Protocol State | No |
| `.forgeloop/work-state.json` | Lifecycle Layer | Canonical resumable phase checkpoint | **CLI Only** | Protocol State | No |
| `.forgeloop/continuity.json` | Continuity Layer | Granular operational handoff context | Agent / CLI | **No** | **No** |
| `.forgeloop/events.ndjson` | Ledger Layer | Hash-chained append-only protocol event chronology | **Append Only** | Supporting History | No |
| `.forgeloop/executions/exec-*.json` | Execution Layer | Attested command provenance & output logs | **Append Only** | **Yes** | No |
| `.forgeloop/execution-receipt.json` | Completion Layer | Coverage mapping & completion binding | **CLI Only** | Completion Record | No |

---

## 2. Artifact Details

### 2.1 `current-contract.json`

- **Schema**: [`schemas/current-contract.schema.json`](../schemas/current-contract.schema.json)
- **Ownership**: `AGENT_AUTHORED`
- **Purpose**: Defines task scope, deliverables, assumptions, constraints, risks, and verification requirements.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Protocol schema version (currently `1`).
  - `protocolVersion` (integer): Protocol version (currently `1`).
  - `taskId` (string): Stable unique identifier for the task.
  - `objective` (string): Human-readable goal statement.
  - `assumptions` (array): Explicit assumptions. Each item has:
    - `value` (string): The stated assumption.
    - `reason` (string): Rationale for the assumption.
    - `scope` (string): Affected scope or area.
    - `reversible` (boolean): Const `true`.
    - `source` (string): Const `"agent-default"`.
  - `deliverables` (array of strings): Expected created or modified file paths.
  - `constraints` (array of strings): Technical or architectural boundaries.
  - `risks` (array of strings): Declared risk areas.
  - `verification` (array): Success criteria. Elements may be simple strings or structured requirement objects with `id`, `text`, `type` (`"PRODUCT"`, `"VERIFICATION"`, `"LIFECYCLE"`, `"PUBLICATION"`, `"PRODUCTION_READINESS"`), `operator` (`"SINGLE"`, `"ALL"`), `requiredEvidenceKind` (`"OBSERVED"`, `"INFERRED"`, `"NOT_VERIFIED"`, `"BLOCKED"`, `"HYPOTHESIS"`), `lifecycleOwned`, `terminalOwned`, `mixedTerminal`, `requiredPublicationStatus`, and nested `requirements`.
  - `successCriteria` (array): Success criteria strings or structured requirement objects.
  - `stopConditions` (array of strings): Explicit task abort conditions.
  - `unresolvedDecisions` (array of strings): Open decisions requiring user input.
  - `sourceRefs` (array of strings): Referencing evidence sources.
- **Freshness**: Binds by SHA-256 fingerprint (`contractFingerprint`). Changing the contract marks downstream state `STALE`.

---

### 2.2 `routing-result.json`

- **Schema**: [`schemas/routing-result.schema.json`](../schemas/routing-result.schema.json)
- **Ownership**: `CLI_OWNED` (Generated via `forgeloop route`)
- **Purpose**: Records the deterministic selection of engineering guides from `GUIDE_ROUTER.md`.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `input` (object): Evaluated work type, surfaces, risks, platforms, `behaviorChange`, and `executableChange`.
  - `primary` (string or null): Primary selected guide ID.
  - `guides` (array of strings): Active guide IDs in canonical order (e.g. `["clean", "test", "design"]`).
  - `reasons` (object): Machine reason codes justifying each selected guide.
  - `excluded` (object): Justifications for unselected guides.
- **Freshness**: Binds to `contractFingerprint`.

---

### 2.3 `gates/<gate>.json`

- **Schema**: [`schemas/gate.schema.json`](../schemas/gate.schema.json)
- **Ownership**: `AGENT_AUTHORED` / `CLI_OWNED`
- **Purpose**: Records satisfaction of mandatory pre-implementation gates (e.g. `design`, `threat-boundary`).
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `gate` (string): Gate identifier matching guide `requires-gates`.
  - `status` (string): `"satisfied"`, `"unverified"`, or `"blocked"`.
  - `taskId` (string): Associated task ID.
  - `contractFingerprint` (string): SHA-256 fingerprint of the contract when the gate was satisfied.
  - `satisfiedAt` (string): Timestamp of satisfaction.
  - `artifacts` (array of objects): Referenced artifact paths and their `sha256` hashes.
  - `decisions` (array of objects): Technical decisions with `id` and `text`.

---

### 2.4 `work-state.json`

- **Schema**: [`schemas/work-state.schema.json`](../schemas/work-state.schema.json)
- **Ownership**: **`CLI_OWNED` (DO NOT EDIT MANUALLY)**
- **Purpose**: Canonical lifecycle state tracking current phase, verification cycle, active guides, gates, and repository binding.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `taskId` (string): Bound task ID.
  - `contractFingerprint` (string): 64-character SHA-256 fingerprint of the active contract.
  - `routeFingerprint` (string, optional): SHA-256 fingerprint of the routing result.
  - `repositoryFingerprint` (object): Git repository context with `branch` and `head`.
  - `phase` (string): Current lifecycle phase (`PLANNED`, `EXECUTING`, `VERIFYING`, `REVIEWING`, `COMPLETE`, `BLOCKED`, `DIAGNOSING`, `CORRECTING`).
  - `selectedGuides` (array of strings): Currently active engineering guide IDs.
  - `requiredGates` (array of strings, optional): Mandatory pre-implementation gates.
  - `satisfiedGates` (array of strings, optional): Satisfied pre-implementation gates.
  - `complianceMode` (string, optional): `"advisory"`, `"standard"`, or `"strict"`.
  - `completedSteps` (array of strings): Completed lifecycle steps.
  - `pendingSteps` (array of strings): Pending lifecycle steps.
  - `requiredArtifacts` (array of objects, optional): Required artifacts and their `sha256` hashes.
  - `checks` (array of objects): Recorded verification checks.
  - `failures` (array of objects): Recorded failures requiring diagnosis.
  - `blockers` (array of objects): Active blockers preventing progression.
  - `lastUpdated` (string): Timestamp of the last state update.
  - `previousPhase` (string, optional): Prior lifecycle phase.
  - `diagnosedHypothesis` (string, optional): Root-cause hypothesis formulated during diagnosis.
  - `verificationEvidence` (array of objects, optional): Observed verification evidence items.
  - `evidenceCoverage` (array of objects, optional): Coverage mapping between requirements and observed checks.
  - `publicationStatus` (string, optional): `"not-published"`, `"local-only"`, `"committed"`, `"pushed"`, `"published"`, `"deployed"`.
  - `verificationCycle` (integer, optional): Monotonically increasing verification attempt counter.
  - `lastCompletionAttempt` (object, optional): Summary of the last rejected completion attempt.

> [!NOTE]
> `work-state.json` does not contain a generic `fingerprints` wrapper or a `session` field. Fingerprints are individual top-level properties (`contractFingerprint`, `routeFingerprint`, `repositoryFingerprint`).

---

### 2.5 `continuity.json`

- **Schema**: [`schemas/continuity.schema.json`](../schemas/continuity.schema.json)
- **Ownership**: `AGENT_AUTHORED` / `CLI_OWNED` (via `forgeloop record-continuity`)
- **Purpose**: Operational handoff notes across harnesses and sessions.
- **Persisted JSON Fields vs CLI Options**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `taskId` (string): Bound task ID.
  - `workStateFingerprint` (string): Bound `work-state.json` SHA-256 fingerprint.
  - `contractFingerprint` (string): Bound `current-contract.json` SHA-256 fingerprint.
  - `phase` (string): Lifecycle phase when recorded.
  - `verificationCycle` (integer, optional): Verification cycle when recorded.
  - `repositoryFingerprint` (object): Repository `branch` and `head`.
  - `updatedAt` (string): Timestamp of the handoff record.
  - `currentFocus` (object `{ id, summary }`): Recorded via CLI options `--focus-id <id>` and `--focus-summary <text>`.
  - `remainingWork` (array of `{ id, summary }`): Recorded via repeatable CLI option `--remaining <id:summary>`.
  - `knownIssues` (array of `{ id, summary }`): Recorded via repeatable CLI option `--known-issue <id:summary>`.
  - `changedAreas` (array of strings): Recorded via repeatable CLI option `--changed-area <path>`.
  - `inspectFirst` (array of strings): Recorded via repeatable CLI option `--inspect-first <path>`.
  - `resumeNote` (string): Recorded via CLI option `--resume-note <text>`.
- **Trust Rule**: Operational context only. **Continuity is never verification evidence.**

---

### 2.6 `events.ndjson`

- **Schema**: [`schemas/event.schema.json`](../schemas/event.schema.json)
- **Ownership**: **`APPEND_ONLY` (CLI Managed)**
- **Purpose**: Append-only, hash-chained ledger recording every protocol state transition, check execution, and gate event.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `eventId` (string): Unique UUID for the event.
  - `sequence` (integer): Monotonically increasing sequential index.
  - `type` (string): Event type (e.g. `PHASE_TRANSITION`, `CHECK_RECORDED`, `GATE_SATISFIED`, `COMPLETION_VERIFIED`).
  - `taskId` (string): Task ID.
  - `phase` (string): Lifecycle phase at event time.
  - `verificationCycle` (integer, optional): Active verification cycle.
  - `timestamp` (string): ISO 8601 timestamp.
  - `details` (object): Event-specific payload.
  - `prevHash` (string): SHA-256 hash of the previous event (or 64 zeros for genesis).
  - `hash` (string): SHA-256 hash chaining ensuring ledger tamper-resistance.

---

### 2.7 `executions/exec-*.json`

- **Schema**: [`schemas/execution.schema.json`](../schemas/execution.schema.json)
- **Ownership**: **`APPEND_ONLY` (Generated via `forgeloop run-check`)**
- **Purpose**: Immutable record of executed verification processes with exact argument vectors, exit codes, and timestamps.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `executionId` (string): Unique execution identifier (e.g. `exec-uuid`).
  - `taskId` (string): Associated task ID.
  - `checkId` (string): Check identifier.
  - `requirement` (string): Contract requirement covered by the command.
  - `verificationCycle` (integer): Monotonic verification cycle.
  - `kind` (string): Const `"COMMAND_EXECUTION"`.
  - `argv` (array of strings): Exact argument vector executed (e.g. `["npm", "test"]`).
  - `cwd` (string): Working directory for the execution.
  - `resolution` (object): Command resolution metadata with `resolutionMode`, `mayInstall`, `installer`, and `tool`.
  - `dispatch` (object, optional): Dispatch details with `kind` and `scriptName`.
  - `startedAt` (string): Start timestamp.
  - `finishedAt` (string): Completion timestamp.
  - `status` (string): `"passed"` or `"failed"`.
  - `exitCode` (integer or null): Process exit code (`0` for success).

---

### 2.8 `execution-receipt.json`

- **Schema**: [`schemas/execution-receipt.schema.json`](../schemas/execution-receipt.schema.json)
- **Ownership**: **`CLI_OWNED` (DO NOT EDIT MANUALLY)**
- **Purpose**: Maps contract requirements to observed check evidence and computes completion coverage.
- **Canonical Schema Fields**:
  - `schemaVersion` (integer): Const `1`.
  - `protocolVersion` (integer): Const `1`.
  - `taskId` (string): Associated task ID.
  - `contractFingerprint` (string): Bound contract SHA-256 fingerprint.
  - `routeFingerprint` (string, optional): Bound routing result SHA-256 fingerprint.
  - `stateFingerprint` (string, optional): Bound work state SHA-256 fingerprint.
  - `verificationCycle` (integer, optional): Active verification cycle.
  - `status` (string, optional): `"in-progress"`, `"complete"`, `"blocked"`, `"complete-with-concerns"`.
  - `taskStatus` (string, optional): `"in-progress"`, `"complete"`, `"blocked"`, `"incomplete"`.
  - `verificationStatus` (string, optional): `"valid"`, `"invalid"`, `"not-verified"`, `"blocked"`.
  - `publicationStatus` (string, optional): `"not-published"`, `"local-only"`, `"committed"`, `"pushed"`, `"published"`, `"deployed"`.
  - `productionReadiness` (string, optional): `"ready"`, `"not-verified"`, `"blocked"`.
  - `selectedGuides` (array of strings): Active guides.
  - `changedPaths` (array of strings): Modified or created file paths.
  - `checks` (array of objects): Recorded verification checks.
  - `evidence` (array of objects, optional): Structured evidence items with `kind` (`"OBSERVED"`, `"INFERRED"`, `"NOT_VERIFIED"`, `"BLOCKED"`), `source`, and `result`.
  - `evidenceCoverage` (array of objects, optional): Mapping of each requirement to observed evidence and coverage status (`COVERED`, `NOT_VERIFIED`, etc.).
  - `review` (object): Review summary.
  - `limitations` (array of strings): Disclosed operational or environmental limitations.
  - `publication` (object): Publication state with `committed` (boolean), `pushed` (boolean), `pullRequest` (string or null), `deployed` (boolean).

---

## 3. Protocol Status Precedence

When evaluating protocol health, ForgeLoop resolves statuses using strict precedence:

```text
INVALID  >  INCONSISTENT  >  STALE  >  INCOMPLETE  >  VALID
(Highest)                                             (Lowest)
```

| Status | Meaning | Resolution |
| --- | --- | --- |
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
