# Execution-profile benchmark protocol

ForgeLoop keeps execution-profile efficiency evidence separate from lifecycle
trust. The benchmark scenarios under
[`benchmarks/execution-profiles/`](../benchmarks/execution-profiles/) are
deterministic routing specifications. They are not measurements and they do
not authorize a performance claim by themselves.

## What is measured

The runner executes every scenario in these modes:

| Mode | Meaning |
| --- | --- |
| `direct` | The direct baseline supplied by the host adapter. |
| `forgeloopBalanced` | The normal ForgeLoop context and process presentation. |
| `forgeloopAdaptive` | The deterministic profile resolved from the scenario, contract, and scope. |

Each run records provider or host usage, runner-measured wall-clock time,
verification outcome, verification cycles, comparable work steps, and the
metadata needed to determine whether a comparison is valid. The runner never
derives token counts, costs, cache values, verification results, or comparable
steps from prompt length, elapsed time, model names, or estimates.

Trusted efficiency comparisons require all of the following:

- `PROVIDER_REPORTED` or `HOST_REPORTED` usage;
- actual non-null token and timing values for the metric being compared;
- `PASS` verification for both paired runs;
- a positive comparable-step count; and
- matching model, provider, prompt-spec fingerprint, project revision,
  benchmark version, and environment metadata.

If any condition is missing, the aggregate reports `NOT_COMPARABLE` and
`claimsAllowed: false` for that comparison. `UNKNOWN` is a valid telemetry
state, not a zero value. Benchmark outcomes are observational and never relax
the lifecycle, evidence, authority, provenance, safety-floor, or completion
requirements.

## Running a benchmark

The command requires a host adapter because ForgeLoop cannot create real model
or provider measurements on its own:

```bash
npm run benchmark:profiles -- \
  --adapter ./path/to/actual-host-adapter.mjs \
  --runs 5 \
  --json
```

The adapter exports `runBenchmark(input)` and must execute the supplied
scenario. Its result must include actual usage and verification data:

```js
export async function runBenchmark({ scenario, mode, runIndex, target }) {
  // Execute the host's real workload here.
  return {
    usage: {
      inputTokens: 120,
      outputTokens: 80,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 200,
      costUsd: null,
      model: "host-reported-model",
      provider: "host-reported-provider",
      source: "HOST_REPORTED",
    },
    promptSpecFingerprint: "sha256-or-other-host-bound-fingerprint",
    verification: "PASS",
    verificationCycles: 1,
    comparableSteps: 4,
  };
}
```

The values above are shape-only examples. They must not be copied as evidence
unless the host actually reports them. The runner owns the elapsed-time
measurement and derives the Git revision from the target checkout. Results
are written under a unique run-set directory and existing history is never
overwritten.

## Inspecting and validating results

```bash
npm run benchmark:profiles:summary -- --json
npm run benchmark:profiles:check -- --json
```

Before a host run exists, the summary is intentionally:

```json
{
  "status": "NOT_MEASURED",
  "claimsAllowed": false
}
```

Raw runs are stored below `benchmarks/execution-profiles/results/raw/` and
recomputed aggregates below `benchmarks/execution-profiles/results/aggregate/`.
The validator checks all scenario, raw-run, and aggregate schemas and
recomputes aggregates from raw measurements. A changed overhead target is
observable in the report; it is not a blocking lifecycle gate.

For LIGHT scenarios, the initial non-blocking objectives are P50 token
overhead no greater than +35% and P95 token overhead no greater than +60%
against a comparable direct baseline. These objectives never trade away
verification quality, requirement coverage, or protocol safety.

## Host context contract

The universal integration API exposes `task/context`, and the MCP adapter
registers it as `forgeloop://task/{taskId}/context`. The projection includes
the resolved profile, objective, deliverables, constraints, selected guide
IDs, next action, verification requirements, and an explicit context policy:

- `light`: targeted context, compact output, short planning, focused checks,
  and lazy optional artifacts;
- `balanced`: relevant context, standard output and planning, normal checks;
- `full`: expanded context, deep planning, broad risk context, and expanded
  verification when justified.

Every projection also states that lifecycle phases, required gates, evidence,
verification truth, authority, provenance, the safety floor, and validated
completion remain unchanged. A host may omit optional presentation context,
but it may not use `light` to skip a required lifecycle phase or gate.

Historical protocol-v1 routes without profile metadata remain readable and are
projected to the balanced compatibility profile.

## Schemas and source policy

The machine-readable contracts are:

- `schemas/execution-profile-benchmark-scenario.schema.json`;
- `schemas/execution-profile-benchmark-run.schema.json`; and
- `schemas/execution-profile-benchmark-aggregate.schema.json`.

The source policy is intentionally narrow: provider or host observations are
accepted for benchmark claims, while actor-reported or absent telemetry stays
non-comparable. This is an efficiency observation boundary, not verification
evidence and not an external publication result.
