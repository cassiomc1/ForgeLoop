# Documentation index

ForgeLoop keeps one canonical process and separates protocol behavior from
integration and guide context. Use this map before editing documentation.

## Ownership map

| Need | Canonical source | Boundary |
| --- | --- | --- |
| Lifecycle, gates, planning, verification, and recovery | [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) | Normative process for agents and developer workflows |
| Capability levels, discovery, and degradation | [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md) | Vendor-neutral harness contract |
| Durable project facts | [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) | Target-specific facts only; no prompts or secrets |
| Guide selection | [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) | Deterministic routing and exclusions |
| Architecture and safety boundaries | [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) and [`THREAT_MODEL.md`](./THREAT_MODEL.md) | Design rationale and residual risk |
| Artifact and phase schemas | [`schemas/`](./schemas/) and [`CONTRACT_COVERAGE.md`](./CONTRACT_COVERAGE.md) | Versioned machine-readable contract |
| CLI/package behavior | [`src/`](./src/) and [`tests/`](./tests/) | Executable implementation and regression evidence |
| Guide content | [`ENG/`](./ENG/) | Context-specific, English-only operational guides |
| Diagram | [`docs/forgeloop-flow.mmd`](./docs/forgeloop-flow.mmd) | Canonical Mermaid source; SVG is generated output |

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
- Keep generated `docs/assets/forgeloop-flow.svg` reproducible from the Mermaid
  source with `npm run docs:flow`.
- Preserve the distinction between implemented behavior, local evidence, and
  external publication or production state.
- Run `npm run lint`, `npm run coverage`, `npm run pack:check`, and the Python
  CI-only validators proportionally to the change.
