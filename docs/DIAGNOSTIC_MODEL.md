# ForgeLoop Diagnostic Model

Canonical reference for structured diagnostic cases, interventions, and hypothesis dispositions (ForgeLoop 1.6.0+, Protocol v1 additive).

## Principles

1. **Observation is not hypothesis.** Observations are bounded statements grounded in recorded evidence. Hypotheses are falsifiable claims that may explain observations.
2. **Hypothesis is not proof.** Statuses are `OPEN`, `SUPPORTED`, `WEAKENED`, `FALSIFIED`, `SUPERSEDED`, `UNRESOLVED`. ForgeLoop never emits `ROOT_CAUSE_CONFIRMED` or similar.
3. **Append-only truth.** Diagnostic revisions are never rewritten; the ledger records evolving understanding.
4. **Diagnostic prose is metadata.** Statements, settlement predicates, and next-safe-action text are never executed by ForgeLoop.

## Structured diagnostic case

One diagnostic revision for one verification cycle, recorded with:

```bash
forgeloop record-diagnosis --task <id> --file diagnostic-case.json --json
```

Legacy flag-based `record-diagnosis` syntax remains valid; both forms cannot be combined.

Schema: `schemas/diagnostic-case.schema.json`. Bounded limits: 64 observations, 64 contributors, 32 hypotheses per case; statements up to 4096 characters; IDs match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.

### Semantic fingerprint

`diagnosticFingerprint` hashes the canonicalized semantic content (cycle, failure class, observations/contributors/hypotheses semantics, next-safe action). Whitespace, key ordering, unordered reference arrays, and object IDs are excluded. Re-recording a semantically identical case is idempotent.

### Revisions

`diagnosticRevision` starts at 1 and increases monotonically per cycle. Each revision binds `previousDiagnosticFingerprint` to the prior active revision.

## Interventions

Recorded in `CORRECTING` phase:

```bash
forgeloop record-intervention --task <id> --file intervention.json --json
```

Interventions bind to at least one recorded hypothesis and carry a semantic fingerprint used to detect repetition without information gain.

## Hypothesis dispositions

```bash
forgeloop record-hypothesis-disposition --task <id> \
  --hypothesis h-timeout-latency --status SUPPORTED \
  --evidence-ref checkout-tests --reason "..." --json
```

Allowed transitions: `OPEN → {SUPPORTED, WEAKENED, FALSIFIED, SUPERSEDED, UNRESOLVED}`, `SUPPORTED → {WEAKENED, FALSIFIED, SUPERSEDED}`, `WEAKENED → {SUPPORTED, FALSIFIED, SUPERSEDED}`.

## Information gain

Compatibility values (`FIRST_DIAGNOSIS`, `NEW_HYPOTHESIS`, `NEW_EVIDENCE`, `NEW_HYPOTHESIS_AND_EVIDENCE`, `NONE`) remain valid. Structured dimensions add observation/contributor/hypothesis novelty, disposition changes, failure-signature change, failure-surface change, and intervention change. New IDs, timestamps, whitespace, paraphrases, and identical reruns never constitute gain.

## Stall and oscillation

- High correction-cycle count alone is advisory (`WATCH`), never `STALLED`.
- Strong stall requires identical failure signature, strategy, contributors, hypotheses, surface, and no new evidence across consecutive cycles.
- Oscillation (`A→B→A`) surfaces as `OSCILLATING_STRATEGY`; `next` recommends `INTRODUCE_NEW_OBSERVATION`.

## Capability discovery

`forgeloop protocol-info --json` advertises `features.diagnostics`, `executionHistory`, `structuredTrace`, `taskInspection`, and `reflection`.
