# ForgeLoop Artifact Reference

This reference documents the canonical artifacts persisted in the `.forgeloop/` directory.

All artifact schemas are defined in `schemas/*.schema.json`. Persisted artifact shapes are strictly bound to these schemas and validated during protocol transitions.

---

## 1. Artifact Registry Summary

| Artifact File | Schema | Ownership | Mutability | Trust Role |
| --- | --- | --- | --- | --- |
| `current-contract.json` | `current-contract` | Agent-authored | Mutable before execution | Operational specification |
| `routing-result.json` | `routing-result` | Protocol-generated | Mutable on reroute | Guide routing specification |
| `preflight.json` | `preflight` | Protocol-generated | Overwritten on preflight | Readiness attestation |
| `sources.json` | `source-registry` | Operator / Agent | Mutable on discovery | Source attestation |
| `events.ndjson` | `event` | Protocol-appended | Append-only | Audit ledger |
| `session.json` | `activation` | Protocol-generated | Overwritten on activate | Session marker |
| `config.json` | `config` | Operator / Agent | Mutable configuration | Project configuration |
| `gates/<gate>.json` | `gate` | Agent / Reviewer | Overwritten on gate satisfaction | Gate approval attestation |
| `work-state.json` | `work-state` | Protocol-managed | Atomic state transitions | Canonical lifecycle state |
| `continuity.json` | `continuity` | Agent / Harness | Mutable handoff notes | Non-evidence handoff |
| `execution-receipt.json` | `execution-receipt` | Protocol-compiled | Atomic compilation | Evidence compilation |
| `executions/exec-<id>.json` | `execution` | Protocol-executed | Immutable once written | Execution provenance |

---

## 2. Canonical Artifact Specifications

### 2.1 `current-contract.json`

<!-- forgeloop-doc: schema=current-contract artifact=.forgeloop/current-contract.json -->

The operational task specification authored before execution begins.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Contract schema version.
- `protocolVersion` *(integer, required, const: 1)*: ForgeLoop protocol version.
- `taskId` *(string, required)*: Stable identifier for the task.
- `objective` *(string, required)*: High-level goal statement.
- `assumptions` *(array of objects, optional)*: Explicit agent assumptions with safe defaults:
  - `value` *(string, required)*: Assumed default behavior or choice.
  - `reason` *(string, required)*: Rationale for the assumption.
  - `scope` *(string, required)*: Affected module, feature, or subsystem.
  - `reversible` *(boolean, required)*: Must be `true` for non-blocking local defaults.
  - `source` *(string, required, const: `"agent-default"`)*: Must be `"agent-default"`.
- `deliverables` *(array of strings, required)*: Concrete file paths or deliverables promised.
- `constraints` *(array of strings, required)*: Operational or technical boundaries.
- `risks` *(array of strings, required)*: Declared risk factors.
- `verification` *(array of strings or objects, required)*: Planned verification items:
  - `id` *(string, required)*: Stable verification requirement identifier.
  - `text` *(string, required)*: Human-readable verification criteria.
  - `type` *(string, optional, enum: `VERIFICATION`, `PUBLICATION`, `PRODUCTION_READINESS`, `LIFECYCLE`)*: Requirement classification.
- `successCriteria` *(array of strings, required)*: Observable conditions that must be met.
- `stopConditions` *(array of strings, required)*: Conditions requiring immediate work halt.
- `unresolvedDecisions` *(array of strings, required)*: Blocking decisions pending operator review.
- `sourceRefs` *(array of strings, required)*: References to source requirements.

---

### 2.2 `routing-result.json`

<!-- forgeloop-doc: schema=routing-result artifact=.forgeloop/routing-result.json -->

The deterministic result of routing task signals against the engineering guide router.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Routing schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `contractFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: Bound contract SHA-256 fingerprint.
- `input` *(object, required)*: Echoed routing input signals:
  - `workType` *(string, required)*: Primary work type.
  - `surfaces` *(array of strings, optional)*: Activated technical surfaces.
  - `risks` *(array of strings, optional)*: Declared risk signals.
  - `platforms` *(array of strings, optional)*: Target execution platforms.
  - `behaviorChange` *(boolean, optional)*: Declares runtime behavior modification.
  - `executableChange` *(boolean, optional)*: Declares executable code changes.
- `primary` *(string or null, required)*: Primary guide ID or `null`.
- `guides` *(array of strings, required)*: Ordered list of activated engineering guide IDs.
- `reasons` *(object, required)*: Map of guide IDs to activation rationale strings.
- `excluded` *(object, required)*: Map of unactivated guide IDs to rejection reason codes.

---

### 2.3 `preflight.json`

<!-- forgeloop-doc: schema=preflight artifact=.forgeloop/preflight.json -->

Readiness attestation evaluated prior to implementation.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Preflight schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `status` *(string, required, enum: `READY`, `BLOCKED`)*: Overall preflight readiness status.
- `profile` *(object, required)*: Project profile evaluation.
- `contract` *(object, required)*: Contract validation summary.
- `routing` *(object, required)*: Routing validation summary.
- `requiredGates` *(array of strings, required)*: Gate IDs required by activated guides.
- `satisfiedGates` *(array of strings, required)*: Gate IDs satisfied by existing valid gate artifacts.
- `errors` *(array of objects, required)*: List of preflight failure reasons if not `READY`.
- `fingerprints` *(object, optional)*: Cryptographic bindings across contract, routing, and profile.
- `sources` *(object, optional)*: Discovered project sources summary.
- `policy` *(object, optional)*: Policy evaluation summary.

---

### 2.4 `sources.json`

<!-- forgeloop-doc: schema=source-registry artifact=.forgeloop/sources.json -->

Discovered repository facts, platforms, runtimes, and dependencies.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Source registry schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `sources` *(object, required)*: Map of discovered project facts:
  - `kind` *(string, required, enum: `user-request`, `repository-fact`, `observation`, `command`, `agent-decision`, `inference`, `unknown`)*: Fact kind.
  - `summary` *(string, required)*: Description of the fact.
  - `path` *(string, optional)*: Relative file path.
  - `sha256` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: File hash.
  - `command` *(string, optional)*: Discovered tool command.
  - `result` *(string, optional)*: Execution result summary.
  - `status` *(string, optional)*: Discovery status.

---

### 2.5 `events.ndjson`

<!-- forgeloop-doc: schema=event artifact=.forgeloop/events.ndjson -->

The append-only cryptographic event ledger. Each line is a single JSON event object.

#### Canonical Line Fields

- `seq` *(integer, required, minimum: 1)*: Strictly monotonically increasing sequence number.
- `schemaVersion` *(integer, required, const: 1)*: Event schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `event` *(string, required)*: Event type name (e.g. `TASK_INITIALIZED`, `PHASE_TRANSITION`, `PREFLIGHT_READY`, `CHECK_EXECUTED`).
- `at` *(string, required)*: ISO 8601 UTC timestamp string.
- `fingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: Optional SHA-256 artifact or state fingerprint.
- `previousHash` *(string or null, required)*: SHA-256 hash of the preceding event line, or `null` for the genesis event (`seq: 1`).
- `hash` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: SHA-256 hash of this event line computed over canonicalized fields.
- `details` *(object, optional)*: Event-specific structured payload.

---

### 2.6 `session.json`

<!-- forgeloop-doc: schema=activation artifact=.forgeloop/session.json -->

The active harness session marker created by `forgeloop activate`.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Activation schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `sessionId` *(string, required)*: UUID identifying the current harness session.
- `activationMarker` *(string, required)*: Ephemeral marker verifying session initiation.
- `createdAt` *(string, required)*: ISO 8601 UTC timestamp.

---

### 2.7 `config.json`

<!-- forgeloop-doc: schema=config artifact=.forgeloop/config.json -->

Local ForgeLoop configuration settings and policy bindings.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Configuration schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `complianceMode` *(string, required, enum: `advisory`, `standard`, `strict`)*: Compliance enforcement mode.
- `policy` *(string, optional)*: Active policy pack name.
- `requiredGates` *(array of strings, optional)*: Gate IDs required by configuration.
- `requiredEvidence` *(array of strings, optional)*: Evidence IDs required by configuration.

---

### 2.8 `gates/<gate>.json`

<!-- forgeloop-doc: schema=gate artifact=.forgeloop/gates/<gate>.json -->

Pre-implementation gate approval artifact recording decisions, bound artifact hashes, and evidence.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Gate schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `gate` *(string, required)*: Gate name (e.g. `design`, `threat-boundary`, `performance-budget`).
- `status` *(string, required, enum: `satisfied`, `unverified`, `blocked`)*: Gate status.
- `requiredBy` *(array of strings, required)*: Guide IDs that mandated this gate.
- `artifacts` *(array of objects, required)*: Cryptographically bound artifact references:
  - `path` *(string, required)*: Relative file path to the approved artifact.
  - `sha256` *(string, required, pattern: `^[a-f0-9]{64}$`)*: SHA-256 hash of the artifact at approval time.
- `decisions` *(array of strings, required)*: Approved architectural decisions as strings (e.g. `["Use server-side validation", "Preserve public API"]`).
- `unknowns` *(array of strings, required)*: Known unresolved questions or acceptable unknowns.
- `approvedAssumptions` *(array of strings, required)*: Assumptions formally approved for this gate.
- `evidence` *(array of objects, required)*: Evidence supporting gate satisfaction.

---

### 2.9 `work-state.json`

<!-- forgeloop-doc: schema=work-state artifact=.forgeloop/work-state.json -->

The canonical, authoritative lifecycle work state.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Work state schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*: SHA-256 fingerprint of `current-contract.json`.
- `routeFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: SHA-256 fingerprint of `routing-result.json`.
- `repositoryFingerprint` *(object, required)*: Git repository state bindings (`branch`, `head`).
- `phase` *(string, required, enum: `RECEIVED`, `DISCOVERING`, `CONTRACT_READY`, `ROUTED`, `DESIGNING`, `PLANNED`, `EXECUTING`, `VERIFYING`, `DIAGNOSING`, `CORRECTING`, `REVIEWING`, `COMPLETE`, `BLOCKED`)*: Current lifecycle phase.
- `selectedGuides` *(array of strings, required)*: Activated guide IDs.
- `requiredGates` *(array of strings, optional)*: Gate IDs required for this task.
- `satisfiedGates` *(array of strings, optional)*: Gate IDs currently satisfied.
- `complianceMode` *(string, optional, enum: `advisory`, `standard`, `strict`)*: Active compliance mode.
- `completedSteps` *(array of strings, required)*: History of completed lifecycle steps.
- `pendingSteps` *(array of strings, required)*: Remaining required lifecycle steps.
- `requiredArtifacts` *(array of objects, optional)*: Paths to required artifacts (`path`, `sha256`).
- `checks` *(array of objects, required)*: Registered verification check results.
- `failures` *(array of objects, required)*: Recorded failure classifications.
- `blockers` *(array of objects, required)*: Active blocking conditions.
- `lastUpdated` *(string, required)*: ISO 8601 UTC timestamp.
- `previousPhase` *(string, optional)*: Phase immediately preceding current phase.
- `diagnosedHypothesis` *(string, optional)*: Hypothesis formulated during diagnosis.
- `verificationEvidence` *(array of objects, optional)*: Observed evidence summaries.
- `evidenceCoverage` *(array of objects, optional)*: Evidence coverage mapping.
- `publicationStatus` *(string, optional, enum: `not-published`, `local-only`, `committed`, `pushed`, `published`, `deployed`)*: Current publication status.
- `verificationCycle` *(integer, optional, minimum: 1)*: Current verification attempt cycle number.
- `lastCompletionAttempt` *(object, optional)*: Last completion rejection details.

---

### 2.10 `continuity.json`

<!-- forgeloop-doc: schema=continuity artifact=.forgeloop/continuity.json -->

Cross-harness non-evidence handoff notes.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Continuity schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `workStateFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*: Bound work state fingerprint.
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*: Bound contract fingerprint.
- `phase` *(string, required)*: Active phase at handoff.
- `verificationCycle` *(integer, optional, minimum: 1)*: Active verification cycle.
- `repositoryFingerprint` *(object, required)*: Git repository state bindings (`branch`, `head`).
- `updatedAt` *(string, required)*: ISO 8601 UTC timestamp.
- `currentFocus` *(object, optional)*: Active implementation focus (`id`, `summary`).
- `remainingWork` *(array of objects, required)*: Structured remaining items (`id`, `summary`).
- `knownIssues` *(array of objects, required)*: Unresolved bugs or obstacles (`id`, `summary`).
- `changedAreas` *(array of strings, required)*: Relative directory or file paths modified.
- `inspectFirst` *(array of strings, required)*: Suggested file paths for resuming harness to examine first.
- `resumeNote` *(string, optional)*: Concise operational instructions for resuming harness.

---

### 2.11 `execution-receipt.json`

<!-- forgeloop-doc: schema=execution-receipt artifact=.forgeloop/execution-receipt.json -->

The cryptographically compiled verification receipt required for task completion.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Receipt schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `taskId` *(string, required)*: Bound task ID.
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*: Bound contract fingerprint.
- `routeFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: Bound route fingerprint.
- `stateFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*: Bound work state fingerprint.
- `verificationCycle` *(integer, optional, minimum: 1)*: Verification cycle index.
- `status` *(string, optional, enum: `in-progress`, `complete`, `blocked`, `complete-with-concerns`)*: Receipt evaluation status.
- `taskStatus` *(string, optional, enum: `in-progress`, `complete`, `blocked`, `incomplete`)*: Lifecycle completion status.
- `verificationStatus` *(string, optional, enum: `valid`, `invalid`, `not-verified`, `blocked`)*: Verification readiness status.
- `publicationStatus` *(string, optional, enum: `not-published`, `local-only`, `committed`, `pushed`, `published`, `deployed`)*: Publication status.
- `productionReadiness` *(string, optional, enum: `ready`, `not-verified`, `blocked`)*: Production readiness status.
- `selectedGuides` *(array of strings, required)*: Guide IDs evaluated.
- `changedPaths` *(array of strings, required)*: Paths modified during task.
- `checks` *(array of objects, required)*: Evaluated checks.
- `evidence` *(array of objects, optional)*: Bound verification evidence:
  - `kind` *(string, required, enum: `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, `BLOCKED`)*: Evidence kind.
  - `source` *(string, required)*: Evidence source.
  - `result` *(string, required)*: Evidence result description.
- `evidenceCoverage` *(array of objects, optional)*: Coverage items mapping requirements to observed evidence.
- `review` *(object, required)*: Manual or independent review summary.
- `limitations` *(array of strings, required)*: Declared task limitations or unverified dimensions.
- `publication` *(object, required)*: Publication attestation state (`committed`, `pushed`, `pullRequest`, `deployed`).

---

### 2.12 `executions/exec-<id>.json`

<!-- forgeloop-doc: schema=execution artifact=.forgeloop/executions/exec-<id>.json -->

Attested command execution provenance artifact generated by `forgeloop run-check`.

#### Canonical Fields

- `schemaVersion` *(integer, required, const: 1)*: Execution schema version.
- `protocolVersion` *(integer, required, const: 1)*: Protocol version.
- `executionId` *(string, required, pattern: `^exec-[A-Za-z0-9_-]+$`)*: Unique execution identifier.
- `taskId` *(string, required)*: Bound task ID.
- `checkId` *(string, required)*: Bound check identifier.
- `requirement` *(string, required)*: Requirement covered by this execution.
- `verificationCycle` *(integer, required, minimum: 1)*: Active verification cycle.
- `kind` *(string, required, enum: `command`)*: Execution kind (`command`).
- `argv` *(array of strings, required)*: Exact command arguments executed.
- `cwd` *(string, required)*: Working directory during execution.
- `resolution` *(object, required)*: Command safety classification:
  - `resolutionMode` *(string, required, enum: `LOCAL_EXECUTABLE`, `LOCAL_PACKAGE_BINARY`, `NON_INSTALLING_RESOLUTION`, `INSTALL_CAPABLE_RESOLUTION`, `EXPLICIT_INSTALLATION`, `UNKNOWN`)*: Resolution mode.
  - `mayInstall` *(boolean, required)*: Whether execution could perform installation.
  - `installer` *(string or null, required)*: Package manager installer name or null.
  - `tool` *(string or null, required)*: Executable tool name or null.
- `startedAt` *(string, required)*: ISO 8601 UTC start timestamp.
- `finishedAt` *(string, required)*: ISO 8601 UTC finish timestamp.
- `status` *(string, required, enum: `passed`, `failed`)*: Execution result status based on exit code.
- `exitCode` *(integer, required)*: Process exit code (0 for `passed`, non-zero for `failed`).
- `dispatch` *(object, optional)*: Optional nested execution dispatcher metadata.
