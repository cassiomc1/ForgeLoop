# Changelog

## Unreleased

### Added

- Durable task recovery state in `recovery.json`, explicit `task-resume` claim reacquisition, and recovery-aware `forgeloop next` command specifications.
- Recovery schema, artifact/event consistency validation, effective-claim projections, and concurrency regression coverage.

### Changed

- `task-recover` accepts only `STALE` and `ABANDONED`, preserves lifecycle evidence, and records caller acknowledgement without presenting it as host attestation.
- Recovered tasks reject ordinary mutations until `task-resume` reacquires conflict-free claims under the project claims lock.
- Lock and freshness classification now distinguish absent, stale, unknown, and corrupt evidence and fail closed where ownership cannot be proven.

### Security and reliability

- Recovery claim release is transactionally bound to an append-only event and durable tombstone; event-tail eviction cannot reactivate claims.
- Stale task locks are released only when the observed lock ID, heartbeat, and owner instance remain unchanged, and recovery preconditions are revalidated under deterministic lock ordering.

### Compatibility

- Protocol version remains `1`; `protocol-info` advertises the new `task-recovery` schema and `task-resume` command. Consumers that interpret recovered claims must use a package version containing this change.
- The ledger continues to write `OPERATOR_RECOVERY_RECORDED` for PR #66 reader compatibility, while its authority is explicitly `CALLER_ACKNOWLEDGED`; readers also accept the neutral `TASK_RECOVERY_RECORDED` name.
- `--operator-authorized` remains a deprecated alias for `--acknowledge-recovery` and does not create host authority. The standalone CLI does not self-issue `HOST_ATTESTED` recovery grants.
- No package version bump or npm publication is part of this unreleased implementation.

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
