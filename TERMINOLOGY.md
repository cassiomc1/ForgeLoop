# mdfiles terminology

| Term | Meaning |
| --- | --- |
| Adapter | A thin native instruction entry file that points an agent to the canonical protocol. |
| Guide | A focused technical Markdown document selected for a task surface or risk. |
| Route | The deterministic guide set produced after an agent declares routing signals. |
| Contract | The observable objective, deliverables, constraints, risks, verification, authority, and stop condition for a task. |
| Checkpoint | A validated local snapshot of compatible work state stored under `.mdfiles`. |
| Receipt | A structured, secret-free summary of changes, checks, review, limitations, and publication state. |
| Review | A specification and implementation quality check performed after verification. |
| Independent review | A review performed by an identity different from the implementer and explicitly marked independent. |
| Blocker | A genuine condition that prevents safe progress and has a category and evidence. |
| Capability | A model, harness, tool, or system feature required by a scoped operation. |
| Authority | The explicit permission and target boundary for a destructive or external action. |
| Publication | Push, pull request, merge, release, or deployment; none is implied by local success. |
| Portable protocol | A serializable, framework-neutral contract that compatible agents can execute in their own harness. |
| Runtime | A process that owns execution, scheduling, model calls, or persistence; `mdfiles` intentionally does not provide one. |
| Evidence kind | One of `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, or `BLOCKED`; evidence never upgrades an unverified claim by itself. |
| Required artifact | A checkpoint-recorded relative path and SHA-256 hash that must still match before resume. |
| Conformance | Relationship validation across route, state, receipt, task brief, and delegated-result artifacts. |
