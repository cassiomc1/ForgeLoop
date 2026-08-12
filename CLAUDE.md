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
9. Report current evidence, limitations, and publication state without claiming checks that were not run.

Do not duplicate guide rules here; treat the loop and router as canonical sources.
