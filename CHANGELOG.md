# Changelog

## Unreleased

### Fixed

- Verification execution now rejects contradictory isolation mode,
  filesystem-write, and network guarantees before evidence persistence.

- Verification execution now has an explicit trusted adapter boundary with
  disposable project/system isolation metadata, separate protocol and
  execution roots, bounded output provenance, and fail-closed handling when
  the required isolation capability is unavailable.

- Post-#101 durable-action corrections: trusted `COMMITTED` reconciliation now
  replays exactly once (the reconciled `ACTION_COMMIT_RECORDED` mirror is a
  validated same-revision corroboration, never a second transition, and forged
  mirrors invalidate the ledger); action verification requires an independent
  passed execution covering the action's exact immutable requirement; new
  required-for-completion actions must declare a non-empty requirement (legacy
  artifacts remain readable but classify UNTRUSTED); trusted reconciliation
  authority now propagates through the programmatic command executor and MCP
  provider boundaries; readiness and audit validate bound approval
  fingerprints for `REQUIRE_APPROVAL` authorizations; public provenance
  metadata now matches actual behavior (`CALLER_REPORTED` /
  `EXTERNAL_OBSERVED`); `executeDurableAction()` returns canonical
  `authorization` evidence.

- Completion-recovery fingerprint deadlock: a `REVIEWING` task whose persisted
  evidence-only rejection snapshot no longer matches the live checkpoint (after
  repository drift or a recovery/resume cycle) could not reach closure through
  any sanctioned path. `reconcile-closure` and the `REVIEWING -> VERIFYING`
  recovery transition now rebind the rejection append-only when — and only when
  — the logical fields (`verificationCycle`, sorted `reasonCodes`, sorted
  `missingRequirementIds`) are identical between work-state and the latest
  matching ledger rejection; the rebound `COMPLETION_REJECTED` event carries the
  current fingerprints and references the superseded snapshot via
  `reboundFromStateFingerprint`. Logical differences still fail closed.
- Checkpoint restoration is chronology-aware: when `preflight` recreates a
  missing work-state from preserved contract/route artifacts, the resume phase
  is derived from the validated ledger milestones instead of always restarting
  at `ROUTED`, so restored tasks never append duplicate non-repeatable lifecycle
  milestones such as `EXECUTION_STARTED`.
- Mid-lifecycle preflight refresh: a `PREFLIGHT_READY` re-recorded after later
  execution/verification milestones no longer invalidates the ledger as
  out-of-lifecycle-order; re-readiness keeps its prerequisite and compatibility
  guards while allowing legitimate policy/contract refresh cycles.
- Preflight re-readiness after a blocked cycle: an append-only lifecycle may
  contain a `PREFLIGHT_READY` that was superseded by a later `PREFLIGHT_BLOCKED`
  outcome (contract evolution, added gate requirement). The compatibility check
  now binds to the latest preflight outcome, so resolving the blocked preflight
  appends a fresh `PREFLIGHT_READY` with current details; a READY refresh whose
  details differ without an intervening BLOCKED outcome is still refused, and
  `PREFLIGHT_READY` joined the repeatable milestones so the rebound event keeps
  the ledger valid while milestone-order guards remain in force.

## 1.6.0 - 2026-08-24

### Fixed

- Structured diagnostic cases now satisfy every legacy diagnosis gate: one
  canonical resolver (`diagnostic-projection.js`) backs `DIAGNOSING ->
  CORRECTING`, `CORRECTING -> VERIFYING`, `next`, and `progress`; structured-only
  tasks no longer hit `E_DIAGNOSIS_REQUIRED` and no duplicate legacy event is
  written.
- Hypothesis dispositions validate against an authoritative append-only state
  projection (`hypothesis-projection.js`) using the canonical transition table;
  terminal states fail closed instead of resetting to `OPEN`.
- `inspect --task` reads the selected task's raw work state (task-isolated) and
  feeds raw state (not the classified wrapper) to progress evaluation; human
  output renders a full task inspection report.
- Trace correctness: check-attempt cardinality is ledger-primary with
  deterministic deduplication against state checkpoints; phase chronology is
  reconstructed forward (`RECEIVED`..`COMPLETE`) including `VERIFICATION_STARTED`
  and derived `DIAGNOSING`/`CORRECTING`; the phantom
  `VERIFICATION_STARTED_PLACEHOLDER` is gone; diagnostic revision chains are
  revalidated at read time.
- `trace.failureSignatures` / `failureSurfaces` are populated from the canonical
  failure-analysis projectors and reflection consumes them instead of rebuilding;
  per-cycle signature sets are real.
- Information Gain v2 is computed centrally (`information-gain.js`,
  `information-gain-projection.js`) for progress/reflect/next/inspect/continuity;
  `STALLED` is reachable; semantic noise never counts as gain.
- Evidence hardening: structured cases require >=1 hypothesis, observation
  evidence must resolve in the active cycle, `VERIFICATION_FAILURE` cases must
  bind failed/blocked active-cycle evidence.
- Continuity `doNotRepeat` requires semantic repetition plus two completed
  post-intervention verification cycles plus unchanged failure surface
  (repetition alone is not non-informative).
- Capability advertising aligned via additive
  `features.observabilityStability`; `E_TRACE_SNAPSHOT_INCONSISTENT` and all
  diagnosis/progress codes registered as stable public error codes.
- Information Gain v2 is single-source: one authoritative per-cycle cycle
  analysis computes all dimensions before `effectiveGain`; no consumer
  recomputes or post-mutates gain truth; semantic noise (IDs, timestamps,
  ordering) never creates gain or false hypothesis elimination.
- Successful verification cycles are projected explicitly as `surface: []`,
  enabling deterministic full-recovery classification of interventions as
  `IMPROVED`.
- `hypotheses.minItems = 1` is enforced identically by the JSON schema, runtime
  validator, event-ledger validation, and the record-diagnosis command path.
- `record-intervention` reports `repeatedSemanticIntervention` with retrospective
  `effectiveness: "PENDING"` instead of claiming `without gain` before any
  later verification exists.
- Continuity `diagnosticContext.activeFailureSignatures` now carries canonical
  failure-signature hashes scoped to the active cycle, with requirement names
  exposed separately via `activeFailedRequirements`.
- Package metadata synchronized: `package.json` and `package-lock.json` both
  identify 1.6.0.
- Unified structured-diagnostic stall semantics across phase, progress,
  reflection, next-action, and task inspection; all meaningful Information
  Gain v2 dimensions, including new observations, contributors, and semantic
  hypothesis elimination, now participate in effectiveGain. Stall is fail-fast,
  recoverable by meaningful new diagnostic information, and oscillation keeps
  the more specific INTRODUCE_NEW_OBSERVATION guidance.

### Added

- Unified observability and diagnostic intelligence (Protocol v1 additive):
  read-only `history`, `trace`, and `reflect` commands reconstructed from the
  canonical event ledger through a shared snapshot/trace projection core
  (`buildTaskSnapshot`, `buildTaskTrace`); structured diagnostic cases with
  observations, multifactor contributors, multiple falsifiable hypotheses,
  semantic fingerprints, and append-only revision chains via
  `record-diagnosis --file`; `record-intervention` and
  `record-hypothesis-disposition` mutation commands; information-gain v2
  dimensions, failure signatures, failure surfaces, strategy fingerprints, and
  oscillation detection; task-level `inspect --task` additive
  `taskInspection` section; continuity `diagnosticContext` with bounded
  `doNotRepeat`; `next` diagnostic guidance (`REQUIRE_NEW_DIAGNOSTIC_INFORMATION`,
  `INTRODUCE_NEW_OBSERVATION`, `RECORD_INTERVENTION`) without changing existing
  actions; `protocol-info` capability advertising; three new public schemas
  (`diagnostic-case`, `intervention`, `hypothesis-disposition`) and new stable
  error codes. Legacy single-hypothesis diagnosis remains fully valid.

## 1.5.0 - 2026-08-23

### Added

- Transport-neutral programmatic integration API v1 at
  `@cassiomc1/forgeloop/integration`: structured command executors and runtime,
  shared semantic input validation, invocation-level risk classification, and
  canonical integration resources including task/ownership derived exclusively
  from the validated claim resolver.
- Separate local MCP package (`@cassiomc1/forgeloop-mcp`, official SDK):
  deterministic tool/resource catalogs generated from canonical metadata,
  immutable project root, explicit taskId on task-aware mutations, launch-level
  capability gates (external execution, maintenance, recovery, legacy repair,
  force), and no generic shell.
- Optional stateless HTTP transport (`forgeloop-mcp-http`, PR12 hardened):
  strict modern MCP 2026 only (legacy traffic rejected), loopback-only binding
  (non-loopback refused with `E_MCP_REMOTE_NOT_SUPPORTED`), DNS-rebinding
  protection, bounded request bodies (413), header/request/keepalive timeouts,
  in-flight ceiling (503 `E_MCP_HTTP_BUSY`), POST-only, and no session-based
  authority.
- Hardening: bundle is MAINTENANCE-gated; launch `maxExecutionTimeMs` is
  enforced on every external-execution invocation; project roots resolve
  through canonical CLI semantics (symlinks rejected); integration input and
  output limits bound the transport surface; client-visible errors redact
  secret-shaped values while preserving canonical codes; a real
  `forgeloop_capabilities` tool reports versions, features, policy, and
  resources in every server mode.
- Closing pass: structured MCP input is byte-bounded
  (`E_MCP_INPUT_TOO_LARGE`); output bounds apply to command tools,
  `forgeloop_capabilities`, and every integration resource through one
  canonical helper (`E_MCP_RESULT_TOO_LARGE`); capabilities reports the real
  installed ForgeLoop core version; the documentation manifest
  `packaged:true` set is invariant against the core tarball; HTTP timeout
  bounds are observable and concurrency shedding (503 `E_MCP_HTTP_BUSY`) is
  deterministically proven; stdio/HTTP catalog parity is verified at the
  transport level across representative modes.
- MCP output bounds now measure the exact UTF-8 serialization transmitted,
  including pretty-printed tool/resource text; unrelated serialization failures
  are not misclassified as output overflow.

- `forgeloop task-repair-legacy-recovery`: migrates one recognized legacy `OPERATOR_RECOVERY_RECORDED` boundary event (no `recoveryId`) into the modern durable recovery representation via an append-only `LEGACY_RECOVERY_MIGRATION_RECORDED` tail event plus a transactional `recovery.json`; the original ledger event is never modified, ambiguous or tampered evidence fails closed, and ordinary mutation stays blocked until `task-resume`.
- Durable task recovery state in `recovery.json`, explicit `task-resume` claim reacquisition, and recovery-aware `forgeloop next` command specifications.
- A canonical validated claim-state resolver, deterministic recovery-history classifier, public ownership/claims-lock errors, protocol capability metadata, tamper conformance corpus, and invariant coverage.

### Changed

- `task-recover` accepts only `STALE` and `ABANDONED`, preserves lifecycle evidence, and records caller acknowledgement without presenting it as host attestation.
- Recovered tasks reject ordinary mutations until `task-resume` reacquires conflict-free claims under the project claims lock.
- Recovered tasks are excluded from implicit mutation-active selection; `TASK_RECOVERY_RESUMED` is meaningful activity and prevents immediate abandoned reclassification.
- Task and project claim locks distinguish absent, live, stale, unknown, and corrupt evidence; `task-resume` and project claim acquisition CAS-settle only unchanged stale leases.
- `COMPLETE` tasks report mutation disabled, and task contexts expose only the canonical `.forgeloop/locks/<taskKey>.lock` path.

### Security and reliability

- Legacy recovery repair CAS-settles only unchanged stale task locks; live, unknown, and corrupt locks are refused with the lock preserved.
- `alreadyRepaired` requires a fully valid canonical recovery relationship, not just matching identifiers.
- Helper claim APIs (`effectiveTaskClaims`/`taskClaimProjection`) no longer infer completion release from phase alone.
- Claim-state classification is side-effect free over the collected evidence.
- Legacy recovery migration v1 accepts only CALLER_ACKNOWLEDGED authority.
- COMPLETE task claim release now requires canonical lifecycle/ledger proof; manually or inconsistently terminal state fails closed and retains historical claim ownership.
- Task lock classification now rejects incomplete owner identity metadata as UNKNOWN rather than inferring live or stale ownership.
- Implicit task selection distinguishes read-only inspection from mutation.
- Claim-state and conflict inspection reuse validated ownership evidence within one snapshot while preserving TOCTOU revalidation boundaries.
- Claim ownership now requires a validated relationship between the task descriptor, work state, recovery artifact, and complete append-only recovery history before recovery can release claims.
- Fake, missing, corrupt, deleted, or mismatched recovery state fails closed, preserves every provable historical claim, and cannot restore mutation authority.
- Unhealthy task namespaces block claim acquisition when ownership cannot be proven; ordinary mutation and portable bundle export also reject inconsistent ownership.
- Stale task and project claim locks are released only when the observed lock ID, heartbeat, and owner instance remain unchanged, and recovery preconditions are revalidated under deterministic lock ordering.

### Compatibility

- The repository core package is now `1.5.0`; ForgeLoop protocol remains `1`; Integration API remains `1`. `protocol-info` advertises validated claim recovery version 1 and `features.integrationApi` version 1.
- A project containing active `task-recovery` schema v1 state still requires ForgeLoop `>=1.4.0`; older readers that do not understand validated recovery ownership must refuse the project rather than infer claims from `task.json` alone.
- The MCP package (`@cassiomc1/forgeloop-mcp`) requires ForgeLoop `>=1.5.0 <2`.
- Repository implementation state is separate from external publication; no npm publication, tag, or release is performed by these tasks.
- The ledger continues to write `OPERATOR_RECOVERY_RECORDED` for PR #66 reader compatibility, while its authority is explicitly `CALLER_ACKNOWLEDGED`; readers also accept the neutral `TASK_RECOVERY_RECORDED` name.
- `--operator-authorized` remains a deprecated alias for `--acknowledge-recovery` and does not create host authority. The standalone CLI does not self-issue `HOST_ATTESTED` recovery grants.
- Release preparation is local only; no package publication, tag, or release is performed by this implementation task.

## 1.3.0 - 2026-08-20

### Added

- Transaction journaling for safer multi-artifact protocol mutations.
- Monotonic work-state revision tracking and stale-writer conflict detection.
- Serialized event ledger appends with stronger concurrency guarantees.
- Lease-aware task locking and task lock inspection.
- Bounded verification command execution with timeout and termination metadata.
- Public `protocol-info` compatibility handshake and protocol migration support.
- Expanded protocol conformance scenarios, golden schema fixtures, and scale tests.
- Package smoke validation, executable documentation examples, and documentation health reporting.
- Contributor, security, changelog, issue, and pull-request governance files.

### Changed

- Strengthened execution, work-state, event, lock, completion, diagnosis, migration, and resumability behavior.
- Expanded CLI command metadata and documentation generation.
- Improved troubleshooting, CLI reference, artifact reference, continuity, protocol integration, system design, and execution-state documentation.
- Strengthened GitHub Actions coverage for package validation and ForgeLoop auditing.

### Compatibility

- npm package version advances to `1.3.0`.
- ForgeLoop remains protocol-version compatible with the supported v1 contract unless `forgeloop protocol-info --json` reports otherwise.
- Existing legacy compatibility and migration paths remain covered by regression tests.

### Security and reliability

- Protocol mutations gain stronger crash and concurrency protection.
- Verification commands gain bounded termination behavior.
- Task locking gains lease and staleness semantics.
- Release and package validation gain additional smoke and documentation checks.
