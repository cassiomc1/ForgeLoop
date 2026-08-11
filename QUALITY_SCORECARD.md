# mdfiles quality scorecard

This scorecard measures evidence-backed protocol quality. A dimension reaches
10/10 only when its documented contract, deterministic structure, positive and
negative checks, failure behavior, portability boundary, and compatibility
policy are all present.

| Dimension | 10/10 evidence |
| --- | --- |
| Loop engineering | Failure taxonomy, retry rule, invariants, evidence categories, and semantic tests in `LOOP_ENGINEERING.md`. |
| Routing | `src/core/router.js`, versioned route schemas, reason codes, exclusions, and positive/negative fixtures. |
| Workflow model | Canonical phases, transition table, state invariants, proportional skips, and `LOOP_SYSTEM_DESIGN.md`. |
| Protocol executability | Versioned JSON schemas, dependency-free validation, conformance tests, and compatibility policy. |
| Graph readiness | Serializable state/transition contracts and `ORCHESTRATOR_INTEGRATION.md`; no runtime required. |
| Portability | Node 20/22/24 Linux depth, OS smoke coverage, path/line-ending fixtures, and adapter compatibility evidence. |
| Observability | `inspect`, rich doctor findings, route explanations, receipts, explicit limitations, and no telemetry. |
| Resume/checkpoint | Atomic local state, stale detection, schema/secret validation, status, safe validation, and bounded clearing. |
| Multi-agent coordination | Self-contained briefs, ownership/dependency checks, reviewer independence, normalized results, and inline fallback. |
| Security boundaries | Realpath containment, untrusted-state validation, threat model, secret scanning, and explicit authority rules. |
| Maintenance quality | Small modules, built-in runtime, deterministic output, package gates, and backward-compatible protocol versions. |

## Score rules

- `Observed` evidence is a command result, file, hash, or test output available
  in the current checkout.
- `Inferred` evidence is a reasoned consequence of observed evidence and must
  be labeled as inference.
- `Not verified` means the check was not run or the target is outside the
  available environment.
- `Blocked` means a genuine external condition prevents safe progress.
- A passing local check never implies that a branch was pushed, a pull request
  was merged, or a deployment succeeded.
- Literal graph runtime and runtime multi-agent orchestration are `N/A by
  design`; compatible harnesses own those capabilities.
