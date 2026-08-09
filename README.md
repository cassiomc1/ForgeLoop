# Instruction Guides for AI Agents

[![Docs quality](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml/badge.svg?branch=main)](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml)

An English-only collection of operational guides for AI agents and developers.
It covers product strategy, code, testing, security, performance,
accessibility, design, and web games across web, mobile, and desktop projects.

The files are Markdown and can be used as references or as a foundation for
`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, and
`.github/copilot-instructions.md`. Adopt only the guides relevant to the target
project; this collection is not a dependency bundle.

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

Each guide declares its name, `language: en`, description, version, and last
review date in frontmatter. The eight guides use version `2026.08` and review
date `2026-08-08`.

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

Thin adapters support Codex-compatible agents, Claude Code, Cursor, and GitHub
Copilot while delegating to the same canonical documents.

### Install in a target project

Download this private repository as a ZIP or clone it into a temporary
directory. Copy this structure to the target project's root while preserving
relative paths:

```text
AGENTS.md
CLAUDE.md
LOOP_ENGINEERING.md
GUIDE_ROUTER.md
PROJECT_PROFILE.md
LOOP_SYSTEM_DESIGN.md
THIRD_PARTY_NOTICES.md
.github/copilot-instructions.md
.cursor/rules/project-loop.mdc
ENG/
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

Architecture and boundaries are documented in
[`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md).

## Tool approval policy

Identify the stack, current stage, and applicable checks. Prefer an equivalent
tool already available when it produces compatible evidence. Ask for approval
before installing software or changing the environment. If a required check
cannot run and no safe alternative exists, record the blocker and do not claim
that the check passed. Optional references must never be installed
automatically.

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
├── AGENTS.md                       # Codex-compatible agent entry point
├── CLAUDE.md                       # Claude Code entry point
├── LOOP_ENGINEERING.md             # canonical operating cycle
├── GUIDE_ROUTER.md                 # contextual guide selection
├── PROJECT_PROFILE.md              # verified project facts
├── LOOP_SYSTEM_DESIGN.md           # architecture and boundaries
├── THIRD_PARTY_NOTICES.md          # provenance and rights
├── ENG/                            # eight English guides
├── .cursor/rules/                  # always-active Cursor rule
├── .github/copilot-instructions.md # GitHub Copilot entry point
├── .github/workflows/              # quality automation
├── scripts/                        # structural, language, and secret checks
├── tests/                          # validator regression tests
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

Run the repository validators with Python's standard library:

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 -m unittest discover -s tests -v
python3 scripts/scan_secrets.py
```

The [Docs quality workflow](./.github/workflows/docs-quality.yml) also checks
Markdown, links, frontmatter, unique names, code fences, relative links,
adapters, the guide catalog, routing scenarios, and secret-shaped values on
pushes and pull requests.

## Rights and provenance

This collection does not declare a global license. Reuse depends on permission
from the applicable rights holder and on the conditions recorded in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
