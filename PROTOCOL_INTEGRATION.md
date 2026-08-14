# Protocol Integration

ForgeLoop is a portable, project-scoped engineering protocol. It is vendor-neutral
and is not tied to a specific model, provider, agent product, IDE, or orchestration runtime.

The protocol becomes applicable because a project activates ForgeLoop, not because
an execution environment appears in a compatibility list.

<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->

## Universal applicability

If the active execution environment discovers a ForgeLoop project adapter,
the canonical ForgeLoop protocol applies to work performed in that project.

```text
PROJECT HAS FORGELOOP ADAPTER
+
RUNTIME DISCOVERS IT
+
REQUIRED LOCAL CAPABILITIES ARE AVAILABLE
=
FORGELOOP APPLIES
```

An execution environment that has not been previously tested is
`CONFORMANCE_UNVERIFIED`, not unsupported and not exempt from the protocol.

Capabilities determine how much of ForgeLoop can be executed. Brand names do not.

### Interpretation rules

```text
INVALID:
"I am not a named ForgeLoop integration, therefore ForgeLoop does not apply."
"I will follow ForgeLoop only in spirit because my harness is not documented."

VALID:
"I discovered the ForgeLoop project adapter. ForgeLoop applies.
My current runtime may have unverified or limited capabilities, which I will evaluate."
```

## Integration levels

Execution environments integrate with ForgeLoop by capability:

### Level 1 — `INSTRUCTION_DISCOVERED`

The environment has automatically or explicitly loaded a project-local ForgeLoop
adapter (such as `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`,
`.github/copilot-instructions.md`, or manual bootstrap).

### Level 2 — `PROTOCOL_CAPABLE`

The environment possesses the necessary local capabilities:

- Read project files.
- Write project-local files.
- Execute local commands.
- Invoke the project-local ForgeLoop CLI.
- Preserve project state across lifecycle transitions.

When these are available, the environment executes the complete ForgeLoop lifecycle.

### Level 3 — `PROTOCOL_LIMITED`

The environment discovered ForgeLoop but lacks one or more required local
capabilities (for example, no command execution or no write access).

ForgeLoop **still applies**, but the runtime must:

- Fail closed for the affected lifecycle dimension.
- Report the missing capability explicitly.
- Never simulate missing capabilities.
- Never manually fabricate protocol-owned state.
- Never claim validator-backed completion.

### Level 4 — `CONFORMANCE_VERIFIED`

A specific runtime, model, version, environment, and configuration has completed a
recorded blind conformance scenario under standard protocol verification.

Conformance verification is **evidence of tested interoperability**; it is
never an eligibility gate or allowlist for protocol adoption.

## Discovery surfaces

ForgeLoop provides project-local shims for common instruction-discovery mechanisms:

- `AGENTS.md`: Standard discovery surface recognized by multiple AI coding tools and developers.
- `CLAUDE.md`: Discovery surface for Claude Code.
- `.cursor/rules/project-loop.mdc`: MDC rule format for Cursor.
- `.github/copilot-instructions.md`: Repository instructions for GitHub Copilot.

These files are discovery aliases. They all point to the same canonical project
protocol in `.forgeloop/kit/LOOP_ENGINEERING.md` and `.forgeloop/kit/PROTOCOL_INTEGRATION.md`.
They do not define separate ForgeLoop implementations.

### Generic and manual bootstrap

For environments, internal enterprise agents, custom harnesses, or developer-operated
workflows that do not automatically discover one of the default files:

1. Read `.forgeloop/kit/LOOP_ENGINEERING.md`.
2. Read `.forgeloop/kit/PROTOCOL_INTEGRATION.md`.
3. Resolve the project-local ForgeLoop CLI.
4. Execute the contract, route, preflight, and lifecycle workflow.

A developer or custom automation can execute ForgeLoop identically to an AI agent.

## CLI resolution policy

Lifecycle-owned protocol state must be managed through the project-local ForgeLoop CLI:

1. Project-local `node_modules/.bin/forgeloop`
2. Package manager local execution (e.g. `npx --no-install forgeloop` or equivalent)
3. Direct package CLI entry point (`node src/cli.js`)
4. Verified global `forgeloop` matching the installed package version

Do not automatically download a different version during a reproducible run.
The resolved CLI must match the installed project's package identity.

## Protocol-owned state and no-simulation policy

The following protocol artifacts are strictly owned by ForgeLoop:

- `.forgeloop/preflight.json`
- `.forgeloop/work-state.json`
- `.forgeloop/events.ndjson`
- `.forgeloop/execution-receipt.json`
- Canonical check, evidence, and terminal-result state

If the required CLI or API capability cannot be resolved:

- **Do not** fabricate lifecycle state manually.
- **Do not** synthesize event history.
- **Do not** manually assign `COMPLETE`.
- **Do not** construct a fake execution receipt.
- **Do not** rewrite `events.ndjson` to simulate chronology.

Report the corresponding ForgeLoop dimension as `NOT_VERIFIED` / `E_FORGELOOP_CLI_UNAVAILABLE`.

## Missing tool capability

A missing tool is a capability gap, not installation authority.

If an expected verifier, browser tool, linter, analyzer, or test dependency is
not already available:

- use a suitable existing local equivalent when possible;
- otherwise request authority if installation is necessary and allowed;
- otherwise report the affected verification dimension as not verified with
  `E_VERIFICATION_TOOL_UNAVAILABLE`.

Never convert `PROTOCOL_LIMITED` into environmental mutation by implicitly
installing a package.

## Optional capability extensions

The installed loop directs the active actor to inspect native model and harness
capabilities. When a task requires a missing capability (e.g. multimodal vision),
the actor may install the smallest task-scoped capability (such as `Qwen-MM-Plugins`)
through native mechanisms or upstream installers, then verify it before use.

API credentials, system packages, and unrelated environment changes remain
separately gated.

## Delegation scope

Delegation is optional.

A run that contains no delegation events, no delegated task references, and no
delegation artifacts is a valid single-actor run.

Missing delegation artifacts must not make such a run incomplete. For a purely
local single-actor lifecycle, the delegation dimension is `NOT_APPLICABLE`.

Once delegation is observed in canonical state, receipt, or event history, the
required delegation artifacts become mandatory.

## Instruction precedence

When multiple instruction layers exist, follow standard precedence:

1. Platform, sandbox, and system security rules.
2. Direct user instructions in the latest prompt.
3. Target project-specific rules and instructions.
4. ForgeLoop project protocol (`LOOP_ENGINEERING.md`, `PROTOCOL_INTEGRATION.md`).
5. Activated domain guides (`GUIDE_ROUTER.md` → `ENG/*.md`).
6. Technical defaults and safe assumptions.

The absence of an environment's name from documentation is never a precedence conflict.

## External workflow interaction

External planning, interview, or review workflows (such as `/grill-me`, `/plan`, or IDE
review gates) may assist in clarifying requirements, but they must not silently
redefine ForgeLoop `NON_BLOCKING` decisions as `BLOCKING` in autonomous mode.
Consult `LOOP_ENGINEERING.md#external-workflow-interaction` for the complete boundary.
