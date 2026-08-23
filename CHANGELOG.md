# Changelog

## Unreleased

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
- Optional stateless HTTP transport (`forgeloop-mcp-http`, PR12): loopback by
  default with explicit non-loopback opt-in, DNS-rebinding protection, bounded
  request bodies, POST-only, and no session-based authority.

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

- Package version advances to `1.4.0` while protocol version remains `1`; `protocol-info` advertises validated claim recovery version 1.
- A project containing active `task-recovery` schema v1 state requires ForgeLoop `>=1.4.0`; older readers that do not understand validated recovery ownership must refuse the project rather than infer claims from `task.json` alone.
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
