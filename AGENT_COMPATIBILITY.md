# Agent Compatibility

`@cassiomc1/mdfiles` installs one canonical engineering loop and the smallest
native entry point required by each supported agent. The package does not
install an agent, configure a provider, or run a live model session.

## Support matrix

| Agent | Support | Reads in the installed project | Official documentation |
| --- | --- | --- | --- |
| Codex | Direct adapter | `AGENTS.md` | [OpenAI — Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md) |
| Claude Code | Direct adapter | `CLAUDE.md` | [Anthropic — How Claude remembers your project](https://code.claude.com/docs/en/memory) |
| Cursor | Direct adapter | `AGENTS.md`, `.cursor/rules/project-loop.mdc` | [Cursor — Rules](https://cursor.com/docs/rules) |
| GitHub Copilot | Direct adapter | `.github/copilot-instructions.md` | [GitHub — Repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide) |
| Antigravity | `AGENTS.md` compatibility | `AGENTS.md` | [Antigravity — CLI best practices](https://antigravity.google/docs/cli/best-practices) |
| OpenCode | `AGENTS.md` compatibility | `AGENTS.md` | [OpenCode — Rules](https://opencode.ai/docs/rules/) |
| Hermes | `AGENTS.md` compatibility | `AGENTS.md` | [Hermes — Context files](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md) |
| Pi | `AGENTS.md` compatibility | `AGENTS.md` | [Pi — Coding-agent SDK and context files](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) |
| Command Code | `AGENTS.md` compatibility | `AGENTS.md` | [Command Code — Memory](https://commandcode.ai/docs/core-concepts/memory) |
| Freebuff | `AGENTS.md` compatibility | `AGENTS.md` | [Freebuff — Knowledge file names](https://github.com/CodebuffAI/freebuff/blob/main/common/src/constants/knowledge.ts) |

## What direct and compatibility mean

Direct adapters are files with a format or location specifically documented
by the agent. Compatibility entries use the same root `AGENTS.md`; no second
copy of the loop is needed because the agent officially recognizes that file.

Claude Code is the important exception: it reads `CLAUDE.md`, not `AGENTS.md`.
The package therefore installs both files, with the Claude-specific adapter
pointing to the same canonical loop documents.

Codex, Cursor, and GitHub Copilot may also discover `AGENTS.md` on some
surfaces. The dedicated files remain useful because they make the behavior
explicit and cover each product's native entry point.

## Precedence and existing instructions

`mdfiles init` never overwrites an existing instruction file. If the target
already contains a more specific or higher-priority file, that agent may use
it instead of the installed entry point:

- Codex can use `AGENTS.override.md` before `AGENTS.md`.
- Claude Code combines `CLAUDE.md` and closer `CLAUDE.local.md` files.
- Cursor may combine project rules with user rules and nested rules.
- Antigravity can add workspace rules under `.agents/rules/`.
- Hermes gives `.hermes.md`/`HERMES.md` priority over `AGENTS.md`.
- OpenCode can add instructions through `opencode.json` and uses
  `CLAUDE.md` as a fallback when `AGENTS.md` is absent.
- Freebuff recognizes `knowledge.md`, `AGENTS.md`, and `CLAUDE.md`; an existing
  higher-priority knowledge file can affect which project context is loaded.

When a target already has local rules, keep them and merge only the relevant
loop reference manually. Run `doctor --path /path/to/project` after resolving
the merge so missing files and managed drift are visible.

## Deterministic verification boundary

The repository verifies package contents, adapter paths, installation into a
selected target directory, and the official instruction-file contracts. It
does not launch Codex, Claude Code, or another provider during `npm test`; live
sessions require external authentication and are intentionally outside the
reproducible package test suite.

## Installed files

Every initialized project receives this guide plus the canonical documents:

```text
AGENTS.md
CLAUDE.md
AGENT_COMPATIBILITY.md
LOOP_ENGINEERING.md
GUIDE_ROUTER.md
PROJECT_PROFILE.md
LOOP_SYSTEM_DESIGN.md
THIRD_PARTY_NOTICES.md
.cursor/rules/project-loop.mdc
.github/copilot-instructions.md
ENG/
```

See the main [README](./README.md) for the complete `npx` installation,
diagnostic, first-run, and update workflow.
