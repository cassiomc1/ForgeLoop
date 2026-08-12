# Universal Project Loop Instructions

These instructions apply to the entire repository unless a closer, more
specific rule overrides them.

1. Follow platform rules, the user's latest request, and applicable local instructions first.
2. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) before planning or changing files.
3. Inspect [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md). Confirm facts from their sources; initialize the profile in a target project when it is still in `template` mode.
4. Use [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) to select all relevant guides and only those guides.
5. Briefly report the activated guide IDs.
6. Make the smallest coherent change, run specific checks, and then run proportional regression checks.
7. Diagnose a failure before fixing it; do not repeat the same attempt without new evidence.
8. Do not install unrelated software, publish, delete, migrate data, or change external systems without applicable authority. For a task-scoped missing Qwen-MM-Plugins capability, follow the discovery protocol in `LOOP_ENGINEERING.md`; API credentials and system dependencies remain separately gated.
9. Before implementation, create/validate `.forgeloop/current-contract.json`, persist deterministic routing, satisfy mandatory gates, and require `forgeloop preflight` to return `READY`.
10. Before claiming `COMPLETE`, require `forgeloop complete` to return `VALID`; otherwise report completion as not protocol-verified.
11. After implementation begins, do not return a final result in `EXECUTING`: advance through `VERIFYING`, record structured evidence, reach `REVIEWING`, prepare/update the execution receipt, and require `forgeloop complete` to return `VALID`. If closure cannot be reached, report `BLOCKED` or `PARTIALLY VERIFIED` with exact findings.
12. Finish with the result, checks actually run, limitations, and publication state.

The guides provide technical defaults; explicit requirements and project evidence prevail.
