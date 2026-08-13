# Execution state and resume protocol

Compatible agents may persist a handoff checkpoint at:

```text
.forgeloop/work-state.json
```

The file is local, ignored by Git, schema-versioned, and never a replacement
for the manifest or the target project profile (installed as
`.forgeloop/kit/PROJECT_PROFILE.md`). It contains no secrets and is untrusted
on read.

## Shape

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "taskId": "task-123",
  "contractFingerprint": "lowercase-sha256",
  "repositoryFingerprint": { "branch": "main", "head": "commit-sha" },
  "phase": "VERIFYING",
  "selectedGuides": ["clean", "test"],
  "completedSteps": ["discovery", "implementation"],
  "pendingSteps": ["verification", "review"],
  "requiredArtifacts": [
    { "path": "src/api/auth.js", "sha256": "lowercase-sha256" }
  ],
  "checks": [],
  "failures": [],
  "blockers": [],
  "verificationEvidence": [],
  "lastUpdated": "2026-08-11T12:00:00.000Z"
}
```

The CLI validates the protocol version, phase enum, guide IDs, fingerprints,
transition, status-specific evidence, bounded strings, and secret-free shape.
`COMPLETE` requires verification evidence. `BLOCKED` requires a blocker
category and evidence. `CORRECTING` requires a diagnosed hypothesis.

## Atomicity and stale state

State writes validate the complete JSON value, write a unique temporary file,
and rename it into place. The host filesystem's rename guarantee is the
atomicity boundary; no database or remote state is involved. A truncated,
malformed, or secret-bearing file is invalid and is never resumed silently.

Before resuming, compare:

- the task contract fingerprint;
- the Git branch and HEAD when the target is a Git checkout;
- the protocol version;
- required artifacts and assumptions recorded by the task.

Any material difference produces `REVALIDATION_REQUIRED`. A non-Git target
reports that branch/HEAD drift is not verifiable. Cheap checks may be rerun,
but a completed destructive or publication action is never rerun automatically.

The current contract is compared only when its JSON file is supplied:

```bash
forgeloop status --contract-file .forgeloop/current-contract.json --json
```

Without that file, contract comparison is `NOT_VERIFIED`; the status does not
claim full freshness. Required artifact hashes report missing or changed files.
An optional age threshold may recommend cheap verification with
`CHECKPOINT_OLD` without changing a fresh result.

`inspect`, `status`, and `validate-protocol` use the same derived freshness
classifier. Protocol validation can be run against the current route, state,
receipt, and contract artifacts:

```bash
forgeloop validate-protocol \
  --route-file .forgeloop/routing-result.json \
  --state-file .forgeloop/work-state.json \
  --receipt-file .forgeloop/execution-receipt.json \
  --contract-file .forgeloop/current-contract.json \
  --json
```

When delegation is in scope, repeat `--task-brief <path>` and
`--delegated-result <path>` for the matching handoff artifacts. If those inputs
are omitted, `validate-protocol` reports `INCOMPLETE` because delegation
conformance was not supplied; this is distinct from a local `complete` result.

`validate-protocol` reports `STALE` when the current repository fingerprint,
contract, or required-artifact fingerprints require revalidation. Its JSON
result exposes the comparison values, reasons, and warnings; the human output
shows the same evidence. The persisted work-state file remains schema-compatible
and never stores derived `status`, `stale`, or `fresh` fields.

State reports use the shared evidence kinds `OBSERVED`, `INFERRED`,
`NOT_VERIFIED`, and `BLOCKED`. A parse failure is structured as `INVALID` and
is never resumed silently.

## Commands

```bash
forgeloop status
forgeloop status --json
forgeloop validate-state
forgeloop validate-state --json
forgeloop clear-state
```

`status` explains whether state is absent, fresh, or requires revalidation.
`validate-state` performs schema and semantic checks without mutation.
`clear-state` affects only `.forgeloop/work-state.json` and prints the exact
relative path it removed; it never deletes the directory, manifest, or project
files.
