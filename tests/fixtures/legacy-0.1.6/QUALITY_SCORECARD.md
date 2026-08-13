# ForgeLoop quality scorecard

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
| Observability | `inspect`/`status`/`validate-protocol` shared derived state classification, real schema health, shared evidence, rich doctor findings, receipts, and no telemetry. |
| Completion enforcement | Canonical contract, persisted route, guide-declared gates, preflight, phase ledger, structured checks, evidence coverage, `audit`, `report`, and `complete` validators. |
| Agent lifecycle navigation | Read-only `forgeloop next` decisions, stable action/reason output, persisted-state safety, and adapter guidance at lifecycle boundaries. |
| Execution → Verification handoff | Legal `EXECUTING` → `VERIFYING` transition, implementation-step reconciliation, and preservation of verification evidence. |
| Pre-contract autonomy — structural | Blocking vs Non-Blocking Decisions policy, classify-before-ask invariant, PRE-QUESTION CHECK, explicit ASSUMPTION / source=agent-default recording, contract-before-clarification ordering, deterministic reason-code helper, and positive/negative tests. |
| External workflow compatibility — structural | Explicit autonomous-mode precedence, `WORKFLOW_CONFLICT` recording, question-source attribution, installed-versus-compatible wording, and mandatory-approval harness isolation. |
| Instruction-conflict handling — structural | External workflow policy is attributed separately from user requirements and ForgeLoop blocking decisions, with deterministic conflict reason codes and no fake unresolved user blocker. |
| Autonomous-mode precedence — structural | Explicit `autonomousMode=true` boundary, explicit interactive opt-in, preservation of `NON_BLOCKING`, and no silent workflow-induced mode switch. |
| Pre-contract autonomy — cross-agent live robustness | Independent live-agent behavior across fresh package installs, exact blind prompts, one-process/no-subagent topology, and separate evidence for non-blocking continuation versus blocking clarification. Structural coverage does not imply live cross-agent robustness. |
| Resume/checkpoint | Atomic local state, contract/HEAD/artifact freshness, age warning, schema/secret validation, status, safe validation, and bounded clearing without persisting derived freshness fields. |
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

## Blind-run conformance position

| Dimension | Classification |
| --- | --- |
| Pre-contract autonomy — structural | IMPLEMENTED / LOCAL TESTS PASS — 377 Node tests and 42 Python tests, with focused autonomy/conformance checks green |
| External workflow compatibility — structural | IMPLEMENTED / LOCAL TESTS PASS — deterministic helper covers autonomous conflict, compatible non-blocking flow, legitimate blocking questions, explicit interactive mode, and question-source vocabulary |
| Instruction-conflict handling — structural | IMPLEMENTED / LOCAL TESTS PASS — workflow-policy conflicts stay outside `unresolvedDecisions[]` and expose stable external-workflow reason codes |
| Autonomous-mode precedence — structural | IMPLEMENTED / LOCAL TESTS PASS — autonomous mode is explicit, interactive mode is explicit, and `NON_BLOCKING` is never promoted by workflow policy |
| Pre-contract autonomy — cross-agent live robustness | NOT_PROVEN — the fifth blind run is `PARTIAL` on published `0.1.4` and the sixth run requires harness-level exclusion of mandatory-approval workflows before it can start |
| Execution → Verification | REPRODUCED FAILURE in fourth blind run before implementation |
| Verification serialization | NOT_REACHED in fourth blind run |
| Review transition | NOT_REACHED in fourth blind run |
| Receipt generation | NOT_REACHED in fourth blind run |
| Full conformance | PARTIAL |

## Evidence matrix

The score is evidence-backed only when the contract and its executable proof
are both present:

| Dimension | Implementation evidence | Executable evidence |
| --- | --- | --- |
| Routing | `src/core/router.js`, route schemas, stable reason codes, and exclusions | `tests/router.test.js`, `tests/fixtures/routes/` |
| Observability | `src/core/receipt.js`, `src/core/inspect.js`, `src/core/evidence.js`, and schema health | `tests/observability.test.js`, `tests/receipt-semantics.test.js`, `tests/schema-health.test.js` |
| Resume/checkpoint | `src/core/work-state.js`, `EXECUTION_STATE.md`, shared loaded-state classifier, contract/artifact classifiers, and atomic writes | `tests/work-state.test.js`, `tests/checkpoint-freshness.test.js`, status, validate-state, and validate-protocol tests |
| Delegation | `src/core/delegation.js`, delegation-set validator, and `DELEGATION_PROTOCOL.md` | `tests/delegation.test.js`, `tests/delegation-set.test.js` |
| Portability | `ORCHESTRATOR_INTEGRATION.md`, adapter compatibility, and OS smoke workflow | `tests/portability.test.js`, package checks |
| Graph readiness | Serializable phase/transition mapping in `ORCHESTRATOR_INTEGRATION.md` | Python semantic validator and workflow-policy tests |
| Security boundary | realpath containment, bounded JSON, `THREAT_MODEL.md`, secret-free artifacts, authority and no-runtime rules | `tests/security-limits.test.js`, Markdown/loop validators, and `scripts/scan_secrets.py` |
| Cross-artifact conformance | `src/core/conformance.js`, `classifyLoadedWorkState`, and `forgeloop validate-protocol --contract-file` | `tests/conformance.test.js`, `tests/validate-protocol-cli.test.js`, and protocol fixtures covering precedence and stale evidence |
| Protocol preparation and completion | `src/core/preflight.js`, `src/core/completion.js`, `src/core/events.js`, policy packs, and portable bundles | `tests/preflight.test.js`, `tests/completion.test.js`, `tests/lifecycle.test.js`, `tests/policy.test.js`, and `tests/bundle.test.js` |
| Pre-contract autonomy — structural | `LOOP_ENGINEERING.md`, `src/core/decision-classification.js`, `src/core/workflow-compatibility.js`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/project-loop.mdc` | `tests/decision-classification.test.js`, `tests/workflow-compatibility.test.js`, `tests/autonomy-policy.test.js`, `tests/preflight.test.js` |
| External workflow compatibility — structural | `LOOP_ENGINEERING.md`, `AGENT_COMPATIBILITY.md`, `src/core/workflow-compatibility.js`, and sixth-run harness metadata rule | `tests/workflow-compatibility.test.js`, `conformance/README.md` |
| Instruction-conflict handling — structural | Canonical source-attribution and `WORKFLOW_CONFLICT` policy in `LOOP_ENGINEERING.md` plus adapter references | `tests/autonomy-policy.test.js`, `tests/workflow-compatibility.test.js` |
| Autonomous-mode precedence — structural | Autonomous/interactive mode contract and harness exclusion metadata | `tests/workflow-compatibility.test.js`, `tests/conformance-scenarios.test.js` |
| Pre-contract autonomy — cross-agent live robustness | Prior third blind-run result, `conformance/runs/2026-08-13-codex-fourth-live.md`, preserved fifth-run report `conformance/runs/2026-08-13-codex-fifth-live.md`, and the exact blind request | `tests/conformance-scenarios.test.js`; sixth run is not started until mandatory approval is excluded |

The implementation references above are local observations. OS runners,
remote links, provider sessions, publication, and deployment remain `Not
verified` unless their own checks produce current evidence.
