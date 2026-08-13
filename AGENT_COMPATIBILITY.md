# Agent Compatibility

`@cassiomc1/forgeloop` installs one canonical engineering loop and the smallest
native entry point required by each supported agent. The package does not
install an agent, configure a provider, or run a live model session.

Compatibility has three distinct levels:

- `ADAPTER_COMPATIBLE`: the harness recognizes the installed instruction entry
  file.
- `PROTOCOL_CAPABLE`: the harness can create the local contract, route, gates,
  state, evidence, and receipt artifacts and run the validators.
- `CONFORMANCE_VERIFIED`: a live run passed one of the scenarios under
  `conformance/` for that harness/model combination.

Reading `AGENTS.md` proves only instruction compatibility. It does not prove
that an active session followed preflight, legal phase chronology, or completion
validation.

## Optional capability extensions

The installed loop can direct the active agent to inspect its native model and
harness capabilities. When a task requires a missing multimodal capability,
the agent may install the smallest task-scoped `Qwen-MM-Plugins` capability
through the harness's native mechanism or the official upstream installer,
then verify that the skill/MCP tool is callable before using it. This does not
turn the package into a model runtime or provider configuration tool: API keys,
system dependencies, and unrelated environment changes remain separately
gated. Live model sessions and external plugin installation are outside the
reproducible `npm test` boundary.

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

## Harness capability and bootstrap boundary

An adapter proves that the package installed a supported instruction or context
entry point. It is not proof of a callable optional tool, isolation feature,
review primitive, or bootstrap hook in the active harness, even when the
canonical loop can use one when available.

When a harness supports native context bootstrap or startup verification, prefer
an explicit unique marker to confirm that the expected instruction path is
active. When that proof is unavailable, treat the adapter file and repository
checks as installation evidence only.

Optional capability gaps use the loop fallback rules instead of invented
commands or assumed integrations. Agents should never invent a tool call to
simulate missing harness support. Global configuration, provider credentials,
system packages, and other machine-level setup remain outside the installed
package boundary.

## Precedence and existing instructions

`forgeloop init` never overwrites an existing instruction file. If the target
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

## External workflow compatibility

An external planning, brainstorming, design-review, testing, or documentation
workflow can be installed and still be `INCOMPATIBLE WITH AUTONOMOUS MODE`.
Installation is a capability fact; compatibility is a precedence and behavior
fact. The ForgeLoop `NON_BLOCKING` classification remains authoritative in
autonomous mode. A mandatory approval policy for a reversible local choice is
recorded as `WORKFLOW_CONFLICT`, with no user question and no fake entry in
`current-contract.unresolvedDecisions[]`.

The supported autonomous boundary is:

| Workflow policy | Result |
| --- | --- |
| Local planning, review, tests, or docs | Compatible. |
| Approval only for a real ForgeLoop `BLOCKING` decision | Compatible; the justified question may proceed. |
| Approval for every design choice or before implementation | `INCOMPATIBLE WITH AUTONOMOUS MODE`. |
| Reclassifying reversible aesthetics as blocking | `INCOMPATIBLE WITH AUTONOMOUS MODE`. |

Interactive operation is explicit (`autonomousMode=false`) and must not be
selected silently. Live conformance records the available and invoked external
workflows, mandatory-approval setting, brainstorming/design hard gates,
autonomy mode, process count, subagent count, and delegation status. For the
sixth blind run, the harness must report:

```text
mandatory-approval workflows enabled: NO
external brainstorming hard gate enabled: NO
external design approval gate enabled: NO
subagents enabled: NO
delegation enabled: NO
```

Question attribution remains `USER_REQUIREMENT`,
`FORGELOOP_BLOCKING_DECISION`, `EXTERNAL_WORKFLOW_POLICY`, or
`MODEL_PREFERENCE`. In autonomous mode, only the first two can authorize a
question, and `ASK_USER` additionally requires a valid ForgeLoop blocking
reason. External policy alone cannot manufacture a blocker.

If a mandatory approval workflow cannot be disabled, the run is
`TEST_NOT_STARTED`; do not call it a failed or successful conformance result.

## Deterministic verification boundary

The repository verifies package contents, adapter paths, installation into a
selected target directory, and the official instruction-file contracts. It
does not launch Codex, Claude Code, or another provider during `npm test`; live
sessions require external authentication and are intentionally outside the
reproducible package test suite.

## Protocol-support commands and degraded mode

The CLI can deterministically evaluate declared routing signals, inspect target
health, validate local receipts and work state, and report resumable status. It
does not call an LLM, schedule agents, execute commands from
`PROJECT_PROFILE.md`, or provide `forgeloop run`/orchestration commands.

If a harness has no subagents, worktrees, web access, MCP, persistent state, or
Git checkout, the compatible agent continues inline and reports the missing
capability as a limitation. Inline execution is not independent review, a
non-Git target cannot provide branch/HEAD drift evidence, and a missing remote
service is a blocker rather than a simulated success.

The degraded-mode contract is explicit:

| Missing capability | Required behavior |
| --- | --- |
| Subagents | Execute the same brief inline; do not claim delegation or independent review. |
| Worktrees or isolation | Keep ownership boundaries in the brief and serialize conflicting work. |
| Web or MCP | Use a local equivalent only when it provides compatible evidence; otherwise mark the check not verified or blocked. |
| Persistent state | Keep the handoff in the current session and report that resume across sessions is unavailable. |
| Git checkout | Continue with local file evidence, but report that branch/HEAD drift cannot be verified. |

These are limitations of the active harness, not reasons to invent a command,
provider, remote service, or successful check.

## Installed files

Every initialized project receives small native adapters at the project root
and the canonical documents in the package-managed hidden kit. This keeps the
root readable while preserving the standard instruction entry points:

```text
AGENTS.md
CLAUDE.md
.cursor/rules/project-loop.mdc
.github/copilot-instructions.md
.forgeloop/manifest.json
.forgeloop/current-contract.json
.forgeloop/routing-result.json
.forgeloop/work-state.json
.forgeloop/kit/AGENT_COMPATIBILITY.md
.forgeloop/kit/LOOP_ENGINEERING.md
.forgeloop/kit/GUIDE_ROUTER.md
.forgeloop/kit/PROJECT_PROFILE.md
.forgeloop/kit/LOOP_SYSTEM_DESIGN.md
.forgeloop/kit/QUALITY_SCORECARD.md
.forgeloop/kit/TERMINOLOGY.md
.forgeloop/kit/EXECUTION_STATE.md
.forgeloop/kit/DELEGATION_PROTOCOL.md
.forgeloop/kit/ORCHESTRATOR_INTEGRATION.md
.forgeloop/kit/THIRD_PARTY_NOTICES.md
.forgeloop/kit/LICENSE
.forgeloop/kit/LICENSE-DOCS.md
.forgeloop/kit/ENG/
.forgeloop/kit/schemas/
```

The package source retains the canonical root files so npm can ship and
validate them; initialized targets use the hidden destination above. Existing
legacy root files are not deleted when they are modified or unowned. Run
`forgeloop update` to migrate unchanged managed files and review any reported
conflict.

See the main [README](https://github.com/cassiomc1/forgeloop#readme) for the complete `npx` installation,
diagnostic, first-run, and update workflow.
