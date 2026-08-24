# Documentation index

The machine-readable inventory is
[`docs/documentation-manifest.json`](./docs/documentation-manifest.json). It
classifies every package-shipped document, names canonical concept owners, and
records generated/deprecated-document metadata. Normative requirements and
their implementation/test mappings are in
[`docs/protocol-requirements.json`](./docs/protocol-requirements.json).

ForgeLoop keeps one canonical process and separates protocol behavior from
integration and guide context. Use this map before editing documentation.

## Ownership map

| Need | Canonical source | Boundary |
| --- | --- | --- |
| Getting started tutorial | [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) | First-time walkthrough from init to completion |
| Cross-harness continuity | [`docs/CROSS_HARNESS_CONTINUITY.md`](./docs/CROSS_HARNESS_CONTINUITY.md) | Operational handoff and multi-tool resumption |
| CLI command reference | [`docs/CLI_REFERENCE.md`](./docs/CLI_REFERENCE.md) | Full syntax, options, and JSON examples for all commands |
| Artifact and schema reference | [`docs/ARTIFACT_REFERENCE.md`](./docs/ARTIFACT_REFERENCE.md) | Purpose, mutability, and trust classifications of `.forgeloop/` |
| Troubleshooting and recovery | [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) | Symptom-first recovery and stable error code reference |
| Operational recipes | [`docs/RECIPES.md`](./docs/RECIPES.md) | Short copy-paste recipes for daily workflows |
| Diagnostic model | [`docs/DIAGNOSTIC_MODEL.md`](./docs/DIAGNOSTIC_MODEL.md) | Structured diagnostic cases, interventions, hypothesis dispositions, information gain |
| Execution trace and observability | [`docs/EXECUTION_TRACE.md`](./docs/EXECUTION_TRACE.md) | `history`, `trace`, `reflect`, and task-level `inspect` read-only projections |
| Universal integration API | [`docs/UNIVERSAL_INTEGRATION.md`](./docs/UNIVERSAL_INTEGRATION.md) | Programmatic integration subpath, envelope semantics, and consumer map |
| Local-first MCP adapter | [`docs/MCP.md`](./docs/MCP.md) | stdio default, optional strict loopback HTTP; server modes/capabilities and canonical resources |
| Documentation guide | [`docs/DOCUMENTATION_GUIDE.md`](./docs/DOCUMENTATION_GUIDE.md) | Rules and checklist for modifying documentation |
| ForgeLoop 1.5/MCP release checklist | [`docs/RELEASE_CHECKLIST_1_5_MCP.md`](./docs/RELEASE_CHECKLIST_1_5_MCP.md) | Integration API v1, MCP package, and publication gates |
| ForgeLoop 1.4 release checklist | [`docs/RELEASE_CHECKLIST_1_4.md`](./docs/RELEASE_CHECKLIST_1_4.md) | Claim-recovery, compatibility, package, and publication gates |
| Lifecycle, gates, planning, verification, and recovery | [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) | Normative process for agents and developer workflows |
| Capability levels, discovery, and degradation | [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md) | Vendor-neutral harness contract |
| Host/orchestrator integration | [`ORCHESTRATOR_INTEGRATION.md`](./ORCHESTRATOR_INTEGRATION.md) | Serializable phases, transition boundaries, host responsibilities, and no-runtime integration contract |
| Durable project facts | [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) | Target-specific facts only; no prompts or secrets |
| Guide selection | [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) | Deterministic routing and exclusions |
| Architecture and safety boundaries | [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) and [`THREAT_MODEL.md`](./THREAT_MODEL.md) | Design rationale and residual risk |
| Artifact and phase schemas | [`schemas/`](./schemas/) and [`CONTRACT_COVERAGE.md`](./CONTRACT_COVERAGE.md) | Versioned machine-readable contract |
| CLI/package behavior | [`src/`](./src/) and [`tests/`](./tests/) | Executable implementation and regression evidence |
| Guide content | [`ENG/`](./ENG/) | Context-specific, English-only operational guides |
| Diagram | [`docs/forgeloop-flow.mmd`](./docs/forgeloop-flow.mmd) | Canonical Mermaid source; SVG is generated output |

## Audience map

| I am a... | Start here |
| --- | --- |
| **First-time user or developer** | [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) |
| **AI coding agent / harness** | [`AGENTS.md`](./AGENTS.md) → [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) |
| **Harness integrator** | [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md) |
| **External runtime / orchestrator integrator** | [`ORCHESTRATOR_INTEGRATION.md`](./ORCHESTRATOR_INTEGRATION.md) |
| **Resuming another tool / session** | [`docs/CROSS_HARNESS_CONTINUITY.md`](./docs/CROSS_HARNESS_CONTINUITY.md) |
| **Looking up CLI commands** | [`docs/CLI_REFERENCE.md`](./docs/CLI_REFERENCE.md) |
| **Inspecting `.forgeloop/` files** | [`docs/ARTIFACT_REFERENCE.md`](./docs/ARTIFACT_REFERENCE.md) |
| **Fixing a broken or stale state** | [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) |
| **Looking for quick recipes** | [`docs/RECIPES.md`](./docs/RECIPES.md) |
| **Documentation contributor** | [`docs/DOCUMENTATION_GUIDE.md`](./docs/DOCUMENTATION_GUIDE.md) |
| **Release maintainer (current)** | [`docs/RELEASE_CHECKLIST_1_5_MCP.md`](./docs/RELEASE_CHECKLIST_1_5_MCP.md) |
| **Release maintainer (historical 1.4)** | [`docs/RELEASE_CHECKLIST_1_4.md`](./docs/RELEASE_CHECKLIST_1_4.md) |
| **Protocol architect / maintainer** | [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) + [`schemas/`](./schemas/) |
| **Security auditor** | [`THREAT_MODEL.md`](./THREAT_MODEL.md) |
| **Engineering guide author** | [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) + [`ENG/`](./ENG/) |

## Task map

- **Start my first task**: [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md)
- **Resume after switching tools**: [`docs/CROSS_HARNESS_CONTINUITY.md`](./docs/CROSS_HARNESS_CONTINUITY.md)
- **Check CLI options and syntax**: [`docs/CLI_REFERENCE.md`](./docs/CLI_REFERENCE.md)
- **Understand what `.forgeloop/` stores**: [`docs/ARTIFACT_REFERENCE.md`](./docs/ARTIFACT_REFERENCE.md)
- **Fix a blocked, stale, or invalid state**: [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)
- **Recover a stale task or reacquire released claims**: [`docs/RECIPES.md`](./docs/RECIPES.md#recipe-15--release-and-reacquire-claims-for-an-abandoned-task)
- **Find operational copy-paste commands**: [`docs/RECIPES.md`](./docs/RECIPES.md)
- **Read the normative protocol specification**: [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md)
- **Integrate a new AI environment**: [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md)
- **Map ForgeLoop state into an external runtime/orchestrator**: [`ORCHESTRATOR_INTEGRATION.md`](./ORCHESTRATOR_INTEGRATION.md)
- **Edit documentation safely**: [`docs/DOCUMENTATION_GUIDE.md`](./docs/DOCUMENTATION_GUIDE.md)

`README.md` is intentionally a catalog and quickstart. Do not copy the full
process into adapters or README sections; link to the canonical source.

## Lifecycle reading order

1. Read [`README.md`](./README.md) for scope and quickstart.
2. Read [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) for the process gates.
3. Read [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md) for the active
   runtime or harness boundary.
4. Inspect [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) and confirm facts from
   the repository before using them.
5. Use [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) to select only relevant guides.
6. Use [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) and schemas when a
   change affects protocol invariants or artifact shape.

## Verification and release

The Node regression suite, ESLint, c8, dependency policy, package boundary,
and Mermaid render are the local executable checks. Python validators remain
frozen CI-only compatibility tools because they cover historical Markdown,
loop, and secret-scanning contracts that have not been migrated to Node. Their
scope, exact commands, and migration boundary are recorded in
[`scripts/CI_VALIDATORS.md`](./scripts/CI_VALIDATORS.md).

The package has no runtime dependencies. Development dependencies are limited
to ESLint, c8, and Mermaid CLI and are checked by
`npm run dependency:policy`. GitHub Actions use `npm ci`, pinned action SHAs,
CodeQL, dependency review, and generated-release notes; npm publication still
uses trusted OIDC publishing and is not implied by local verification.

## Editing rules

- Keep lifecycle prose, the Mermaid source, and the text-only README fallback
  synchronized.
- Keep generated `docs/assets/forgeloop-flow.svg` synchronized with the Mermaid
  source by running `npm run docs:flow` and `npm run docs:check`. CI validates
  the source fingerprint instead of comparing renderer-specific SVG geometry.
- Preserve the distinction between implemented behavior, local evidence, and
  external publication or production state.
- Run `npm run lint`, `npm run coverage`, `npm run pack:check`, and the Python
  CI-only validators proportionally to the change.
