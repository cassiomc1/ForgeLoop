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

The required reference set contains the six original scenarios plus
`novatask-saas-landing-page`: documentation correction, static landing page,
small bug fix, API feature, authentication change, infrastructure/release, and
the NovaTask static SaaS landing page. NovaTask is a local HTML5/CSS3/vanilla
JavaScript workload with no external services, authentication, secrets, or
publication, and must resolve to `light`.

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

An adapter may also return host-observed context usage. ForgeLoop does not
tokenize provider prompts. The optional shape is:

```json
{
  "contextUsage": {
    "source": "HOST_REPORTED",
    "profile": "light",
    "items": {
      "taskContext": null,
      "guides": null,
      "history": null,
      "protocolInstructions": null,
      "repositoryContext": null,
      "other": null
    }
  }
}
```

Every item is nullable and `UNKNOWN` requires all items to remain `null`.
Missing values are never inferred. When adaptive resolves to `light`, the
aggregate compares complete host-reported context items with the matching
balanced run and reports `CONTEXT_INFLATION` when light context is larger.
This is an observational diagnostic and never blocks lifecycle completion.

UI adapters may additionally return independently evaluated quality scores:

```json
{
  "quality": {
    "source": "EXTERNAL_REPORTED",
    "scores": {
      "visualQuality": null,
      "responsiveQuality": null,
      "accessibility": null,
      "interactionPolish": null,
      "requirementsCompleteness": null
    }
  }
}
```

Scores are on a 0–5 scale and remain `UNKNOWN` when no external evaluator or
host observation is available. Implementer self-ratings should not be used as
independent quality evidence; for NovaTask, review direct and ForgeLoop
outputs blind to execution mode before revealing the labels.

## Blind UI quality finalization

The runner supports an optional post-run finalization hook for adapters that
can collect independent UI evidence:

```js
export async function finalizeBenchmark({ benchmarkVersion, records, scenarios, target, runSetId }) {
  // Render and evaluate retained UI workspaces after all host timings finish.
  return {
    qualityByRunId: {
      // Keys are the runner-owned run IDs; values use the quality shape above.
    },
    summary: { status: "MEASURED" },
  };
}
```

The runner calls this hook only after every `runBenchmark` call has returned.
The adapter's `wallClockMs` therefore excludes browser rendering and evaluator
latency. The finalizer may attach quality only to known runner run IDs; usage,
timing, verification, comparable steps, context telemetry, and metadata are
not rewritten by finalization. A finalizer must leave quality `UNKNOWN` when a
candidate cannot be rendered or the evaluator cannot return schema-valid
scores.

The maintained Codex visual evaluator is intentionally outside ForgeLoop
Core. It requires an explicitly supplied, already-installed Playwright runtime
and Chromium executable, renders desktop (1440×900) and mobile (390×844)
screenshots, blocks HTTP(S) requests, and gives the separate evaluator only
requirements, neutral browser observations, and anonymized candidate labels.
The evaluator receives no execution-mode labels, run IDs, source files, or
implementer self-ratings. Its validated scores are recorded as
`EXTERNAL_REPORTED`; this is independent observational evidence, not a human
acceptance decision and not lifecycle authority. If the evaluator is not
configured or fails, quality remains `UNKNOWN` and no quality-preservation
claim is permitted.

## Inspecting and validating results

```bash
npm run benchmark:profiles:summary -- --json
npm run benchmark:profiles:check -- --json
```

To enable the optional blind UI finalizer, provide paths to the host's
existing Playwright and Chromium installations and a separate evaluator
model. The benchmark does not install these resources:

```bash
FORGELOOP_BENCHMARK_MODEL=gpt-5.4-mini \
FORGELOOP_BENCHMARK_REASONING=low \
FORGELOOP_BENCHMARK_QUALITY_EVALUATOR=./benchmarks/evaluators/codex-cli-blind-visual.mjs \
FORGELOOP_BENCHMARK_PLAYWRIGHT_ROOT=/absolute/path/to/playwright \
FORGELOOP_BENCHMARK_BROWSER=/absolute/path/to/Google\ Chrome\ for\ Testing \
FORGELOOP_BENCHMARK_EVALUATOR_MODEL=gpt-5.4 \
npm run benchmark:profiles -- \
  --adapter ./benchmarks/adapters/codex-cli-real-host.mjs \
  --runs 5 \
  --run-set codex-quality-repeat5-YYYYMMDD \
  --output /tmp/forgeloop-benchmark-results-quality \
  --json
```

The two evaluator processes have separate responsibilities: the
implementation host reports actual usage and deterministic verification, and
the read-only evaluator reports blind screenshot scores. Neither process may
invent context-item counts, token counts, costs, cache values, or lifecycle
state.

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

CI can run `npm run benchmark:profiles:regression -- --json`. It reports
`OK`, `EFFICIENCY_REGRESSION`, `NOT_MEASURED`, or `NOT_COMPARABLE`; a regression
is a release-quality warning, not a ForgeLoop lifecycle failure.

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

For UI scenarios, hosts should report independent visual, responsive,
accessibility, interaction-polish, and requirements-completeness scores when
an external evaluator or blind human review is available. Implementer
self-ratings are not trusted as a substitute. NovaTask comparisons should
hide the execution mode until this review is complete.

## Schemas and source policy

The machine-readable contracts are:

- `schemas/execution-profile-benchmark-scenario.schema.json`;
- `schemas/execution-profile-benchmark-run.schema.json`; and
- `schemas/execution-profile-benchmark-aggregate.schema.json`.

The source policy is intentionally narrow: provider or host observations are
accepted for benchmark claims, while actor-reported or absent telemetry stays
non-comparable. This is an efficiency observation boundary, not verification
evidence and not an external publication result.
