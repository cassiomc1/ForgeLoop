# ForgeLoop Execution Trace

Reference for `history`, `trace`, `reflect`, and task-level `inspect` observability projections (ForgeLoop 1.6.0+).

All views are deterministic read-only projections of canonical artifacts (event ledger + work state). There is no second truth store.

## history

```bash
forgeloop history --task <id> [--json] [--compact] [--verbose]
                  [--type <types>] [--phase <phases>] [--failures] [--checks]
                  [--since <ts>] [--until <ts>] [--limit <n>]
```

Human output shows chronological events with timestamps from the ledger. JSON output includes:

- `snapshot`: consistency anchors (`stateRevision`, `ledgerTailSequence`)
- `summary`: event/check/diagnostic counts
- `historyQuality`: `COMPLETE | PARTIAL | MINIMAL` with reasons
- `integrity`: ledger validation result
- `events`: normalized events (category, phase, provenance, references)

Filters are presentation-only; they never weaken integrity validation. Truncation via `--limit` is explicit (`truncated: true`).

## trace

```bash
forgeloop trace --task <id> --json
```

Machine-readable reconstruction containing events, lifecycle transitions, check attempts (all attempts preserved), diagnostics (legacy diagnoses, structured cases, interventions, dispositions), integrity, and snapshot anchors. Determinism: identical canonical artifacts produce identical traces except `snapshot.capturedAt`.

## reflect

```bash
forgeloop reflect --task <id> [--json]
```

Whole-task retrospective: verification cycles, failure surfaces, hypothesis summary, intervention effectiveness (`PENDING | INFORMATIVE | NON_INFORMATIVE | IMPROVED | REGRESSED`), strategy fingerprints, oscillation patterns, signals, and a recommended protocol action. Deterministic — ForgeLoop does not call an LLM.

## inspect --task

`forgeloop inspect --task <id>` extends target health with an additive `taskInspection` section: snapshot, lifecycle transitions, history quality, verification attempts per requirement, diagnostic summary, progress evaluation, integrity issues, deterministic explanation reason codes, and the safe next command. Existing top-level inspect fields are unchanged.

## Read-only invariant

`history`, `trace`, `reflect`, `inspect`, `progress` never mutate protocol state, acquire ownership, or append events. Test suites enforce this by hashing the complete `.forgeloop` tree before/after invocation.
