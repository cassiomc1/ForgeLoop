# ForgeLoop terminology

| Term | Meaning |
| --- | --- |
| Adapter | A thin native instruction entry file that points an agent to the canonical protocol. |
| Guide | A focused technical Markdown document selected for a task surface or risk. |
| Route | The deterministic guide set produced after an agent declares routing signals. |
| Contract | The observable objective, deliverables, constraints, risks, verification, authority, and stop condition for a task. |
| Checkpoint | A validated local snapshot of compatible work state stored under `.forgeloop`. |
| Receipt | A structured, secret-free summary of changes, checks, review, limitations, and publication state. |
| Review | A specification and implementation quality check performed after verification. |
| Independent review | A review performed by an identity different from the implementer and explicitly marked independent. |
| Blocker | A genuine condition that prevents safe progress and has a category and evidence. |
| Capability | A model, harness, tool, or system feature required by a scoped operation. |
| Authority | The explicit permission and target boundary for a destructive or external action. |
| Publication | Push, pull request, merge, release, or deployment; none is implied by local success. |
| Portable protocol | A serializable, framework-neutral contract that compatible agents can execute in their own harness. |
| Runtime | A process that owns execution, scheduling, model calls, or persistence; `ForgeLoop` intentionally does not provide one. |
| Evidence kind | One of `OBSERVED`, `INFERRED`, `NOT_VERIFIED`, or `BLOCKED`; evidence never upgrades an unverified claim by itself. |
| Required artifact | A checkpoint-recorded relative path and SHA-256 hash that must still match before resume. |
| Conformance | Relationship validation across route, state, receipt, task brief, and delegated-result artifacts. |
| Universal applicability | ForgeLoop applies whenever an execution environment discovers a project adapter, regardless of model, provider, agent, IDE, or tool name. |
| Integration level | The capability tier of an execution environment (`INSTRUCTION_DISCOVERED`, `PROTOCOL_CAPABLE`, `PROTOCOL_LIMITED`, `CONFORMANCE_VERIFIED`). |

| Execution continuity | Bounded current-task implementation context used to resume the same ForgeLoop task across sessions or harnesses. |
| Continuity artifact | `.forgeloop/continuity.json`; non-evidence operational context bound to canonical work state. |
| Continuity reconciliation | Read-only comparison of continuity bindings and path hints against current canonical state and checkout. |
| Executable policy rule | A structured rule with an automated checker evaluating constraints on code and artifacts. |
| Policy discovery | Deterministic non-interactive inspection of codebase structure and conventions with confidence levels. |
| Brownfield baseline | Cryptographically fingerprinted list of pre-existing policy violations tolerated without blocking progress. |
| Violation fingerprint | SHA-256 hash uniquely identifying a violation by rule, file, and line/content hash. |
| Monotonic ratchet | Invariant ensuring brownfield baseline debt only decreases as legacy violations are resolved. |
| Mutation verification | Proving checker capability by asserting failure on intentionally mutated code fixtures. |
| Proof digest | Cryptographic digest confirming a checker caught a mutation fixture. |
| Inert check | A verification rule whose check target or scope does not exist or matches 0 files in the codebase. |
| Policy drift | Divergence between task preflight snapshot policy and current workspace policy. |
| Policy diff | Semantic classification of policy changes into `TIGHTEN`, `NEUTRAL`, `WEAKEN`, or `UNKNOWN`. |

