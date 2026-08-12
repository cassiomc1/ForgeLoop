# GitHub Copilot — Universal Project Loop

Use these instructions across the repository while preserving more specific
directory or file rules.

- Read [`LOOP_ENGINEERING.md`](../LOOP_ENGINEERING.md) before implementing.
- Confirm [`PROJECT_PROFILE.md`](../PROJECT_PROFILE.md) from evidence. Initialize it in a target project when it remains in `template` mode.
- Select context with [`GUIDE_ROUTER.md`](../GUIDE_ROUTER.md); use all applicable guides and only those guides.
- Report the activated guide IDs.
- Respect the latest request, scope, and higher-level instructions.
- Make the smallest coherent change and validate it with a specific check followed by proportional regression checks.
- Diagnose the cause before fixing a failure; do not make random attempts.
- Do not install unrelated software, publish, delete, migrate, or alter external state without authority. For a task-scoped missing Qwen-MM-Plugins capability, follow `LOOP_ENGINEERING.md`; API credentials and system dependencies remain separately gated.
- After implementation begins, do not return a final result in `EXECUTING`: follow `VERIFYING` → structured evidence → `REVIEWING` → execution receipt → validator-backed `COMPLETE`; otherwise report `BLOCKED` or `PARTIALLY VERIFIED` with exact findings.
- Report the result, checks actually run, limitations, and publication state.

The loop and router are canonical; do not replicate domain rules here.
