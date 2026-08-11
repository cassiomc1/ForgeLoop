# Instruction Guides for AI Agents

[![Docs quality](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml/badge.svg?branch=main)](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml)

An English-only collection of operational guides for AI agents and developers.
It covers product strategy, code, testing, security, performance,
accessibility, design, and web games across web, mobile, and desktop projects.

The files are Markdown and can be used as references, as a foundation for
`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, and
`.github/copilot-instructions.md`. The supported-agent contract is documented
in [`AGENT_COMPATIBILITY.md`](./AGENT_COMPATIBILITY.md). Adopt only the guides
relevant to the target project.

## Catalog

| Topic | When to use it | Guide |
| --- | --- | --- |
| Premium websites | End-to-end process from strategy to launch | [`premium-sites-studio-eng.md`](./ENG/premium-sites-studio-eng.md) |
| Clean code | Readable, observable, secure, and operable code | [`clean-code-eng.md`](./ENG/clean-code-eng.md) |
| Testing | Risk-based testing strategy | [`test-code-eng.md`](./ENG/test-code-eng.md) |
| Security | Web, mobile, desktop, APIs, and supply chain | [`sec-code-eng.md`](./ENG/sec-code-eng.md) |
| Design | Visual direction, UX, motion, and perceived performance | [`design-code-eng.md`](./ENG/design-code-eng.md) |
| Performance | Measurement, diagnosis, budgets, and optimization | [`perf-code-eng.md`](./ENG/perf-code-eng.md) |
| Accessibility | WCAG 2.2-oriented protocol for interfaces | [`accessibility-eng.md`](./ENG/accessibility-eng.md) |
| Web games | Architecture, design, and operation of 2D, 3D, and procedural games | [`games-code-design-web-eng.md`](./ENG/games-code-design-web-eng.md) |

Each guide declares its name, `language: en`, description, version, and review
date in frontmatter. The repository validator checks that the guide metadata
and catalog remain synchronized.

## Universal project loop

The kit turns each request into a verifiable cycle: discover the project,
define an execution contract, select applicable guides, execute, verify,
diagnose, and correct until success or a genuine external blocker.
[`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) is the operational source;
[`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) prevents irrelevant context from being
loaded; and [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) preserves only durable,
proven project facts.

```text
Request → discovery → profile → routing → plan → execution
        → verification → correction when needed → final evidence
```

Thin native adapters support Codex, Claude Code, Cursor, and GitHub Copilot.
Antigravity, OpenCode, Hermes, Pi, Command Code, and Freebuff use the shared
`AGENTS.md` entry point. All ten agents delegate to the same canonical
documents; see [`AGENT_COMPATIBILITY.md`](./AGENT_COMPATIBILITY.md) for the
official sources and precedence notes.

### Use with npm

The npm CLI targets Node.js 20 or newer and installs the kit into an existing
project without overwriting local instructions. When the package is available
in the npm registry, use the commands below; otherwise use the repository
checkout fallback.

```bash
npx @cassiomc1/mdfiles init
npx @cassiomc1/mdfiles doctor
npx @cassiomc1/mdfiles update
```

Protocol-support commands are local and do not invoke an agent or model:

```bash
npx @cassiomc1/mdfiles route --work complete-website --surface ui --risk untrusted-input
npx @cassiomc1/mdfiles inspect --json
npx @cassiomc1/mdfiles status --json
npx @cassiomc1/mdfiles status --contract-file .mdfiles/current-contract.json --json
npx @cassiomc1/mdfiles validate-state --json
npx @cassiomc1/mdfiles validate-receipt --file ./execution-receipt.json --json
npx @cassiomc1/mdfiles validate-protocol --route-file ./routing-result.json --state-file .mdfiles/work-state.json --receipt-file ./execution-receipt.json --contract-file .mdfiles/current-contract.json --json
```

`route` expands declared signals into deterministic guide IDs and reason codes.
`inspect`, `status`, and `validate-state` explain installation and resumable
state; they do not execute commands from the target profile.
`inspect` and `status` parse the target-local schemas and report `valid`,
`missing`, `invalid`, or `unsupported-version` health. A status without a
current contract file reports contract comparison as `NOT_VERIFIED` and does
not claim full freshness. `validate-protocol` is read-only and checks
cross-artifact relationships plus the same derived freshness classification
used by `inspect` and `status`. Supply `--contract-file` to compare the saved
contract fingerprint with the current contract; omitting it leaves contract
freshness as `NOT_VERIFIED` and a complete artifact set requires revalidation.
It returns `VALID`, `INCOMPLETE`, `STALE`, `INCONSISTENT`, or `INVALID` with
exact invariant codes and derived stale reasons. The persisted
`.mdfiles/work-state.json` schema is unchanged: `status`, `stale`, and `fresh`
are never stored in that file. Status precedence is `INVALID` > `INCONSISTENT`
> `STALE` > `INCOMPLETE` > `VALID`.
All protocol-support commands are local and offline-capable by default; the
package sends no telemetry and has no central trace service.
Capability gaps and inline/non-Git degraded mode are defined in
[`AGENT_COMPATIBILITY.md`](./AGENT_COMPATIBILITY.md); they are reported as
limitations rather than treated as silent successes.

### Protocol compatibility

The npm package version is independent of protocol version. The current
serializable artifact contract is `schemaVersion: 1` and `protocolVersion: 1`.

- Patch releases preserve the v1 schemas, enums, transitions, and existing
  command contracts while correcting implementation defects.
- Minor releases preserve existing v1 artifacts and commands; they may add
  documentation, new commands, new guide IDs, or a new explicitly named
  schema. Existing consumers must still reject unknown fields rather than
  silently treating an unrecognized artifact as valid.
- Major releases may change required fields, enums, transitions, or safety
  semantics and must document migration requirements together with a protocol
  version change.

The compatibility fixture in
[`tests/fixtures/compatibility/protocol-v1.json`](./tests/fixtures/compatibility/protocol-v1.json)
is a small conformance marker, not a runtime configuration file.

### CLI security and trust boundaries

The CLI is a local validator and installer. It does not execute instructions,
profile commands, receipt data, state data, or hidden prompts supplied by a
target project. Its main threat boundaries are:

| Threat | Mitigation or accepted limit |
| --- | --- |
| Path traversal and symlink escape | Target and managed paths use safe-path and realpath containment checks; a symlinked target or escaped child is rejected. |
| Manifest tampering | Managed-file hashes and manifest shape are checked by `doctor`; discrepancies become findings rather than silent overwrites. |
| Untrusted state or profile data | JSON schemas, semantic checks, secret-like field checks, and non-execution rules apply before state or profile data is used. |
| Command injection | Git inspection uses fixed arguments without a shell; the CLI never treats project text as a command. |
| Data exposure | Receipts and checkpoints reject secret-like keys and values; examples use placeholders, and the repository secret scanner runs in CI. |
| Unsafe update overwrite | `update` preserves locally modified files and `PROJECT_PROFILE.md`; adoption and writes remain bounded to the selected target. |
| Dependency supply chain | Runtime code uses Node built-ins only; the package does not install agents, providers, plugins, or remote services. |
| Stale replay | Work state records contract and repository fingerprints; drift requires revalidation and never reruns destructive or publication actions automatically. |
| Unverified publication | Receipts carry explicit publication booleans; local success never implies a push, pull request, merge, release, or deployment. |

The full boundary inventory, residual limitations, and executable evidence are
in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

The CLI cannot protect a target from a separately privileged or hostile process
that changes the filesystem after validation. Consumers must still review
permissions, package provenance, and external actions before granting authority.

From a repository checkout before npm publication, run the same commands with
Node directly:

```bash
node src/cli.js init
node src/cli.js doctor
node src/cli.js update
```

The release workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
through GitHub Actions OIDC. Before the first release, register this repository
and workflow as the package's trusted publisher in npm; each `vX.Y.Z` tag must
match `package.json`. After publishing, verify the package version and its npm
provenance record.

The commands above use the current directory. To install into another existing
project directory, pass a relative or absolute `--path`:

```bash
# Existing project relative to the current directory
npx @cassiomc1/mdfiles init --path ./my-project
npx @cassiomc1/mdfiles doctor --path ./my-project
npx @cassiomc1/mdfiles update --path ./my-project

# Existing project at an absolute path
npx @cassiomc1/mdfiles init --path /path/to/my-project
npx @cassiomc1/mdfiles doctor --path /path/to/my-project
npx @cassiomc1/mdfiles update --path /path/to/my-project
```

The target must already exist and be a directory; the CLI will not create or
replace an arbitrary path. Use `--dry-run` to preview writes before `init` or
`update`. `--json`, `--strict`, and `--adopt <path>` are supported by `doctor`;
adoption is limited to a supported adapter that has been reviewed locally. The
CLI records managed files and their hashes in `.mdfiles/manifest.json`; `update`
leaves locally modified files and `PROJECT_PROFILE.md` untouched. If a target
already has a manifest, rerun `update` instead of `init`. Symlinked targets or
template parents are rejected, and unadopted pre-existing adapters are reported
for manual merge with the loop reference.

### Install in a target project

If npm is unavailable, download this public repository as a ZIP or clone it
into a temporary directory. Copy this structure to the target project's root
while preserving relative paths:

```text
AGENTS.md
CLAUDE.md
AGENT_COMPATIBILITY.md
LOOP_ENGINEERING.md
GUIDE_ROUTER.md
PROJECT_PROFILE.md
LOOP_SYSTEM_DESIGN.md
QUALITY_SCORECARD.md
TERMINOLOGY.md
EXECUTION_STATE.md
DELEGATION_PROTOCOL.md
ORCHESTRATOR_INTEGRATION.md
THREAT_MODEL.md
CONTRACT_COVERAGE.md
THIRD_PARTY_NOTICES.md
LICENSE
LICENSE-DOCS.md
.mdfiles/.gitignore
.github/copilot-instructions.md
.cursor/rules/project-loop.mdc
ENG/
schemas/
```

If the target already has `AGENTS.md`, `CLAUDE.md`, Copilot instructions, or
Cursor rules, merge only the adapter block that points to the loop. Never
overwrite specific local instructions. The `scripts/`, `.github/workflows/`,
and quality configuration files are optional for kit consumers but required to
maintain and validate this source repository.

### First run

On the first task in a target project with code or manifests, change
`profile-mode` from `template` to `project`, discover the stack, and record only
confirmed facts in `PROJECT_PROFILE.md`. Keep `language: en`.

The profile must not store tokens, passwords, keys, credentials, or task logs.
Unknown commands remain unverified until a real source identifies them.

To confirm activation before the first implementation, ask the agent:

```text
Before implementing, report the confirmed project profile, the guide IDs
selected through GUIDE_ROUTER.md, and the checks you will use. Do not change
files yet.
```

A useful response cites profile evidence, selected guide IDs, and real project
commands. A generic response that does not mention the loop, router, or sources
indicates that the adapter was not loaded.

After installation, start the preferred agent from the target project
directory. Use `AGENT_COMPATIBILITY.md` to confirm which file it should load and
which native entry point is expected. A live agent session is not required for
package installation or its automated tests.

### Update the kit

When adopting a newer version, preserve target-specific facts from
`PROJECT_PROFILE.md`. Compare adapters before replacing them, update the loop,
router, notices, and guides as one coherent set, and never erase local
instructions. If validators were copied, run:

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
```

When maintaining a checkout of this source repository, run the npm package
checks as well:

```bash
npm test
npm run pack:check
```

Architecture and boundaries are documented in
[`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md).

## Tool approval policy

Identify the stack, current stage, and applicable checks. Prefer an equivalent
tool already available when it produces compatible evidence. The task-scoped
Qwen-MM-Plugins installation described below is the narrow capability exception
when a required capability is missing; system tools, credentials, and unrelated
environment changes remain subject to their normal host controls. If a required
check cannot run and no safe alternative exists, record the blocker and do not
claim that the check passed. Unrelated optional references must never be
installed automatically.

## Optional multimodal capabilities

[Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) can extend a
supported agent harness with skills and optional MCP servers. Before using a
multimodal or media operation, the agent checks the model and harness for a
callable native capability. If the task requires a missing keyless capability,
the agent installs only the smallest matching `qwen-mm-plugins-<cap>` capability
and verifies that it is callable before continuing; it does not install every
capability at startup.

No API key is used by default for native image, video, or document reading.
Optional provider-backed operations follow this boundary:

| Capability or operation | Configuration required |
| --- | --- |
| Native image, video, and document reading | No API key; video/audio workflows may need `ffmpeg` and other documented system tools |
| Vision chat, OCR, grounding, audio transcription, Omni audio-video understanding, generation, and video-memory construction | `DASHSCOPE_API_KEY` |
| Web search, web extraction, and image search | `SERPER_API_KEY` |
| Segmentation through a SAM3 service | `SAM3_SERVER_URL` |
| Blender, FreeCAD, Office, browser-backed visualization, and `edu-agent` workflows | The selected application's system dependencies and upstream configuration; `edu-agent` TTS requires `DASHSCOPE_API_KEY` |

Provide optional credentials through the process environment or the official
Qwen configuration file at `~/.qwen-mm-plugins/config` (or its documented
override). Never put keys in Git, `PROJECT_PROFILE.md`, or copied instruction
files. The agent must leave an API-backed capability disabled when its key or
service endpoint is absent, and report missing system dependencies instead of
claiming that the feature is available.

Use the upstream [installation guide](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/docs/en/installation.md)
for the active harness's current install and verification commands, supported
capabilities, system dependencies, and Windows/WSL2 constraints. This project
does not vendor Qwen code, add it to the npm package, or install it through
`mdfiles init`, `update`, or `doctor`.

## HyperFrames for video and motion

[HyperFrames](https://hyperframes.heygen.com) is an option for deterministic
HTML, CSS, and JavaScript-based trailers, demos, presentations, and motion
graphics. It complements the design, accessibility, performance, and testing
guides; it does not replace those checks. Review the
[quickstart](https://hyperframes.heygen.com/quickstart) and
[CLI documentation](https://hyperframes.heygen.com/packages/cli) before
adoption. Local rendering requires Node.js 22+ and FFmpeg.

## Structure

```text
.
├── AGENTS.md                       # shared Codex-compatible entry point
├── CLAUDE.md                       # Claude Code entry point
├── AGENT_COMPATIBILITY.md          # supported agents and official sources
├── LOOP_ENGINEERING.md             # canonical operating cycle
├── GUIDE_ROUTER.md                 # contextual guide selection
├── PROJECT_PROFILE.md              # verified project facts
├── LOOP_SYSTEM_DESIGN.md           # architecture and boundaries
├── THIRD_PARTY_NOTICES.md          # provenance and rights
├── LICENSE                         # CLI and validator code license
├── LICENSE-DOCS.md                 # original documentation license boundary
├── ENG/                            # eight English guides
├── .cursor/rules/                  # always-active Cursor rule
├── .github/copilot-instructions.md # GitHub Copilot entry point
├── .github/workflows/              # quality automation
├── scripts/                        # structural, language, and secret checks
├── tests/                          # validator regression tests
├── src/                            # npm CLI implementation
├── .gitignore                      # ignored local files
├── .lychee.toml                    # link-check configuration
├── .markdownlint-cli2.jsonc        # Markdown rules
└── README.md
```

## Maintenance

- Preserve guide requirements, exceptions, numbers, examples, and references when editing.
- Update `version` and `last-reviewed` when a guide's normative content changes.
- Verify that relative links remain inside the repository.
- Keep root instructions, comments, examples, fixtures, and guide content in English.
- Keep `THIRD_PARTY_NOTICES.md` with every distributed copy of the kit.

### Workflow quality gates

For non-trivial behavior changes, use the proportional design, plan, test, and
review gates in [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md). Keep adapters
and entry-point instructions thin so the canonical workflow stays in one place.

### Local checks

First check whether the Markdown linter is already installed:

```bash
command -v markdownlint-cli2
```

When it is available, run it directly without downloading anything:

```bash
markdownlint-cli2
```

If it is missing, request approval before running this pinned one-off download:

```bash
npx --yes markdownlint-cli2@0.23.2
```

In a checkout of this source repository, run the repository validators with
Python's standard library:

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 -m unittest discover -s tests -v
python3 scripts/scan_secrets.py
```

The [Docs quality workflow](./.github/workflows/docs-quality.yml) also checks
Markdown, links, frontmatter, unique names, code fences, relative links,
adapters, the guide catalog, routing scenarios, and secret-shaped values on
pushes and pull requests.

## Rights and provenance

The CLI and validator code use the MIT text in [`LICENSE`](./LICENSE). Original
documentation uses CC BY 4.0 as described in [`LICENSE-DOCS.md`](./LICENSE-DOCS.md),
and adapted or externally sourced material remains subject to the conditions in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). The npm `license` field
points to the code license; it does not relicense the bundled documentation.
