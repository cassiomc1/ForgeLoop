# Fix STALE Conformance Alignment

## Objective

Align `validate-protocol` with the existing checkpoint freshness engine so a
valid persisted `work-state.json` can produce `STALE` from current evidence.
The persisted state remains durable facts only; freshness remains derived
runtime metadata.

## Scope and constraints

- Keep `schemas/work-state.schema.json` unchanged regarding `status`, `stale`,
  or `fresh`.
- Keep protocol version `1`.
- Preserve the existing `status` and `inspect` behavior while routing both
  through the same freshness calculation used by `validate-protocol`.
- Add only the optional `--contract-file` input to `validate-protocol`.
- Recalculate repository and required-artifact evidence from the selected
  target; never trust persisted derived freshness.
- Keep the CLI read-only and dependency-free.

## Design

`src/core/work-state.js` will expose a helper for a state object that has
already passed schema and semantic validation. The helper will calculate the
current repository fingerprint, optional contract fingerprint, and required
artifact fingerprints, then call `classifyWorkState`. The existing
`readAndClassifyWorkState` wrapper will use that helper after loading the
canonical `.mdfiles/work-state.json`, so `status`, `inspect`, and
`validate-protocol` share one freshness implementation.

`src/core/conformance.js` will accept an optional `stateClassification`
argument. It will never inspect `state.status`; instead, it will derive
`STALE` only when the supplied runtime classification is
`REVALIDATION_REQUIRED`. The result will include a `stale` object with the
classification reasons and comparison dimensions when that status wins.
Invalid and inconsistent relationship errors retain precedence over stale;
incomplete artifacts retain lower precedence than stale.

`src/commands/validate-protocol.js` will validate the raw state first, derive
freshness with the shared helper, and pass the derived metadata to
`validateTaskArtifactSet`. `--contract-file` will be accepted by the CLI for
this command. Human output will show repository, contract, required-artifact
comparisons, and stale reasons; JSON remains authoritative.

## Failure and compatibility behavior

- No contract file produces `CONTRACT_NOT_VERIFIED` and therefore
  `REVALIDATION_REQUIRED`/`STALE`.
- A changed contract produces `CONTRACT_CHANGED` and `STALE`.
- A changed repository produces `REPOSITORY_CHANGED` and `STALE`.
- A changed or missing required artifact produces its existing reason and
  `STALE`.
- Matching repository, contract, and required artifacts produce `FRESH`; a
  coherent complete artifact set then produces `VALID`.
- Schema, semantic, unsafe-path, parse, and relationship failures remain
  `INVALID` or `INCONSISTENT` according to existing precedence.

## Verification

TDD regressions will cover the conformance API and CLI for contract changed,
contract omitted, repository changed, required artifact changed, required
artifact missing, and a fully fresh set. Existing tests will prove that the
persisted state schema still rejects derived fields and that status/inspect
continue to use the shared classifier. The full Node suite, package check,
Python validators, Markdown/loop validators, secret scan, and diff check will
run before completion.
