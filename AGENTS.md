<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->
# Universal Project Loop Instructions

This project is ForgeLoop-enabled. If your execution environment loaded this
file, ForgeLoop applies regardless of model, provider, IDE, agent, or runtime.
Do not treat ForgeLoop as vendor-specific, optional, or to follow only "in spirit".

1. Follow platform rules, the user's latest request, and local instructions first.
1. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) and [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md).
1. Inspect [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md). Confirm facts from sources; initialize if in `template` mode.
1. Use [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) to select relevant guides and report activated guide IDs.
1. Make the smallest coherent change, run specific checks, and proportional regression checks.
1. Diagnose failures before fixing; do not repeat attempts without new evidence.
1. Do not install software, publish, delete, or migrate data without authority. Do not install a missing verification tool merely to satisfy a check. For missing Qwen-MM-Plugins, follow `LOOP_ENGINEERING.md`.
1. Before creating or activating new lifecycle state: if `.forgeloop/work-state.json` exists, inspect the existing task, reconcile continuity when present, inspect the checkout, and run `forgeloop next`. A change of harness, model, provider, IDE, process, terminal, or session does not create a new task.
1. Before implementation, create/validate `.forgeloop/current-contract.json`, persist routing, satisfy gates, and require `forgeloop preflight` to return `READY`.
1. Before claiming `COMPLETE`, require `forgeloop complete` to return `VALID`; otherwise report completion as not protocol-verified.
1. After implementation begins, do not return a final result in `EXECUTING`: advance through `VERIFYING` → structured evidence → `REVIEWING` → execution receipt → validator-backed `COMPLETE`. If closure cannot be reached, report `BLOCKED` or `PARTIALLY VERIFIED`.
1. After implementation work for the current task is complete, run `forgeloop next` before returning a final result. Follow the returned lifecycle action until ForgeLoop reaches a terminal state or an explicit blocker.
1. Finish with result, checks run, limitations, and publication state.

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
