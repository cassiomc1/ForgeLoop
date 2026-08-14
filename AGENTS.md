<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->
# Universal Project Loop Instructions

This project is ForgeLoop-enabled. If your execution environment loaded this
file, ForgeLoop applies regardless of model, provider, IDE, agent, or runtime.
Do not treat ForgeLoop as vendor-specific, optional, or to follow only "in spirit".

1. Follow platform rules, the user's latest request, and local instructions first.
2. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) and [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md).
3. Inspect [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md). Confirm facts from sources; initialize if in `template` mode.
4. Use [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) to select relevant guides and report activated guide IDs.
5. Make the smallest coherent change, run specific checks, and proportional regression checks.
6. Diagnose failures before fixing; do not repeat attempts without new evidence.
7. Do not install software, publish, delete, or migrate data without authority. For missing Qwen-MM-Plugins, follow `LOOP_ENGINEERING.md`.
8. Before implementation, create/validate `.forgeloop/current-contract.json`, persist routing, satisfy gates, and require `forgeloop preflight` to return `READY`.
9. Before claiming `COMPLETE`, require `forgeloop complete` to return `VALID`; otherwise report completion as not protocol-verified.
10. After implementation begins, do not return a final result in `EXECUTING`: advance through `VERIFYING` → structured evidence → `REVIEWING` → execution receipt → validator-backed `COMPLETE`. If closure cannot be reached, report `BLOCKED` or `PARTIALLY VERIFIED`.

After implementation work for the current task is complete, run `forgeloop next` before returning a final result. Follow the returned lifecycle action until ForgeLoop reaches a terminal state or an explicit blocker.

11. Finish with result, checks run, limitations, and publication state.

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
