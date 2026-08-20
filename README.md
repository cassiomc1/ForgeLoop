# ForgeLoop — Verifiable Engineering Protocol

<p align="center">
  <img src="./docs/assets/eng_readme_forgeloop.png" alt="ForgeLoop — Loop Engineering for AI Agents" width="100%">
</p>

[![Docs quality](https://github.com/cassiomc1/forgeloop/actions/workflows/docs-quality.yml/badge.svg?branch=main)](https://github.com/cassiomc1/forgeloop/actions/workflows/docs-quality.yml)

ForgeLoop is a portable, vendor-neutral protocol for AI-assisted development
and developer workflows. It turns an outcome into a contract, deterministic
routing, resumable state, evidence-backed verification, recovery, cross-harness
continuity, and validator-backed completion. It is a protocol/support CLI, not
an agent or LLM runtime, not an agent framework, and not a graph orchestrator.

The operational sources are indexed in [`DOCS_INDEX.md`](./DOCS_INDEX.md).
[`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) is the canonical process;
[`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md) defines capability
levels and discovery; [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) stores
durable project facts; and [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) selects only
relevant guides.

## Where should I start?

- **New to ForgeLoop** → [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md)
- **Full protocol specification** → [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md)
- **Integrating an AI harness** → [`PROTOCOL_INTEGRATION.md`](./PROTOCOL_INTEGRATION.md)
- **Continuing another harness's task** → [`docs/CROSS_HARNESS_CONTINUITY.md`](./docs/CROSS_HARNESS_CONTINUITY.md)
- **CLI command reference** → [`docs/CLI_REFERENCE.md`](./docs/CLI_REFERENCE.md)
- **Artifact & schema reference** → [`docs/ARTIFACT_REFERENCE.md`](./docs/ARTIFACT_REFERENCE.md)
- **Operational recipes** → [`docs/RECIPES.md`](./docs/RECIPES.md)
- **Troubleshooting & error codes** → [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)
- **System architecture & safety** → [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) & [`THREAT_MODEL.md`](./THREAT_MODEL.md)
- **Documentation index & ownership** → [`DOCS_INDEX.md`](./DOCS_INDEX.md)

## Catalog

| Topic | Guide |
| --- | --- |
| Premium websites | [`ENG/premium-sites-studio-eng.md`](./ENG/premium-sites-studio-eng.md) |
| Clean code | [`ENG/clean-code-eng.md`](./ENG/clean-code-eng.md) |
| Testing | [`ENG/test-code-eng.md`](./ENG/test-code-eng.md) |
| Security | [`ENG/sec-code-eng.md`](./ENG/sec-code-eng.md) |
| Design and UX | [`ENG/design-code-eng.md`](./ENG/design-code-eng.md) |
| Taste frontend | [`ENG/taste-frontend-eng.md`](./ENG/taste-frontend-eng.md) |
| Performance | [`ENG/perf-code-eng.md`](./ENG/perf-code-eng.md) |
| Accessibility | [`ENG/accessibility-eng.md`](./ENG/accessibility-eng.md) |
| Web games | [`ENG/games-code-design-web-eng.md`](./ENG/games-code-design-web-eng.md) |
| Documentation quality | [`ENG/documentation-quality-eng.md`](./ENG/documentation-quality-eng.md) |

Each guide declares its name, language, version, and review date in
frontmatter. Repository validators keep the catalog and metadata synchronized.

## Quickstart

### Demonstração em 60 segundos

Em um diretório descartável, inicialize o kit e crie uma tarefa isolada. O
resultado é determinístico e pode ser inspecionado por qualquer harness
compatível:

```bash
npx @cassiomc1/forgeloop init
forgeloop task-create --task demo --claim src --json
forgeloop route --task demo --work clean-code --json
forgeloop preflight --task demo --json
forgeloop next --task demo --json
```

O último comando informa a ação segura seguinte; ele não executa código nem
agenda agentes.

### Responsabilidades

| Responsabilidade | ForgeLoop | Harness ou desenvolvedor |
| --- | --- | --- |
| Validar contrato e rotas | Sim | Fornece intenção e sinais |
| Implementar código | Não | Sim |
| Registrar proveniência de comando | Sim, com `run-check` | Fornece comando e ambiente |
| Validar conclusão | Sim | Fornece trabalho e evidência reais |
| Agendar agentes ou inferência LLM | Não | Externo ao protocolo |

Para uma troca concreta entre ferramentas, veja a
[continuidade entre harnesses](./docs/CROSS_HARNESS_CONTINUITY.md).

From a published package, initialize a target project with:

```bash
npx @cassiomc1/forgeloop init
npx @cassiomc1/forgeloop doctor
```

The CLI installs canonical documents under `.forgeloop/kit/`, keeps small
native discovery shims at the project root, stores project-scoped
configuration under `.forgeloop/`, and stores task-scoped protocol artifacts
under `.forgeloop/task-state/<taskKey>/`.
`update` preserves target-specific profile facts and locally modified files.

Before npm publication, the same source checkout can be exercised without a
network or package lookup:

```bash
node src/cli.js init
node src/cli.js doctor
node src/cli.js update
```

## Universal project loop

The lifecycle is:

```text
request → discovery → contract → routing → plan → execution
        → verification → review → completion validation
              ↑                         │
              └──── evidence-only rejection / next cycle
```

The harness writes a schema-valid task contract under
`.forgeloop/task-state/<taskKey>/contract.json`, required gate artifacts, and
routing. `preflight` must return `PREFLIGHT_READY` before implementation.
ForgeLoop then records an append-only event ledger and protects the lifecycle
with contract, route, repository, and artifact fingerprints.

Typical local commands are:

```bash
forgeloop task-create --task example-task --claim src --claim tests --json
forgeloop route --task example-task --work complete-website --surface ui --risk untrusted-input
forgeloop activate
forgeloop preflight --task example-task --json
forgeloop next --task example-task --json
forgeloop advance --task example-task --to PLANNED
forgeloop advance --task example-task --to EXECUTING
forgeloop advance --task example-task --to VERIFYING
forgeloop prepare-completion --task example-task --json
forgeloop run-check --task example-task --json --id tests --requirement tests -- npm test
forgeloop advance --task example-task --to REVIEWING
forgeloop audit --task example-task --json
forgeloop complete --task example-task --json
```

`advance` changes protocol phase only; it never runs target commands.
`run-check` classifies the exact argv before launch and records ForgeLoop-owned
execution provenance. `record-check` stores an observation and never executes
the text supplied to `--command`. `record-diagnosis` appends an authoritative
root-cause hypothesis to the event ledger. `progress` evaluates task
progression and detects stalls deterministically. `complete` validates the
contract, route, gates, ledger, evidence, coverage, receipt, and freshness.
`audit` is read-only. `report` exposes independent completion, publication,
and production-readiness dimensions.

The status precedence is `INVALID` > `INCONSISTENT` > `STALE` > `INCOMPLETE` >
`VALID`. A `READY` preflight is a resumable checkpoint: if its work state is
missing, `forgeloop next` returns `RESOLVE_BLOCKER` rather than silently
falling back to discovery. Delegation artifacts are required only when
delegation is present in the execution history; ForgeLoop does not provide a
graph runtime, agent runtime, or hidden prompt store.

### Cross-harness continuity

ForgeLoop preserves task state when switching between AI coding tools, IDEs, or terminals:

```bash
forgeloop status --task example-task --json
forgeloop continuity --task example-task --json
forgeloop reconcile-continuity --task example-task --json
forgeloop next --task example-task --json
```

See [`docs/CROSS_HARNESS_CONTINUITY.md`](./docs/CROSS_HARNESS_CONTINUITY.md) for full handoff and recovery procedures.

### Multi-task concurrent project state

ForgeLoop supports isolated, concurrent tasks within the same repository via deterministic SHA-256 namespacing, per-task mutex locking, and write-claim conflict detection:

```bash
# Create an isolated task claiming specific directories
forgeloop task-create --task auth-feature --claim src/auth --claim tests/auth --json

# List active and completed tasks
forgeloop task-list --json

# Run standard lifecycle commands targeting the task
forgeloop route --task auth-feature --work clean-code --surface backend
forgeloop preflight --task auth-feature --json
forgeloop advance --task auth-feature --to EXECUTING
forgeloop complete --task auth-feature --json

# Migrate legacy 1.0 single-task layout
forgeloop task-migrate --json
```

### Executable policy verification & brownfield baselines

ForgeLoop enforces automated, non-interactive verification rules (`rules.json`) with zero interactive dependencies:

```bash
# Discover architecture conventions and candidate rules (read-only unless --write)
forgeloop policy-discover --json

# Inspect active policy verification status, baselines, and drift
forgeloop policy-status --json

# Record brownfield legacy debt into baseline to prevent blocking
forgeloop baseline --record --json

# Monotonically ratchet down resolved technical debt
forgeloop baseline --update --json

# Prove rule checker efficacy against synthetic mutation fixtures
forgeloop rule-verify --rule SECURITY.NO_HARDCODED_SECRET --json
```

A policy-bound task captures its effective rules and semantic baseline in
`.forgeloop/task-state/<taskKey>/policy-snapshot.json`. The project lock at
`.forgeloop/policy/policy.lock` protects the effective rules plus baseline and
must contain matching `algorithm`, `digest`, `rulesDigest`, and `baselineDigest`
values. `capturedAt` is informational metadata and does not change semantic
identity. During an active task, `baseline --update` may remove resolved debt,
but `baseline --record` is blocked unless an operator explicitly supplies
`--policy-reset-authorized`. Use `forgeloop next --task <id> --json` to receive
semantic recovery such as `RESTORE_POLICY`, `REPAIR_CHECKER`, or
`RESTORE_BASELINE` when verification detects drift or corruption.

See [`docs/CLI_REFERENCE.md`](./docs/CLI_REFERENCE.md) and [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md) for architecture details.

## Architecture flow

The canonical source is [`docs/forgeloop-flow.mmd`](./docs/forgeloop-flow.mmd),
and the committed render is [`docs/assets/forgeloop-flow.svg`](./docs/assets/forgeloop-flow.svg).
The broader architecture and boundaries are in
[`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md).

![ForgeLoop evidence-first engineering flow](./docs/assets/forgeloop-flow.svg)

Text-only fallback: discovery creates the contract and route; required gates
and `PREFLIGHT_READY` authorize execution; verification creates structured
evidence; failures enter diagnosis and correction; review precedes
validator-backed completion. Drift reopens verification, and migration keeps
modified or unmanaged files for review. The terminal result is one of
`VALID`, `INCOMPLETE`, `STALE`, `INCONSISTENT`, or `INVALID`.

## Protocol compatibility

The npm package version is independent of protocol version. The current
serializable artifact contract is `schemaVersion: 1` and `protocolVersion: 1`.

- Patch releases preserve the v1 schemas, enums, transitions, and existing
  command contracts while correcting implementation defects.
- Minor releases preserve existing v1 artifacts and commands; they may add
  documentation, commands, guides, or an explicitly named schema.
- Major releases may change required fields, enums, transitions, or safety
  semantics and must document migration requirements with a protocol version
  change.

Consumers must reject unknown artifact fields rather than silently treating
unrecognized protocol data as valid. The compatibility marker is
[`tests/fixtures/compatibility/protocol-v1.json`](./tests/fixtures/compatibility/protocol-v1.json).

## Security and dependency boundary

The runtime uses Node built-ins only and does not install agents, providers,
plugins, remote services, or telemetry. Target paths and symlinks are bounded;
JSON is size/depth limited; manifests, schemas, receipts, and secret-like
values are checked; and install-capable verification requires trusted host
authority. See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the full inventory.

Development tooling is intentionally separate from runtime dependencies. The
repository policy allows only ESLint, c8, and Mermaid CLI as development
dependencies; `npm run dependency:policy` fails if runtime or unapproved
dependencies appear.

Para reportar vulnerabilidades ou contribuir com alterações, consulte
[`SECURITY.md`](./SECURITY.md) e [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Autonomous blind-run isolation

The repository does not claim a live blind conformance result for an external
harness. The isolated scenario is `TEST_NOT_STARTED`; do not reinterpret it as
a pass or failure. The compatible autonomous boundary is explicit:

```text
mandatory-approval workflows enabled: NO
external brainstorming hard gate enabled: NO
external design approval gate enabled: NO
subagents enabled: NO
delegation enabled: NO
```

An environment that requires those gates is `INCOMPATIBLE WITH AUTONOMOUS MODE`.
This constraint concerns the harness boundary and does not turn reversible
local product choices into blocking questions.

## Optional multimodal capabilities

[Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) is an optional,
task-scoped capability extension. The agent checks native/callable support
first, installs only the smallest missing capability when authorized, and
verifies it before use. No API key is used by default for native image, video,
or document reading.

| Capability | Configuration |
| --- | --- |
| Vision, OCR, grounding, transcription, generation, and video memory | `DASHSCOPE_API_KEY` |
| Web and image search | `SERPER_API_KEY` |
| Segmentation through a SAM3 service | `SAM3_SERVER_URL` |
| Blender, FreeCAD, Office, browser-backed visualization, and `edu-agent` | System dependencies and upstream configuration; `edu-agent` TTS also needs `DASHSCOPE_API_KEY` |

Credentials belong in the process environment or the official Qwen
configuration file, never in Git, `.forgeloop/kit/PROJECT_PROFILE.md`, or
copied instruction files. ForgeLoop does not vendor Qwen code or install it
through `init`, `update`, or `doctor`.

## Release and maintenance

The release workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
through GitHub Actions OIDC. A `vX.Y.Z` tag must match `package.json`; after
publishing, verify the immutable release identity:

```bash
RELEASE_COMMIT="$(git rev-list -n1 vX.Y.Z)"
npm run release:identity -- --version X.Y.Z --release-commit "$RELEASE_COMMIT"
```

Only `RELEASE_IDENTITY_VALID` is sufficient. Publication, pull requests,
merges, releases, and deployments are external actions and are never inferred
from local test success.

When updating a target, preserve `.forgeloop/kit/PROJECT_PROFILE.md`, compare
adapters before replacement, and run the repository checks. Python validators
remain frozen CI-only compatibility tools; their scope and invocation are
documented in [`scripts/CI_VALIDATORS.md`](./scripts/CI_VALIDATORS.md).

```bash
npm ci
npm test
npm run lint
npm run coverage
npm run pack:check
npm run dependency:policy
npm run docs:flow
npm run docs:check
```

## Repository structure

```text
src/                    npm CLI and protocol implementation
schemas/                versioned artifact schemas
ENG/                    package-source engineering guides
docs/forgeloop-flow.mmd canonical Mermaid source
docs/assets/            committed diagram render
scripts/                checks, renderer, release identity, CI notes
tests/                  Node and Python regression coverage
.forgeloop/             project-scoped ForgeLoop configuration
.forgeloop/task-state/  isolated live task protocol state
DOCS_INDEX.md           documentation map and ownership boundaries
```

Project-scoped configuration remains under `.forgeloop/`.
Task-scoped mutable protocol state is stored under
`.forgeloop/task-state/<taskKey>/`.

For document ownership, guide routing, capability degradation, and integration
details, start at [`DOCS_INDEX.md`](./DOCS_INDEX.md).
