# ForgeLoop Adaptive Efficiency Benchmark

Status: measured and observational. This report records a real host run; it
does not promote efficiency observations to lifecycle, verification, or
completion evidence.

| Field | Value |
| --- | --- |
| Run set | `codex-repeat5-20260831` |
| Recorded | 2026-08-31 |
| Host | locally authenticated Codex CLI |
| Model | `gpt-5.4-mini` |
| Reasoning effort | `low` |
| Provider label | `codex-chatgpt` |
| Environment | `codex-cli-darwin-arm64`, Node `26.8.1` |
| Scenarios | 7, including the original NovaTask workload |
| Modes | `direct`, `forgeloopBalanced`, `forgeloopAdaptive` |
| Samples | 5 runs per scenario and mode, 105 runs total |
| Usage source | `HOST_REPORTED` |

## Results

Token values are the observed total tokens for all five runs in a mode. The
paired percentage columns use only matching run indices where both runs passed
the deterministic verifier. `Adaptive vs direct` and `Adaptive vs balanced`
are therefore observational P50 comparisons, not claims that every run had
the same outcome.

| Scenario | Resolved profile | Direct P50 tokens | Balanced P50 tokens | Adaptive P50 tokens | Adaptive vs direct | Adaptive vs balanced | Verification direct / balanced / adaptive |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| API feature | `balanced` | 56,877 | 72,300 | 71,807 | +2.80% (4 pairs) | -19.38% (3 pairs) | 5/5 / 4/5 / 4/5 |
| Authentication change | `full` | 55,948 | 58,001 | 57,320 | +3.05% (5 pairs) | -1.27% (5 pairs) | 5/5 / 5/5 / 5/5 |
| Documentation correction | `light` | 56,370 | 57,215 | 57,191 | +5.45% (1 pair) | -6.80% (2 pairs) | 2/5 / 3/5 / 4/5 |
| Infrastructure release | `full` | 69,326 | 57,084 | 56,694 | -18.18% (5 pairs) | -0.98% (5 pairs) | 5/5 / 5/5 / 5/5 |
| NovaTask SaaS landing page | `light` | 153,949 | 158,984 | 156,365 | +1.57% (5 pairs) | -0.66% (5 pairs) | 5/5 / 5/5 / 5/5 |
| Small bug fix | `balanced` | 56,274 | 57,492 | 57,817 | +2.88% (5 pairs) | +0.52% (5 pairs) | 5/5 / 5/5 / 5/5 |
| Static landing page | `light` | 65,588 | 142,819 | 144,198 | +87.01% (5 pairs) | +1.00% (5 pairs) | 5/5 / 5/5 / 5/5 |

The runner also captured actual wall-clock time, verification cycles, and
comparable steps for every run. The validator recomputed the aggregates from
the raw files; no token, cache, cost, or timing value was derived from prompt
length or another estimate.

The non-blocking LIGHT objectives were evaluated against the comparable direct
baseline:

| LIGHT scenario | Adaptive P50 token overhead | Adaptive P95 token overhead | Adaptive P50 time overhead | Adaptive P95 time overhead | Objective result |
| --- | ---: | ---: | ---: | ---: | --- |
| Documentation correction | +5.45% | +5.45% | +16.17% | +16.17% | P50/P95 pass, limited by 1 comparable pair |
| NovaTask SaaS landing page | +1.57% | +71.46% | -7.24% | +17.07% | P50 pass; P95 token objective fails |
| Static landing page | +87.01% | +124.10% | +25.27% | +59.40% | P50/P95 token objectives fail |

These results do not support a general efficiency-improvement claim. The
NovaTask P95 and static landing-page token observations are reported as
`EFFICIENCY_REGRESSION` by the non-blocking regression check. The deterministic
verifier is a requirements check, not a visual-quality evaluator.

## Host-consumption evidence

[`benchmarks/adapters/codex-cli-real-host.mjs`](../benchmarks/adapters/codex-cli-real-host.mjs)
is the provider-specific host adapter used for this run. It:

- creates a fresh local fixture for each run and invokes the authenticated Codex
  CLI with `workspace-write`, `--json`, model `gpt-5.4-mini`, and low reasoning;
- creates a temporary canonical ForgeLoop task for the balanced and adaptive
  modes, then reads `task/context` through the public integration resource;
- passes the canonical `executionProfile.resolved` value to the host prompt;
  the adaptive mode requests `auto`, but the host consumes the resolved value;
- records non-direct usage through Core's normalized `writeTaskUsage` API with
  source `HOST_REPORTED` and appends the canonical `USAGE_RECORDED` event;
- runs a deterministic verifier against the isolated fixture after the host
  exits; and
- leaves unavailable context decomposition and quality scores as `UNKNOWN`.

The host uses the usage values emitted by the CLI's completed-turn event:
`input_tokens`, `output_tokens`, `cached_input_tokens`, and
`cache_write_input_tokens`. `totalTokens` is the reported total when present,
or the exact arithmetic sum of the reported input and output fields. The
adapter never estimates tokens from characters, prompt size, elapsed time, or
model names. Wall-clock time is measured by the benchmark runner.

## Known evidence boundaries

The Codex CLI exposes aggregate turn usage, but not a trustworthy token
decomposition for task context, guides, history, protocol instructions,
repository context, and other context items. Consequently every run keeps
`contextUsage.source` as `UNKNOWN` with null item values, and the report does
not claim that LIGHT context is smaller than BALANCED context.

No independent or blind visual evaluator was available for the UI scenarios.
Visual quality, responsive quality, accessibility, interaction polish, and
requirements-completeness scores remain `UNKNOWN`; the structural verifier must
not be treated as a substitute for those scores. The plan's quality-preserved
under-LIGHT criterion therefore remains open.

## Reproduction

The adapter requires a locally authenticated `codex` executable and an
available `gpt-5.4-mini` model. A new run set must use a new output directory:

```bash
FORGELOOP_BENCHMARK_MODEL=gpt-5.4-mini \
FORGELOOP_BENCHMARK_REASONING=low \
npm run benchmark:profiles -- \
  --adapter ./benchmarks/adapters/codex-cli-real-host.mjs \
  --runs 5 \
  --run-set codex-repeat5-reproduction-YYYYMMDD \
  --output /tmp/forgeloop-benchmark-results-reproduction \
  --json

npm run benchmark:profiles:summary -- \
  --results /tmp/forgeloop-benchmark-results-reproduction \
  --run-set codex-repeat5-reproduction-YYYYMMDD \
  --json

npm run benchmark:profiles:check -- \
  --results /tmp/forgeloop-benchmark-results-reproduction \
  --json
```

The committed run set contains only normalized measurements and aggregate
artifacts. No credentials, external service data, or temporary fixture
workspaces are committed.

## Release status

The `v1.7.0` tag, GitHub Release, npm publication, package identity, and
installed-package smoke checks were completed separately in the core release
delivery. This benchmark report does not represent a second package release.
