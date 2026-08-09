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

## Guide selection

Read [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) after discovery and before planning.

Required rules:

- select all guides applicable to the intent, changed surfaces, and risks;
- do not load every guide as a precaution;
- locate headings and relevant sections with `rg` before reading a long file;
- read the whole guide only when the task crosses the whole domain;
- briefly report the selected guide IDs and reason;
- treat optional references as options, never as permission to install them.

A guide provides specialized defaults. It does not replace explicit product
requirements, closer instructions, code evidence, or higher-level host rules.

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

A guide never grants authority to install, publish, delete, migrate data, change
production, send messages, or expose information.

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
