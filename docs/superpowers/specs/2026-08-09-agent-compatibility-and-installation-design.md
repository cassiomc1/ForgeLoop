# Agent Compatibility and Target Installation Design

**Date:** 2026-08-09

**Status:** Approved for implementation

## Objective

Make the public `@cassiomc1/mdfiles` framework explicit and verifiable for the
agents users named, while documenting how to install it into any existing
project directory selected with `--path`.

The result must distinguish native instruction adapters from compatibility
through the shared `AGENTS.md` contract, and must not require live agent
sessions, credentials, or provider subscriptions to validate the package.

## Scope

The supported-agent matrix contains ten entries:

1. Codex
2. Claude Code
3. Cursor
4. GitHub Copilot
5. Antigravity
6. OpenCode
7. Hermes
8. Pi
9. Command Code
10. Freebuff

Codex, Claude Code, Cursor, and GitHub Copilot have dedicated entry files in
the kit. Antigravity, OpenCode, Hermes, Pi, Command Code, and Freebuff consume
the root `AGENTS.md` already installed by the kit. No duplicate native adapter
is added when the official agent already supports `AGENTS.md`.

The installation contract remains:

```bash
npx @cassiomc1/mdfiles init
npx @cassiomc1/mdfiles init --path ./my-project
npx @cassiomc1/mdfiles init --path /absolute/path/to/project
npx @cassiomc1/mdfiles doctor --path /absolute/path/to/project
npx @cassiomc1/mdfiles update --path /absolute/path/to/project
```

The target directory must already exist and be a directory. `init` creates
managed files only when they are absent, preserves existing local instructions,
and records managed hashes in `.mdfiles/manifest.json`. `PROJECT_PROFILE.md`
remains preserved by `update`.

## Non-goals

- Installing any agent or provider.
- Running live LLM sessions or using credentials.
- Creating `.hermes.md`, `.agents/rules/`, `knowledge.md`, or other duplicate
  native files when `AGENTS.md` is an official supported input.
- Changing the existing conflict-preservation behavior.
- Publishing or pushing the implementation.

## Compatibility source of truth

Create `src/core/agent-support.js` with a frozen array of records. Each record
contains:

- `id`: stable lowercase identifier;
- `name`: display name;
- `support`: `direct` or `agents-md`;
- `instructionFiles`: repository-relative files that make the kit usable;
- `officialDocs`: authoritative documentation URL;
- `notes`: concise loading or precedence caveat.

The registry is the source for automated contract tests. The human-readable
`AGENT_COMPATIBILITY.md` file is generated/maintained from the same values and
is included in the npm package and in target projects through
`TEMPLATE_PATHS`.

The matrix must record these official mechanisms:

| Agent | Support | Files | Official evidence |
| --- | --- | --- | --- |
| Codex | direct | `AGENTS.md` | OpenAI Codex `AGENTS.md` guide |
| Claude Code | direct | `CLAUDE.md` | Anthropic Claude Code memory guide |
| Cursor | direct | `AGENTS.md`, `.cursor/rules/project-loop.mdc` | Cursor rules guide |
| GitHub Copilot | direct | `.github/copilot-instructions.md` | GitHub Copilot instructions |
| Antigravity | `agents-md` | `AGENTS.md` | Antigravity CLI best practices |
| OpenCode | `agents-md` | `AGENTS.md` | OpenCode rules guide |
| Hermes | `agents-md` | `AGENTS.md` | Hermes context-files guide |
| Pi | `agents-md` | `AGENTS.md` | Pi coding-agent context-files documentation |
| Command Code | `agents-md` | `AGENTS.md` | Command Code memory guide |
| Freebuff | `agents-md` | `AGENTS.md` | Freebuff/Codebuff knowledge-file source |

The document must explain that Claude Code reads `CLAUDE.md`, while Codex and
the six `agents-md` agents read `AGENTS.md`. It must also identify any higher-
priority file that can change behavior, such as `.hermes.md`, an existing
`knowledge.md`, or a pre-existing local adapter.

## Installation documentation

Expand `README.md` with a complete, copy-pasteable workflow:

1. Verify Node.js 20 or newer.
2. Create or enter the target project directory.
3. Run `npx ... init` for the current directory or `npx ... init --path` for a
   chosen directory.
4. Use `--dry-run` to preview writes.
5. Run `doctor` against the same path.
6. Read `LOOP_ENGINEERING.md`, `PROJECT_PROFILE.md`, and `GUIDE_ROUTER.md` on
   the first task.
7. Start the preferred agent in that project directory.
8. Use `update` on future package revisions and resolve reported conflicts manually.

The README must link to `AGENT_COMPATIBILITY.md`, show relative and absolute
paths, state that the target must exist, and explain which installed file each
agent reads.

Update `LOOP_SYSTEM_DESIGN.md` so its support claims and architecture describe
all ten agents and the direct-versus-`AGENTS.md` distinction.

## Tests

Extend the existing Node test suite with contract tests that:

- assert all ten registry IDs are unique and present;
- assert every registry `instructionFiles` entry exists in
  `TEMPLATE_PATHS`;
- assert every official documentation URL is an HTTPS URL;
- assert `AGENT_COMPATIBILITY.md` names every registry entry and its support
  mode;
- assert `init --path <temporary-directory>` writes the compatibility guide and
  all required adapters only inside the selected directory;
- assert `npm pack --dry-run` contains the registry, compatibility guide,
  adapters, and license files;
- retain existing tests for dry-run, preservation, conflicts, doctor, and
  profile protection.

No test invokes an external agent. A live provider smoke test is explicitly
outside this package's deterministic test contract.

## Acceptance criteria

- A user can install the framework into the current directory or any existing
  relative/absolute project path using documented `npx` commands.
- The installed target contains the compatibility guide and the files needed
  by all ten supported agents.
- The matrix and registry agree; tests fail if an agent or adapter drifts.
- Codex and Claude Code support are explicitly verified against their official
  instruction-file contracts.
- Existing local instructions and `PROJECT_PROFILE.md` remain protected.
- `npm test` and `npm run pack:check` pass, and the final diff is limited to
  this feature's registry, documentation, templates, and tests.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Official file precedence changes | Keep precedence caveats in the matrix and recheck official URLs during maintenance. |
| Registry and Markdown drift | Contract tests assert every registry entry appears in the guide and every file is packaged. |
| Duplicate instructions in target projects | Preserve existing files and document manual merge behavior; do not add extra native files. |
| Misleading end-to-end claim | Label this as official-contract/package verification and state that live agents were not run. |
| Accidental writes to the wrong project | Require an existing explicit target, support `--dry-run`, and test isolated temporary targets. |
