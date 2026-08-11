# Execution state and resume protocol

Compatible agents may persist a handoff checkpoint at:

```text
.mdfiles/work-state.json
```

The file is local, ignored by Git, schema-versioned, and never a replacement
for the manifest or `PROJECT_PROFILE.md`. It contains no secrets and is
untrusted on read.

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

## Commands

```bash
mdfiles status
mdfiles status --json
mdfiles validate-state
mdfiles validate-state --json
mdfiles clear-state
```

`status` explains whether state is absent, fresh, or requires revalidation.
`validate-state` performs schema and semantic checks without mutation.
`clear-state` affects only `.mdfiles/work-state.json` and prints the exact
relative path it removed; it never deletes the directory, manifest, or project
files.
