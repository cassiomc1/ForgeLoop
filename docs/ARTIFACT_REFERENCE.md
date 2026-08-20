# ForgeLoop Artifact Reference

This reference documents the canonical artifacts persisted in the `.forgeloop/` directory.

All artifact schemas are defined in `schemas/*.schema.json`. Persisted artifact shapes are strictly bound to these schemas and validated during protocol transitions.

---

## 1. Artifact Registry Summary

<!-- BEGIN FORGELOOP GENERATED: artifact-registry -->

| Artifact File | Schema | Ownership | Mutability | Trust Role |
| --- | --- | --- | --- | --- |
| `task-state/<task-key>/task.json` | `task-descriptor` | Protocol Managed | Mutable Before Execution | Task Descriptor |
| `task-state/<task-key>/contract.json` | `current-contract` | Agent Authored | Mutable Before Execution | Operational Specification |
| `task-state/<task-key>/routing-result.json` | `routing-result` | Protocol Generated | Mutable On Reroute | Guide Routing Specification |
| `task-state/<task-key>/preflight.json` | `preflight` | Protocol Generated | Overwritten On Preflight | Readiness Attestation |
| `sources.json` | `source-registry` | Operator Or Agent | Mutable On Discovery | Source Attestation |
| `task-state/<task-key>/events.ndjson` | `event` | Protocol Appended | Append Only | Audit Ledger |
| `sessions/<session-id>.json` | `activation` | Protocol Generated | Overwritten On Activate | Session Marker |
| `config.json` | `config` | Operator Or Agent | Mutable Configuration | Project Configuration |
| `task-state/<task-key>/gates/<gate>.json` | `gate` | Agent Authored Or Reviewer | Overwritten On Gate Satisfaction | Gate Approval Attestation |
| `task-state/<task-key>/work-state.json` | `work-state` | Protocol Managed | Atomic State Transitions | Canonical Lifecycle State |
| `task-state/<task-key>/continuity.json` | `continuity` | Agent Or Harness | Mutable Handoff Notes | Non Evidence Handoff |
| `task-state/<task-key>/execution-receipt.json` | `execution-receipt` | Protocol Compiled | Atomic Compilation | Evidence Compilation |
| `task-state/<task-key>/executions/exec-<id>.json` | `execution` | Protocol Executed | Immutable Once Written | Execution Provenance |
| `policy/rules.json` | `policy-rules` | Operator Or Agent | Mutable Configuration | Policy Specification |
| `policy/discovery.json` | `policy-discovery` | Protocol Generated | Mutable On Discovery | Discovered Policy Specification |
| `policy/baseline.json` | `policy-baseline` | Protocol Generated Or Operator | Monotonic Ratchet Down | Brownfield Baseline |
| `policy/policy.lock` | `policy-lock` | Protocol Generated | Atomic Digest Compilation | Policy Integrity Lock |
| `task-state/<task-key>/policy-snapshot.json` | `policy-snapshot` | Protocol Generated | Mutable Before Execution | Task Policy Attestation |

<!-- END FORGELOOP GENERATED: artifact-registry -->

---

## 2. Canonical Artifact Specifications

### 2.1 `task-state/<taskKey>/contract.json`

<!-- forgeloop-doc: schema=current-contract artifact=.forgeloop/task-state/<task-key>/contract.json -->

The operational task specification authored before execution begins.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:current-contract -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `objective` *(string, required, minLength: 1)*
- `assumptions` *(array<object>, optional)*
  - `value` *(string, required, minLength: 1)*
  - `reason` *(string, required, minLength: 1)*
  - `scope` *(string, required, minLength: 1)*
  - `reversible` *(boolean, required, const: true)*
  - `source` *(string, required, const: `agent-default`)*
- `deliverables` *(array<string>, required)*
- `constraints` *(array<string>, required)*
- `risks` *(array<string>, required)*
- `verification` *(array<string or requirement>, required)*
  *requirement items:*
  - `id` *(string, optional, minLength: 1)*
  - `text` *(string, required, minLength: 1)*
  - `type` *(string, optional, enum: `PRODUCT`, `VERIFICATION`, `LIFECYCLE`, `PUBLICATION`, `PRODUCTION_READINESS`)*
  - `operator` *(string, optional, enum: `SINGLE`, `ALL`)*
  - `requiredEvidenceKind` *(string, optional, enum: `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, `BLOCKED`, `HYPOTHESIS`)*
  - `lifecycleOwned` *(boolean, optional)*
  - `terminalOwned` *(boolean, optional)*
  - `mixedTerminal` *(boolean, optional)*
  - `requiredPublicationStatus` *(string, optional, enum: `committed`, `pushed`, `published`, `deployed`)*
  - `requirements` *(array<string or requirement>, optional)*
- `successCriteria` *(array<string or requirement>, required)*
  *requirement items:*
  - `id` *(string, optional, minLength: 1)*
  - `text` *(string, required, minLength: 1)*
  - `type` *(string, optional, enum: `PRODUCT`, `VERIFICATION`, `LIFECYCLE`, `PUBLICATION`, `PRODUCTION_READINESS`)*
  - `operator` *(string, optional, enum: `SINGLE`, `ALL`)*
  - `requiredEvidenceKind` *(string, optional, enum: `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, `BLOCKED`, `HYPOTHESIS`)*
  - `lifecycleOwned` *(boolean, optional)*
  - `terminalOwned` *(boolean, optional)*
  - `mixedTerminal` *(boolean, optional)*
  - `requiredPublicationStatus` *(string, optional, enum: `committed`, `pushed`, `published`, `deployed`)*
  - `requirements` *(array<string or requirement>, optional)*
- `stopConditions` *(array<string>, required)*
- `unresolvedDecisions` *(array<string>, required)*
- `sourceRefs` *(array<string>, required)*

<!-- END FORGELOOP GENERATED: schema:current-contract -->

---

### 2.2 `task-state/<taskKey>/routing-result.json`

<!-- forgeloop-doc: schema=routing-result artifact=.forgeloop/task-state/<task-key>/routing-result.json -->

The deterministic result of routing task signals against the engineering guide router.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:routing-result -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `contractFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `input` *(object, required)*
- `primary` *(string or null, required)*
- `guides` *(array<string>, required)*
- `reasons` *(object, required)*
- `excluded` *(object, required)*

<!-- END FORGELOOP GENERATED: schema:routing-result -->

---

### 2.3 `task-state/<taskKey>/preflight.json`

<!-- forgeloop-doc: schema=preflight artifact=.forgeloop/task-state/<task-key>/preflight.json -->

Readiness attestation evaluated prior to implementation.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:preflight -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `status` *(string, required, enum: `READY`, `BLOCKED`)*
- `profile` *(object, required)*
- `contract` *(object, required)*
- `routing` *(object, required)*
- `requiredGates` *(array<string>, required)*
- `satisfiedGates` *(array<string>, required)*
- `errors` *(array<object>, required)*
- `fingerprints` *(object, optional)*
- `sources` *(object, optional)*
- `policy` *(object, optional)*

<!-- END FORGELOOP GENERATED: schema:preflight -->

---

### 2.4 `sources.json`

<!-- forgeloop-doc: schema=source-registry artifact=.forgeloop/sources.json -->

Discovered repository facts, platforms, runtimes, and dependencies.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:source-registry -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `sources` *(object, required)*

<!-- END FORGELOOP GENERATED: schema:source-registry -->

---

### 2.5 `task-state/<taskKey>/events.ndjson`

<!-- forgeloop-doc: schema=event artifact=.forgeloop/task-state/<task-key>/events.ndjson -->

The append-only cryptographic event ledger. Each line is a single JSON event object. Records authoritative chronological events including lifecycle milestones (`TASK_RECEIVED`, `CONTRACT_VALIDATED`, `ROUTE_VALIDATED`, `PREFLIGHT_READY`, `EXECUTION_STARTED`, `VERIFICATION_STARTED`), evidence-backed diagnoses (`DIAGNOSIS_RECORDED`), and decision settlement criteria (`DECISION_CRITERION_RECORDED`).

#### Canonical Line Fields

<!-- BEGIN FORGELOOP GENERATED: schema:event -->

- `seq` *(integer, required, minimum: 1)*
- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `event` *(string, required, minLength: 1)*
- `at` *(string, required, minLength: 1)*
- `fingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `previousHash` *(string or null, required)*
- `hash` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `details` *(object, optional)*

<!-- END FORGELOOP GENERATED: schema:event -->

---

### 2.6 `sessions/<sessionId>.json`

<!-- forgeloop-doc: schema=activation artifact=.forgeloop/sessions/<session-id>.json -->

The active harness session marker created by `forgeloop activate`.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:activation -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `sessionId` *(string, required, minLength: 1)*
- `activationMarker` *(string, required, minLength: 1)*
- `createdAt` *(string, required, minLength: 1)*

<!-- END FORGELOOP GENERATED: schema:activation -->

---

### 2.7 `config.json`

<!-- forgeloop-doc: schema=config artifact=.forgeloop/config.json -->

Local ForgeLoop configuration settings and policy bindings.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:config -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `complianceMode` *(string, required, enum: `advisory`, `standard`, `strict`)*
- `policy` *(string, optional, minLength: 1)*
- `requiredGates` *(array<string>, optional)*
- `requiredEvidence` *(array<string>, optional)*

<!-- END FORGELOOP GENERATED: schema:config -->

---

### 2.8 `task-state/<taskKey>/gates/<gate>.json`

<!-- forgeloop-doc: schema=gate artifact=.forgeloop/task-state/<task-key>/gates/<gate>.json -->

Pre-implementation gate approval artifact recording decisions, bound artifact hashes, and evidence.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:gate -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `gate` *(string, required, minLength: 1)*
- `status` *(string, required, enum: `satisfied`, `unverified`, `blocked`)*
- `requiredBy` *(array<string>, required)*
- `artifacts` *(array<object>, required)*
  - `path` *(string, required, minLength: 1)*
  - `sha256` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `decisions` *(array<string>, required)*
- `unknowns` *(array<string>, required)*
- `approvedAssumptions` *(array<string>, required)*
- `evidence` *(array<object>, required)*

<!-- END FORGELOOP GENERATED: schema:gate -->

---

### 2.9 `task-state/<taskKey>/work-state.json`

<!-- forgeloop-doc: schema=work-state artifact=.forgeloop/task-state/<task-key>/work-state.json -->

The canonical, authoritative lifecycle work state. Represents current checkpoint and resume state (`phase`, `checks`, `verificationCycle`, `lastUpdated`). Note: `diagnosedHypothesis` is maintained as a backward-compatibility projection of the latest diagnosis from `events.ndjson`.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:work-state -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `routeFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `repositoryFingerprint` *(object, required)*
  - `branch` *(string or null, required)*
  - `head` *(string or null, required)*
- `phase` *(string, required, enum: `RECEIVED`, `DISCOVERING`, `CONTRACT_READY`, `ROUTED`, `DESIGNING`, `PLANNED`, `EXECUTING`, `VERIFYING`, `DIAGNOSING`, `CORRECTING`, `REVIEWING`, `COMPLETE`, `BLOCKED`)*
- `selectedGuides` *(array<string>, required)*
- `requiredGates` *(array<string>, optional)*
- `satisfiedGates` *(array<string>, optional)*
- `complianceMode` *(string, optional, enum: `advisory`, `standard`, `strict`)*
- `completedSteps` *(array<string>, required)*
- `pendingSteps` *(array<string>, required)*
- `requiredArtifacts` *(array<object>, optional)*
  - `path` *(string, required, minLength: 1)*
  - `sha256` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `checks` *(array<object>, required)*
- `failures` *(array<object>, required)*
- `blockers` *(array<object>, required)*
- `lastUpdated` *(string, required, minLength: 1)*
- `previousPhase` *(string, optional)*
- `diagnosedHypothesis` *(string, optional, minLength: 1)*
- `verificationEvidence` *(array<object>, optional)*
- `evidenceCoverage` *(array<object>, optional)*
- `publicationStatus` *(string, optional, enum: `not-published`, `local-only`, `committed`, `pushed`, `published`, `deployed`)*
- `verificationCycle` *(integer, optional, minimum: 1)*
- `lastCompletionAttempt` *(object, optional)*
  - `status` *(string, required, const: `REJECTED`)*
  - `reasonCodes` *(array<string>, required)*
  - `missingRequirementIds` *(array<string>, required)*
  - `verificationCycle` *(integer, required, minimum: 1)*
  - `stateFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
  - `receiptFingerprint` *(string or null, optional)*
  - `timestamp` *(string, required, minLength: 1)*

<!-- END FORGELOOP GENERATED: schema:work-state -->

---

### 2.10 `task-state/<taskKey>/continuity.json`

<!-- forgeloop-doc: schema=continuity artifact=.forgeloop/task-state/<task-key>/continuity.json -->

Cross-harness non-evidence handoff notes.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:continuity -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1, maxLength: 128)*
- `workStateFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `phase` *(string, required, minLength: 1)*
- `verificationCycle` *(integer, optional, minimum: 1)*
- `repositoryFingerprint` *(object, required)*
  - `branch` *(string or null, required)*
  - `head` *(string or null, required)*
- `updatedAt` *(string, required, minLength: 1)*
- `currentFocus` *(workItem, optional)*
  - `id` *(string, required, minLength: 1, maxLength: 128)*
  - `summary` *(string, required, minLength: 1, maxLength: 1000)*
- `remainingWork` *(array<workItem>, required, maxItems: 40)*
  - `id` *(string, required, minLength: 1, maxLength: 128)*
  - `summary` *(string, required, minLength: 1, maxLength: 1000)*
- `knownIssues` *(array<workItem>, required, maxItems: 40)*
  - `id` *(string, required, minLength: 1, maxLength: 128)*
  - `summary` *(string, required, minLength: 1, maxLength: 1000)*
- `changedAreas` *(array<string>, required, maxItems: 80)*
- `inspectFirst` *(array<string>, required, maxItems: 40)*
- `resumeNote` *(string, optional, minLength: 1, maxLength: 2000)*

<!-- END FORGELOOP GENERATED: schema:continuity -->

---

### 2.11 `task-state/<taskKey>/execution-receipt.json`

<!-- forgeloop-doc: schema=execution-receipt artifact=.forgeloop/task-state/<task-key>/execution-receipt.json -->

The cryptographically compiled verification receipt required for task completion.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:execution-receipt -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `contractFingerprint` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `routeFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `stateFingerprint` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `verificationCycle` *(integer, optional, minimum: 1)*
- `status` *(string, optional, enum: `in-progress`, `complete`, `blocked`, `complete-with-concerns`)*
- `taskStatus` *(string, optional, enum: `in-progress`, `complete`, `blocked`, `incomplete`)*
- `verificationStatus` *(string, optional, enum: `valid`, `invalid`, `not-verified`, `blocked`)*
- `publicationStatus` *(string, optional, enum: `not-published`, `local-only`, `committed`, `pushed`, `published`, `deployed`)*
- `productionReadiness` *(string, optional, enum: `ready`, `not-verified`, `blocked`)*
- `selectedGuides` *(array<string>, required)*
- `changedPaths` *(array<string>, required)*
- `checks` *(array<object>, required)*
- `evidence` *(array<object>, optional)*
  - `schemaVersion` *(number, optional, const: 1)*
  - `kind` *(string, required, enum: `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, `BLOCKED`)*
  - `source` *(string, required, minLength: 1)*
  - `result` *(string, required, minLength: 1)*
  - `verificationCycle` *(integer, optional, minimum: 1)*
  - `details` *(object, optional)*
- `evidenceCoverage` *(array<object>, optional)*
- `review` *(object, required)*
- `limitations` *(array<string>, required)*
- `publication` *(object, required)*
  - `committed` *(boolean, required)*
  - `pushed` *(boolean, required)*
  - `pullRequest` *(string or null, required)*
  - `deployed` *(boolean, required)*

<!-- END FORGELOOP GENERATED: schema:execution-receipt -->

---

### 2.12 `task-state/<taskKey>/executions/exec-<id>.json`

<!-- forgeloop-doc: schema=execution artifact=.forgeloop/task-state/<task-key>/executions/exec-<id>.json -->

Attested command execution provenance artifact generated by `forgeloop run-check`.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:execution -->

- `schemaVersion` *(number, required, const: 1)*
- `protocolVersion` *(number, required, const: 1)*
- `executionId` *(string, required, minLength: 1)*
- `taskId` *(string, required, minLength: 1)*
- `checkId` *(string, required, minLength: 1)*
- `requirement` *(string, required, minLength: 1)*
- `verificationCycle` *(integer, required, minimum: 1)*
- `kind` *(string, required, const: `COMMAND_EXECUTION`)*
- `argv` *(array<string>, required, minItems: 1)*
- `cwd` *(string, required, minLength: 1)*
- `resolution` *(object, required)*
  - `resolutionMode` *(string, required, minLength: 1)*
  - `mayInstall` *(boolean, required)*
  - `installer` *(string or null, required)*
  - `tool` *(string or null, required)*
- `dispatch` *(object, optional)*
  - `kind` *(string, optional, minLength: 1)*
  - `scriptName` *(string, optional, minLength: 1)*
- `startedAt` *(string, required, minLength: 1)*
- `finishedAt` *(string, required, minLength: 1)*
- `status` *(string, required, enum: `passed`, `failed`)*
- `exitCode` *(integer or null, required)*
- `durationMs` *(integer, optional, minimum: 0)*
- `termination` *(string, optional, enum: `exit`, `signal`, `timeout`, `spawn-error`)*
- `signal` *(string or null, optional)*
- `stdoutSha256` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `stderrSha256` *(string, optional, pattern: `^[a-f0-9]{64}$`)*
- `stdoutBytes` *(integer, optional, minimum: 0)*
- `stderrBytes` *(integer, optional, minimum: 0)*
- `outputTruncated` *(boolean, optional)*

<!-- END FORGELOOP GENERATED: schema:execution -->

---

### 2.13 `task-state/<taskKey>/task.json`

<!-- forgeloop-doc: schema=task-descriptor artifact=.forgeloop/task-state/<task-key>/task.json -->

Canonical task descriptor declaring task identity, key, timestamps, and write claims.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:task-descriptor -->

- `schemaVersion` *(integer, required, const: 1)*
- `protocolVersion` *(integer, required, const: 1)*
- `taskId` *(string, required, minLength: 1)*
- `taskKey` *(string, required, pattern: `^[a-f0-9]{64}$`)*
- `createdAt` *(string, required)*
- `updatedAt` *(string, required)*
- `writeClaims` *(array<string>, required)*

<!-- END FORGELOOP GENERATED: schema:task-descriptor -->

---

### 2.14 `policy/rules.json`

<!-- forgeloop-doc: schema=policy-rules artifact=.forgeloop/policy/rules.json -->

Repository-level executable policy rules declaring verification constraints.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:policy-rules -->

- `schemaVersion` *(number, required, const: 1)*
- `rules` *(array<object>, required)*
  - `id` *(string, required, minLength: 1)*
  - `severity` *(string, required, enum: `HIGH`, `MEDIUM`, `LOW`, `INFO`)*
  - `source` *(string, required, enum: `builtin`, `discovered`, `project`)*
  - `blocking` *(boolean, required)*
  - `why` *(string, required, minLength: 1)*
  - `fix` *(string, required, minLength: 1)*
  - `confidence` *(string, optional, enum: `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)*
  - `scope` *(object, optional)*
    - `includes` *(array<string>, optional)*
    - `excludes` *(array<string>, optional)*
  - `check` *(object, required)*
    - `type` *(string, required, minLength: 1)*
    - `adapter` *(string, optional)*
    - `command` *(array<string>, optional)*
    - `threshold` *(number, optional)*
    - `parameters` *(object, optional)*

<!-- END FORGELOOP GENERATED: schema:policy-rules -->

---

### 2.15 `policy/discovery.json`

<!-- forgeloop-doc: schema=policy-discovery artifact=.forgeloop/policy/discovery.json -->

Automated non-interactive discovery report recording inferred architecture, conventions, and confidence scores.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:policy-discovery -->

- `schemaVersion` *(number, required, const: 1)*
- `languages` *(array<string>, required)*
- `testing` *(object, required)*
  - `detected` *(boolean, required)*
  - `command` *(array<string>, optional)*
  - `framework` *(string, optional)*
  - `confidence` *(string, required, enum: `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)*
- `linting` *(object, required)*
  - `detected` *(boolean, required)*
  - `command` *(array<string>, optional)*
  - `tool` *(string, optional)*
  - `confidence` *(string, required, enum: `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)*
- `architecture` *(object, required)*
  - `value` *(string,null, optional)*
  - `confidence` *(string, required, enum: `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)*
  - `enforcement` *(string, required, enum: `BLOCKING`, `ADVISORY`, `NONE`)*
- `discoveredRules` *(array<object>, required)*

<!-- END FORGELOOP GENERATED: schema:policy-discovery -->

---

### 2.16 `policy/baseline.json`

<!-- forgeloop-doc: schema=policy-baseline artifact=.forgeloop/policy/baseline.json -->

Brownfield policy baseline recording tolerated legacy violations by cryptographic fingerprint.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:policy-baseline -->

- `schemaVersion` *(number, required, const: 1)*
- `createdAt` *(string, required, minLength: 1)*
- `entries` *(array<object>, required)*
  - `ruleId` *(string, required, minLength: 1)*
  - `fingerprints` *(array<string>, required)*
  - `reviewBy` *(string, optional)*
  - `details` *(array<object>, optional)*

<!-- END FORGELOOP GENERATED: schema:policy-baseline -->

---

### 2.17 `policy/policy.lock`

<!-- forgeloop-doc: schema=policy-lock artifact=.forgeloop/policy/policy.lock -->

Cryptographic policy digest lock securing effective rules and baseline state.

The lock protects the **effective policy** — built-in rules plus discovered
rules plus project rules/overrides, combined with the baseline. `algorithm`,
`digest`, `rulesDigest`, and `baselineDigest` all participate in lock integrity
validation; a disagreement with the current effective policy produces
`E_POLICY_LOCK_MISMATCH`. `capturedAt` is informational metadata only — it is
not part of semantic policy identity, and changing it alone does not represent
a policy change. A missing or malformed lock fails closed rather than being
silently ignored.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:policy-lock -->

- `schemaVersion` *(number, required, const: 1)*
- `algorithm` *(string, required, const: `sha256`)*
- `digest` *(string, required, minLength: 1)*
- `rulesDigest` *(string, required)*
- `baselineDigest` *(string, required)*
- `capturedAt` *(string, optional)*

<!-- END FORGELOOP GENERATED: schema:policy-lock -->

---

### 2.18 `task-state/<taskKey>/policy-snapshot.json`

<!-- forgeloop-doc: schema=policy-snapshot artifact=.forgeloop/task-state/<task-key>/policy-snapshot.json -->

Task-scoped immutable snapshot of effective policy captured during preflight to detect policy drift.

A snapshot binds the task to the policy that was authorized at activation:
`policyDigest`, the effective `rules`, semantic `baseline` entries, and
`baselineDigest`. Later policy changes are classified by semantic diff as
`TIGHTEN`, `NEUTRAL`, `WEAKEN`, or `UNKNOWN`. Modern snapshots carry the full
semantic baseline; legacy snapshots without baseline state leave baseline
comparison explicitly `UNKNOWN` rather than assuming an empty baseline.

#### Canonical Fields

<!-- BEGIN FORGELOOP GENERATED: schema:policy-snapshot -->

- `schemaVersion` *(number, required, const: 1)*
- `policyDigest` *(string, required, minLength: 1)*
- `rules` *(array<string,object>, required)*
- `baseline` *(object, optional)*
- `baselineDigest` *(string, optional)*
- `capturedAt` *(string, optional)*

<!-- END FORGELOOP GENERATED: schema:policy-snapshot -->
