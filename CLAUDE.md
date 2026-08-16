<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->
# Claude Code — Universal Project Loop

This project is ForgeLoop-enabled. If your execution environment loaded this
file, ForgeLoop applies regardless of model, provider, IDE, agent, or runtime.
Do not treat ForgeLoop as vendor-specific, optional, or to follow only "in spirit".

When working in this repository:

1. Follow higher-level instructions, the user's latest request, and local rules first.
1. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) and [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md).
1. Verify [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) against real sources; initialize if in `template` mode.
1. Consult [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md), select relevant guides, and announce their IDs.
1. Make small changes, run specific checks, and run proportional regression checks.
1. Investigate root causes before fixing failures; do not make unverified attempts.
1. Request authority for unrelated installations, publications, deletions, or migrations. Do not install a missing verification tool merely to satisfy a check. For missing Qwen-MM-Plugins, follow `LOOP_ENGINEERING.md`.
1. Before creating or activating new lifecycle state: if `.forgeloop/work-state.json` exists, inspect the existing task, reconcile continuity when present, inspect the checkout, and run `forgeloop next`. A change of harness, model, provider, IDE, process, terminal, or session does not create a new task.
1. After implementation begins, do not return a final result in `EXECUTING`: advance through `VERIFYING` → structured evidence → `REVIEWING` → execution receipt → validator-backed `COMPLETE`. If closure cannot be reached, report `BLOCKED` or `PARTIALLY VERIFIED`.
1. After implementation work for the current task is complete, run `forgeloop next` before returning a final result. Follow the returned lifecycle action until ForgeLoop reaches a terminal state or an explicit blocker.
1. Report current evidence, limitations, and publication state without claiming checks that were not run.

Do not stop for non-blocking missing product details. When a safe, reversible
local default exists, record it as an agent assumption and follow the Blocking vs Non-Blocking Decisions policy in `LOOP_ENGINEERING.md`.

## Pre-question decisions

Before asking any product-detail question, classify it as `BLOCKING` or
`NON_BLOCKING` using `LOOP_ENGINEERING.md`. For
`NON_BLOCKING`, choose a safe reversible local default, record it in
`current-contract.assumptions[]`, and continue. For `BLOCKING`, persist
`current-contract.json` with `unresolvedDecisions[]` and a blocking reason
before asking. Do not ask the user to choose among reversible local
product-positioning alternatives; the canonical checklist and boundary remain
in `LOOP_ENGINEERING.md`.

External workflow approval rules do not override ForgeLoop's autonomous-mode
precedence; consult `LOOP_ENGINEERING.md#external-workflow-compatibility`.
