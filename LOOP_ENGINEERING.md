# Loop Engineering — Universal Execution Protocol

> Canonical operating cycle for this kit. Agent adapters point here; specialized
> technical rules remain in the guides selected through
> [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md).

## Core principle

Never treat a request as an isolated instruction or the first plausible answer
as completion.

```text
RECEIVE REQUEST
      ↓
DISCOVER CONTEXT
      ↓
DEFINE CONTRACT
      ↓
SELECT GUIDES
      ↓
PLAN → EXECUTE → VERIFY
                    ↓
          ┌─────────┴─────────┐
          │                   │
        PASSED              FAILED
          │                   │
PROPORTIONAL REGRESSION   DIAGNOSE CAUSE
          │                   │
       FINISH          CORRECT AND VERIFY
```

The loop creates real feedback until objective criteria are met. It does not
authorize infinite execution, scope expansion, or unrequested external action.

## Protocol version and evidence contract

The portable protocol currently uses `protocol-version: 1`. This version is
independent of the npm package version and is carried by structured routing,
state, receipt, and delegation artifacts.

Every result separates:

```text
Observed       current command, file, hash, or test evidence
Inferred       conclusion derived from observed evidence
Not verified   check not run or target outside the environment
Blocked        genuine external condition preventing safe progress
```

Do not present an inference, an unrun check, or a local result as observed
proof. Local success never implies publication, deployment, or remote-check
success.

The protocol-support CLI is local and offline-capable by default. It sends no
telemetry, does not require a central trace server, and never executes commands
found in untrusted profile, receipt, or state data.

## Failure taxonomy, retry, and loop invariants

The protocol uses these stable failure classes:

```text
CONTRACT_FAILURE
DISCOVERY_FAILURE
ROUTING_FAILURE
IMPLEMENTATION_FAILURE
VERIFICATION_FAILURE
REGRESSION_FAILURE
REVIEW_FAILURE
CAPABILITY_FAILURE
AUTHORITY_FAILURE
ENVIRONMENT_FAILURE
EXTERNAL_SERVICE_FAILURE
STALE_STATE_FAILURE
```

For every failure, record the class, hypothesis, evidence, and next safe
action. A retry is allowed only when new diagnostic evidence or a changed
hypothesis exists. The same hypothesis with the same evidence is not an
immediate retry. Repeated review/fix cycles are bounded by the task contract;
an unavailable external dependency becomes a blocker rather than a spin loop.

The loop invariants are:

1. no completion claim without current verification evidence;
2. no route without a reason code;
3. no retry without new evidence or a changed hypothesis;
4. no destructive action without validated authority and target;
5. no project-profile fact without a source;
6. no external publication implied by local success;
7. no skipped failed check silently treated as passed;
8. no unrelated refactor during uncertain diagnosis;
9. no secret in the profile, work state, receipt, or delegation artifacts;
10. no independent-agent claim when only self-review occurred.

The serializable phase and transition contract is maintained in
[`ORCHESTRATOR_INTEGRATION.md`](./ORCHESTRATOR_INTEGRATION.md). It is a host
integration boundary, not an execution runtime; semantic validation checks that
its phase list, transitions, invariants, schema version, and no-runtime markers
remain aligned with this loop.

## Workflow state semantics

The canonical phases are `RECEIVED`, `DISCOVERING`, `CONTRACT_READY`,
`ROUTED`, `DESIGNING`, `PLANNED`, `EXECUTING`, `VERIFYING`, `DIAGNOSING`,
`CORRECTING`, `REVIEWING`, `COMPLETE`, and `BLOCKED`. A task may skip
proportional phases, but:

- `COMPLETE` requires verification evidence;
- `BLOCKED` requires a blocker category and evidence;
- `CORRECTING` requires a diagnosed hypothesis;
- `ROUTED` requires at least one route reason, even if no technical guide is
  selected for documentation-only work;
- `REVIEWING` cannot claim independent review when reviewer and implementer
  identities are equal.

Resume rules are conservative: revalidate branch, HEAD, contract fingerprint,
protocol version, and required artifacts before continuing; never rerun a
completed destructive or publication action automatically; rerun cheap
verification when state is stale; and clear only `.mdfiles/work-state.json`
when abandoned state must be removed.

## Execution contract

Before changing files, translate the request into a contract proportional to
the task:

```text
OBJECTIVE
Observable state that must exist at the end.

CONTEXT
Relevant files, modules, services, data, dependencies, and rules.

DELIVERABLES
Expected changes, artifacts, or answers.

CONSTRAINTS
What must not be broken, removed, published, or assumed.

RISKS
Regression, security, data, compatibility, and external effects.

VERIFICATION
Checks capable of demonstrating the result.

SUCCESS
Objective conditions that must be true.

STOP
Verified success or a genuine external blocker.
```

Do not interrupt the user for information that can be discovered safely in the
project. Request a decision when legitimate alternatives produce materially
different outcomes, authority is missing, or the action is destructive.

### Classify the request

- **Answer, explain, or review:** inspect and report evidence; do not make implicit changes.
- **Diagnose:** reproduce and determine the cause; implement only when a fix is in scope.
- **Create or change:** implement, test, and document in proportion to risk.
- **Publish or operate external systems:** confirm the target and authority before changing state.
- **Delete or overwrite:** resolve the exact target, prefer recoverable methods, and verify the result.

The user's latest explicit instruction replaces incompatible earlier requests
but does not silently broaden scope.

## Project discovery

Read the closest instructions for the directory in scope. Then inspect only
sources that exist and are relevant:

```text
AGENTS.md
CLAUDE.md
README.md
CONTRIBUTING.md
PROJECT_PROFILE.md
package.json
pyproject.toml
requirements.txt
Cargo.toml
go.mod
Makefile
docker-compose.yml
Dockerfile
.github/workflows/
docs/
src/
tests/
```

Discover before inferring:

- product, stack, platforms, and architecture;
- official development, lint, test, typecheck, and build commands;
- CI, release, deployment, and environments;
- Git state and pre-existing changes;
- external services, persistence, and security surfaces;
- browsers, devices, and accessibility requirements;
- project-specific decisions.

A text reference to a technology does not prove it is active. Confirm it through
manifests, imports, configuration, execution, or authoritative documentation.

### Persistent profile

Use [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) as a cache of durable facts:

1. verify a source before recording or changing a fact;
2. leave unknown facts unverified;
3. cite a path, command, or other evidence;
4. never record secrets or credentials;
5. do not turn the profile into a task log;
6. preserve explicit decisions until newer evidence replaces them.

When the profile conflicts with the repository, current verifiable state wins.
Correct only the affected profile facts.

## Capability discovery and on-demand extensions

When a task may require image, video, document, audio, OCR, grounding,
segmentation, web search, generation, editing, long-video memory, or 3D
tooling, the agent must verify the capability boundary before using it:

1. Classify the operation and identify whether it needs a model capability, a
   skill, an MCP server, an API-backed provider, or a system dependency.
2. Inspect the active model and harness for native support, registered skills,
   MCP servers, and callable tools. A prompt, package name, or documentation
   reference is not evidence that the current session can call a tool.
3. Reuse an existing callable capability when it is sufficient for the task.
4. If the required capability is missing and a keyless Qwen path exists,
   install only the smallest matching capability, normally
   `qwen-mm-plugins-core` for multimodal reading. Use the active harness's
   native installation mechanism or the official
   [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) instructions.
5. If the operation is API-backed, check the required environment variable or
   configured service endpoint before enabling it. Without that prerequisite,
   keep the optional capability disabled and continue with a keyless path or
   report exactly what must be configured.
6. Verify registration and dependencies with the harness capability listing
   and the upstream plugin's supported verification/check command.
7. Invoke the callable tool for the task and report missing system tools,
   unavailable credentials, or model/harness limitations. Do not claim a
   capability based only on a downloaded package or an unsuccessful fallback.

This installation is task-scoped and capability-scoped, not a startup-wide
installation of every plugin. The agent must never create, guess, persist, or
expose an API key. System-level package installation, global configuration,
network access, and credentials remain subject to host controls. If the active
harness cannot register skills or MCP tools, the agent must state that the
capability is unavailable rather than pretending to use it.

## Guide selection

Read [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) after discovery and before planning.

Required rules:

- select all guides applicable to the intent, changed surfaces, and risks;
- do not load every guide as a precaution;
- locate headings and relevant sections with `rg` before reading a long file;
- read the whole guide only when the task crosses the whole domain;
- briefly report the selected guide IDs and reason;
- treat optional references as options; only the task-scoped Qwen capability
  policy above permits its matching installation, while unrelated resources
  remain gated.

A guide provides specialized defaults. It does not replace explicit product
requirements, closer instructions, code evidence, or higher-level host rules.

## Design and implementation gates

### Design gate

Before behavior, feature, architecture, or instruction changes, do proportional
design after discovery. Work through one unresolved decision question at a
time, surface meaningful alternatives with tradeoffs, and obtain approval
before implementation. For small documentation maintenance, keep the treatment
compact while still confirming the objective, boundaries, and verification.

Use the [Execution contract](#execution-contract), [Project discovery](#project-discovery),
[Guide selection](#guide-selection), and [Proportional planning](#proportional-planning)
sections as the canonical sources for context, routing, and plan depth.

### Plan contract and task briefs

Every implementation plan or task brief must be self-contained for its scope
and state the objective, architecture, technology, global constraints, exact
files or interfaces, verification, and commit boundaries. Independent tasks
must stay independently executable without hidden dependencies on unpublished
conversation context.

For long or multi-task work, keep an ignored ledger scoped to the plan. Use
`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, and `BLOCKED` to support
recovery and resume for completed work, concerns, missing context, and
blockers rather than turning the ledger into a task log.

Use the [Execution contract](#execution-contract) for the required fields, the
[Project discovery](#project-discovery) and [Guide selection](#guide-selection)
sections for evidence and routing, and [Stop conditions](#stop-conditions) for
genuine blockers.

### Test-first implementation

For behavior changes, use RED → expected failure → minimal GREEN → refactor,
with the testing strategy and risk depth anchored in
[`ENG/test-code-eng.md`](./ENG/test-code-eng.md) and the
[Verification and regression](#verification-and-regression) plus
[Evidence-driven correction](#evidence-driven-correction) sections. Explicit
exceptions are documentation-only work, generated output, or throwaway
exploration that will not become maintained production behavior.

### Review and recovery

self-review is required but is not independent review. For multi-task work,
specification compliance before code quality: first verify that the result
matches the approved contract, then evaluate implementation quality. Handle one
finding at a time, stop after at most five review-fix rounds, and treat any
unresolved load-bearing finding as blocked until the contract or implementation
changes.

Use [Evidence-driven correction](#evidence-driven-correction) for diagnosis,
[Verification and regression](#verification-and-regression) for re-checking,
and [Stop conditions](#stop-conditions) when a blocker remains genuine.

### Worktree and capability degradation

Prefer native isolation when the harness provides it; otherwise use an approved
ignored local worktree and require explicit consent before working directly on
the main branch. When optional subagent, todo, web, or isolation capabilities
are missing, fall back inline or to a plan file, report the degraded mode, and
never invent a tool call.

Use [Capability discovery and on-demand extensions](#capability-discovery-and-on-demand-extensions)
for callable-tool proof, [Execution loop](#execution-loop) for scoped progress,
and [Stop conditions](#stop-conditions) when the missing capability removes a
required verification path.

## Instruction and adapter hygiene

Write canonical rules once in this file and make adapters delegate to
`LOOP_ENGINEERING.md`, `PROJECT_PROFILE.md`, and `GUIDE_ROUTER.md` rather than
copying process bodies. Adapter descriptions are trigger and reference text,
not duplicate policy. Mechanical contracts belong in tests. New harness
adapters should use the harness's native installation and context-loading path
without editing global configuration, and actual bootstrap or context loading
should be proven with a unique marker where possible.

Keep capability rules in [Capability discovery and on-demand extensions](#capability-discovery-and-on-demand-extensions),
routing in [Guide selection](#guide-selection), planning in
[Proportional planning](#proportional-planning), execution in
[Execution loop](#execution-loop), verification in
[Verification and regression](#verification-and-regression), correction in
[Evidence-driven correction](#evidence-driven-correction), and exit handling in
[Stop conditions](#stop-conditions).

## Proportional planning

### Simple task

```text
Objective → small change → specific check → final review
```

### Medium task

```text
Objective → investigation → short plan → verifiable steps
→ related regression checks → final review
```

### Complex task

```text
Objective → system map → risks and dependencies → subtasks
→ per-subtask validation → integration → broad regression
```

Every step must produce a testable result. Split components by responsibility
and keep interfaces explicit. Do not create extensive plans for trivial changes
or hide complex work in one vague step.

## Execution loop

1. Confirm the objective and success condition.
2. Collect the smallest sufficient context.
3. Preserve user changes and keep the diff scoped.
4. For bugs, reproduce the failure and capture evidence before fixing it when practical.
5. Make the smallest coherent change that addresses the cause or delivers the capability.
6. Run the specific check.
7. If it fails, diagnose before editing again.
8. After the specific check passes, run proportional regression checks.
9. Inspect the result and the complete diff.
10. Finish only with current evidence.

Do not bundle independent changes while the cause remains uncertain. Do not
refactor large areas merely because they could be improved.

## Verification and regression

Choose checks that match the artifact and risk.

### Code

- focused and regression tests;
- lint and formatting;
- typecheck;
- production build;
- imports, runtime errors, and public contracts;
- relevant compatibility and edge cases.

### Backend, APIs, and data

- status codes and payloads;
- authentication and authorization;
- validation, persistence, and idempotency;
- migrations, constraints, indexes, and rollback;
- real integrations or doubles appropriate to the test level;
- logs without secrets or sensitive data.

### Interfaces

- normal, loading, empty, error, and disabled states;
- responsiveness and lack of overflow;
- keyboard, focus, contrast, and applicable assistive technology;
- browser console;
- API integration;
- production and target-device measurement when required.

### Infrastructure and automation

- syntax and schema;
- permissions and variables;
- rollback plan;
- health checks;
- CI-equivalent execution when practical.

### Documentation

- consistency with real state;
- commands and paths;
- links and references;
- examples;
- Markdown and language.

Regression depth grows with risk: specific check, related tests, then suite,
build, and integration validation when reasonable.

## Evidence-driven correction

```text
FAILURE
  ↓
COLLECT COMPLETE OUTPUT
  ↓
IDENTIFY ROOT CAUSE
  ↓
FORM A TESTABLE HYPOTHESIS
  ↓
APPLY THE SMALLEST FIX
  ↓
RUN THE SPECIFIC CHECK
  ↓
RUN REGRESSION CHECKS
```

Avoid random edits and never hide a failure by weakening verification.

If the same hypothesis fails again without new evidence:

1. stop repeating the attempt;
2. review assumptions, logs, and environment boundaries;
3. seek an independent check;
4. change strategy or report the genuine blocker.

An unavailable check does not pass by absence. Use an available equivalent when
it produces compatible evidence; otherwise request installation authority or
record the limitation.

## Precedence

Apply conflicts in this order:

1. platform and host-agent rules;
2. the user's latest explicit request;
3. the closest project, directory, or file instructions;
4. legal, security, and data-preservation requirements;
5. this loop contract;
6. the router decision;
7. specialized guide defaults.

Within technical scope, prioritize:

```text
correctness → no regression → security → product requirement
→ simplicity → measured performance → elegance
```

A guide never authorizes unrelated installation, publication, deletion,
migration, production changes, messages, or information exposure. The
task-scoped Qwen capability policy is the narrow exception for installing the
smallest missing capability when the current task requires it; host approval
controls and the API-credential boundary still apply.

## Stop conditions

### Verified success

- the primary requirement is met;
- applicable checks were run and passed;
- no relevant regression was found;
- the diff was reviewed and remains scoped;
- documentation was updated when necessary;
- residual limitations are declared.

### Genuine external blocker

- a material product decision is missing;
- authority for an external or destructive action is missing;
- an indispensable credential, service, device, or environment is unavailable;
- an essential check has no safe alternative;
- the environment prevents progress after diagnosis and distinct attempts.

Difficulty, slowness, initial uncertainty, or a preference for more context are
not blockers by themselves.

## Final delivery

Use the shortest report that preserves evidence:

```text
STATUS: COMPLETE | PARTIALLY VERIFIED | BLOCKED

Delivered:
- changed files or behavior.

Verified:
- commands, checks, and objective results.

Limitations:
- what was not proven and why.

Publication:
- commit, push, pull request, merge, or deployment state when applicable.
```

Never claim that a test, build, platform, device, or integration passed without
a compatible check. The final response must distinguish local implementation
from external publication.
