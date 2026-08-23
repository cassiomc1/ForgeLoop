# ForgeLoop MCP

Local **stdio** Model Context Protocol server exposing the canonical ForgeLoop
programmatic integration API (`@cassiomc1/forgeloop/integration`).

ForgeLoop MCP is an **adapter over ForgeLoop, never another implementation of
ForgeLoop**: every tool call executes a canonical ForgeLoop command through the
transport-neutral runtime, and every ownership value comes from the canonical
claim resolver. The server never reads or writes `.forgeloop` state directly.

## Usage

```bash
forgeloop-mcp --project /repo --mode safe
```

### Modes

| Mode | Read tools | Loop mutations | task-resume | External execution | Maintenance | Recovery | Legacy repair | Force |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `readonly` | yes | no | no | no | no | no | no | no |
| `safe` (default) | yes | yes | yes | no | no | no | no | no |
| `full` | yes | yes | yes | opt-in | opt-in | opt-in | opt-in | opt-in |

Higher-risk capabilities require both the launch flag and (for recovery) the
canonical command-level acknowledgement:

```text
--allow-external-execution   run-check, reconcile-closure (exact argv only)
--allow-maintenance          init/update/migrations/clear-state/doctor/baseline/task-unlock
--allow-recovery             task-recover (plus --acknowledge-recovery in tool input)
--allow-legacy-repair        task-repair-legacy-recovery (hidden by default)
--allow-force-recovery       task-unlock --force
```

Tool input can never upgrade launch policy. `acknowledgeRecovery: true` in tool
input is not an authorization grant. There is no generic shell tool.

## Security model

- Project root is pinned at startup (realpath + frozen); never a tool input.
- Task-aware mutation tools require an explicit `taskId`.
- Tool/resource catalogs are deterministic; project state never changes them.
- stdout carries only the MCP protocol; diagnostics go to stderr.
- Public ForgeLoop error codes are preserved verbatim.

## Transports

- **stdio** (default, recommended): `forgeloop-mcp --project /repo --mode safe`.
- **HTTP** (optional): `forgeloop-mcp-http` serves the strict modern stateless
  MCP 2026 model. Loopback-only — non-loopback binds fail closed with
  `E_MCP_REMOTE_NOT_SUPPORTED` until an authenticated remote design exists.
