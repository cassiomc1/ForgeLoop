# Pre-Fourth Blind Test Final Improvements

**Date:** 2026-08-13

**Status:** Approved for implementation

## Objective

Prepare the existing lifecycle-navigation implementation for the fourth blind
live conformance run by removing future-result assumptions from `record-check`
guidance, documenting the executable closure order, and releasing the fix as
package version `0.1.3`.

## Scope and constraints

- Preserve protocol version 1, existing phases, transitions, evidence kinds,
  receipt semantics, and direct-process command safety.
- Change only the structured guidance produced by
  `src/core/next-action.js`, its regression/functional tests, the canonical
  closure documentation, and the package version.
- Keep deterministic fields (`checkId`, `requirement`, and command identity)
  available before a check runs.
- Leave `status`, `evidenceKind`, `result`, and `exitCode` unresolved until the
  agent has executed and observed the check.
- Do not redesign the protocol core, add an orchestrator, execute command text,
  install software, publish, or deploy.

## Design

`recordCheckCommandSpec(requirement)` will return an `argv` prefix containing
only safe deterministic values:

```json
[
  "record-check",
  "--id=requirement-<stable-hash>",
  "--requirement=<requirement-data>"
]
```

The spec will expose runtime inputs for:

- `--status=<passed|failed|blocked|not-run>`;
- `--evidence-kind=<OBSERVED|INFERRED|NOT_VERIFIED|BLOCKED>`;
- `--result=<text>`;
- optional `--exit-code=<number>`.

Requirement text remains an `argv` value and is never interpolated into a shell
command. The guidance layer remains read-only and does not execute the check.

After an observed pass, `record-check` persists `passed` + `OBSERVED` and the
next action evaluates the resulting coverage. After an observed failure, it
persists `failed` + `OBSERVED` and the next action is `DIAGNOSE`. Blocked and
not-run outcomes remain explicit rather than being coerced to pass.

The canonical documentation will show the actual post-implementation order:

```text
EXECUTING
    ↓ forgeloop next
advance --to VERIFYING
    ↓ forgeloop next
prepare-completion
    ↓
run applicable project checks
    ↓
record observed results with record-check
    ↓ forgeloop next
advance --to REVIEWING
    ↓ forgeloop next
complete
    ↓ VALID
COMPLETE
```

It will explicitly state that `prepare-completion` creates or refreshes the
in-progress receipt container; it does not claim completion, and completion
still requires observed evidence, chronology, review state, and validator
requirements.

## Verification

- A regression test generated before check execution must contain requirement
  metadata but none of the result-dependent values.
- A functional passing sequence must persist observed exit code `0` and lead
  to coverage/review when all requirements are covered.
- A functional failing sequence must persist an observed non-zero exit code and
  lead to diagnosis.
- Existing direct-process safety tests must continue to prove that untrusted
  requirement text is data, not shell syntax.
- The targeted next-action tests, full `npm test`, package check, Markdown/loop
  validators, secret scan, and validator-backed ForgeLoop completion must pass.

