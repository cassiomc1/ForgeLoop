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
| Protocol executability | Versioned JSON schemas, semantic cross-artifact conformance, dependency-free validation, and compatibility fixtures. |
| Graph readiness | Serializable state/transition contracts and `ORCHESTRATOR_INTEGRATION.md`; no runtime required. |
| Portability | Node 20/22/24 Linux depth, OS smoke coverage, path/line-ending fixtures, and adapter compatibility evidence. |
| Observability | `inspect`/`status` shared state classification, real schema health, shared evidence, rich doctor findings, receipts, and no telemetry. |
| Resume/checkpoint | Atomic local state, contract/HEAD/artifact freshness, age warning, schema/secret validation, status, safe validation, and bounded clearing. |
| Multi-agent coordination | Self-contained briefs, write/write and write/read ownership checks, dependency-set validation, reviewer independence, normalized results, and inline fallback. |
| Security boundaries | Realpath containment, bounded untrusted JSON, threat model, nested secret scanning, publication evidence, and explicit authority rules. |
| Maintenance quality | Small modules, built-in runtime, deterministic JSON contracts, malformed/version fixtures, package gates, and backward-compatible protocol versions. |

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

## Evidence matrix

The score is evidence-backed only when the contract and its executable proof
are both present:

| Dimension | Implementation evidence | Executable evidence |
| --- | --- | --- |
| Routing | `src/core/router.js`, route schemas, stable reason codes, and exclusions | `tests/router.test.js`, `tests/fixtures/routes/` |
| Observability | `src/core/receipt.js`, `src/core/inspect.js`, `src/core/evidence.js`, and schema health | `tests/observability.test.js`, `tests/receipt-semantics.test.js`, `tests/schema-health.test.js` |
| Resume/checkpoint | `src/core/work-state.js`, `EXECUTION_STATE.md`, contract/artifact classifiers, and atomic writes | `tests/work-state.test.js`, `tests/checkpoint-freshness.test.js`, status and validate-state tests |
| Delegation | `src/core/delegation.js`, delegation-set validator, and `DELEGATION_PROTOCOL.md` | `tests/delegation.test.js`, `tests/delegation-set.test.js` |
| Portability | `ORCHESTRATOR_INTEGRATION.md`, adapter compatibility, and OS smoke workflow | `tests/portability.test.js`, package checks |
| Graph readiness | Serializable phase/transition mapping in `ORCHESTRATOR_INTEGRATION.md` | Python semantic validator and workflow-policy tests |
| Security boundary | realpath containment, bounded JSON, `THREAT_MODEL.md`, secret-free artifacts, authority and no-runtime rules | `tests/security-limits.test.js`, Markdown/loop validators, and `scripts/scan_secrets.py` |
| Cross-artifact conformance | `src/core/conformance.js` and `mdfiles validate-protocol` | `tests/conformance.test.js`, `tests/validate-protocol-cli.test.js`, and protocol fixtures |

The implementation references above are local observations. OS runners,
remote links, provider sessions, publication, and deployment remain `Not
verified` unless their own checks produce current evidence.
