# Claude Code — Universal Project Loop

When working in this repository:

1. Follow higher-level instructions, the user's latest request, and the closest rules for the file in scope.
2. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) before planning or editing.
3. Verify [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) against real sources. Initialize it in a target project when it remains in `template` mode.
4. Consult [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md), select all relevant guides and only those guides, and announce their IDs.
5. Make small changes, run a specific check, and then run proportional regression checks.
6. Investigate the root cause of a failure before fixing it.
7. Request authority for unrelated installation, publication, deletion, migration, or another external or destructive action. For a task-scoped missing Qwen-MM-Plugins capability, follow `LOOP_ENGINEERING.md`; API credentials and system dependencies remain separately gated.
8. After implementation begins, do not return a final result in `EXECUTING`: follow `VERIFYING` → structured evidence → `REVIEWING` → execution receipt → validator-backed `COMPLETE`; otherwise report `BLOCKED` or `PARTIALLY VERIFIED` with exact findings.

9. After implementation work for the current task is complete, run `forgeloop next`
before returning a final result. Follow the returned lifecycle action until
ForgeLoop reaches a terminal state or an explicit blocker.
10. Report current evidence, limitations, and publication state without claiming checks that were not run.

Do not stop for non-blocking missing product details. When a safe, reversible
local default exists, record it as an agent assumption and follow the Blocking vs Non-Blocking Decisions policy in `LOOP_ENGINEERING.md`. Ask only for
load-bearing, irreversible, externally consequential, unsafe, or real
user/business decisions.

Do not duplicate guide rules here; treat the loop and router as canonical sources.

## Pre-question decisions

Before asking any product-detail question, classify it as `BLOCKING` or
`NON_BLOCKING` using `LOOP_ENGINEERING.md`. For
`NON_BLOCKING`, choose a safe reversible local default, record it in
`current-contract.assumptions[]`, and continue. For `BLOCKING`, persist
`current-contract.json` with `unresolvedDecisions[]` and a blocking reason
before asking. Do not ask the user to choose among reversible local
product-positioning alternatives; the canonical checklist and boundary remain
in `LOOP_ENGINEERING.md`.
