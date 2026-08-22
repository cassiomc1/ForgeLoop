# ForgeLoop MCP

The `@cassiomc1/forgeloop-mcp` package is a local **stdio** Model Context
Protocol server over the canonical ForgeLoop integration API
(`@cassiomc1/forgeloop/integration`). It is an **adapter, never a second
implementation**: every tool call executes a canonical ForgeLoop command and
every ownership value comes from the canonical claim resolver.

## Core principles

- **No duplicated protocol logic.** The server contains no lifecycle,
  ownership, recovery, lock, or transaction code.
- **No direct protocol-state access.** The adapter never reads or writes
  `.forgeloop` files; all mutation flows through ForgeLoop's own guards
  (locks, transactions, revision checks, ledger append serialization).
- **`COMPLETE` is not enough.** Claim release is presented exactly as the
  canonical resolver reports it; forged COMPLETE stays INCONSISTENT with
  historical claims retained.
- **Recovery acknowledgement is not authorization.** `acknowledgeRecovery`
  in tool input only satisfies ForgeLoop's caller acknowledgement after the
  server was started with recovery capability.

## Modes

| Mode | Read | Loop mutations | task-resume | External | Maintenance | Recovery | Legacy repair | Force |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `readonly` | yes | no | no | no | no | no | no | no |
| `safe` (default) | yes | yes | yes | no | no | no | no | no |
| `full` | yes | yes | yes | opt-in | opt-in | opt-in | opt-in | opt-in |

Capability flags (process-scoped, immutable after launch):
`--allow-external-execution`, `--allow-maintenance`, `--allow-recovery`,
`--allow-legacy-repair`, `--allow-force-recovery`.

## Resources

- `forgeloop://protocol/info`
- `forgeloop://project/tasks`
- `forgeloop://task/{taskId}/status`
- `forgeloop://task/{taskId}/ownership` — canonical validated ownership
- `forgeloop://task/{taskId}/contract`
- `forgeloop://task/{taskId}/continuity`

Raw recovery artifacts, transaction journals, lock files, and unbounded event
ledgers are intentionally not exposed.

## Optional stateless HTTP transport

`forgeloop-mcp-http` serves the same deterministic catalog over the modern
stateless MCP HTTP model:

```bash
forgeloop-mcp-http --project /repo --mode safe                 # 127.0.0.1:3333
forgeloop-mcp-http --project /repo --host 0.0.0.0 --allow-remote
```

- Loopback binding is the default; any non-loopback bind requires explicit
  `--allow-remote`.
- DNS-rebinding protection validates `Host` and `Origin` on every request.
- Stateless: no session identity is issued, so transport metadata is never
  ForgeLoop authority.
- Request bodies are bounded (4 MiB) and only `POST` is served.
