# ForgeLoop MCP

The `@cassiomc1/forgeloop-mcp` package is a **local-first MCP adapter** over
the canonical ForgeLoop integration API (`@cassiomc1/forgeloop/integration`).
It is an **adapter, never a second implementation**: every tool call executes
a canonical ForgeLoop command and every ownership value comes from the
canonical claim resolver.

Two transports ship in one package:

- `forgeloop-mcp` — **stdio**, the default/recommended transport;
- `forgeloop-mcp-http` — **optional** strict-modern MCP 2026 HTTP,
  loopback-only (remote access is unsupported).

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
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
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
- `forgeloop://task/{taskId}/actions`
- `forgeloop://task/{taskId}/action/{actionId}`
- `forgeloop://task/{taskId}/approvals`
- `forgeloop://task/{taskId}/metrics`
- `forgeloop://task/{taskId}/context` — bounded profile-aware host context
- `forgeloop://task/{taskId}/evaluations`
- `forgeloop://project/capability-policy`

The durable-action resources are read-only projections. The first release does
not expose `run-action` or host-attestation minting over MCP. An action that is
`COMMIT_UNKNOWN` is surfaced as an external reconciliation requirement; MCP
transport/session metadata cannot authorize a retry or manufacture
`HOST_ATTESTED` authority. Capability policy remains policy, not authority.

### Approval resolution and reconciliation settlement capabilities

Two launch flags expose transport surfaces; neither creates host authority:

- `--allow-approval-resolution` exposes the `approval-resolve` tool.
  Resolving an approval as `HOST_ATTESTED` still requires a trusted
  out-of-band authority context supplied by the embedding host through
  `createForgeLoopMcpServer({ authorityContextProvider })`. Without a
  provider, `HOST_ATTESTED` resolutions fail closed with
  `E_ACTION_AUTHORITY_REQUIRED`. Tool arguments can never carry the context:
  any actor-supplied `authorityContext` property is stripped before dispatch.
- `--allow-reconciliation-settlement` exposes settlement-class
  `action-reconcile` invocations (`--outcome COMMITTED|NOT_COMMITTED`).
  Recording an `UNKNOWN` observation needs no special capability, but settling
  external commit state is independently gated and still requires trusted
  host attestation plus evidence at the core layer.

Capability introspection reports whether these surfaces are enabled
(`hostAttestationAvailable: false` by default) but never exposes grant
content.

Raw recovery artifacts, transaction journals, lock files, and unbounded event
ledgers are intentionally not exposed.

The context resource is read-only. It lets an MCP host adapt presentation depth
from the canonical resolved execution profile while preserving lifecycle
phases, required gates, verification truth, authority, provenance, and
validator-backed completion.

Optional workspace binding, handoff, responsibility, verification-scope,
RevisionProvider, SigningProvider, and attestation operations remain governed
by the same canonical command executors when exposed by a compatible host.
MCP transport metadata cannot establish workspace identity, narrow a checker,
mint signer authority, or turn continuity into evidence. Read-only attestation
and range verification preserve the core `PROCESSED`, `VERIFIED`, and
`ATTESTED` distinctions and never write verification events.

## Optional stateless HTTP transport

`forgeloop-mcp-http` serves the same deterministic catalog over the **strict
modern** stateless MCP 2026 model (legacy-era traffic rejected):

```bash
forgeloop-mcp-http --project /repo --mode safe          # 127.0.0.1:3333
```

- **Loopback only**: non-loopback binds fail closed with
  `E_MCP_REMOTE_NOT_SUPPORTED`. Authenticated remote access is not designed
  yet; Host validation is DNS-rebinding defense, not authentication.
- Strict modern: legacy-era handshakes are rejected, never silently served.
- Stateless: no session identity is issued, so transport metadata is never
  ForgeLoop authority.
- Resource bounds: 4 MiB body cap, POST-only, header/request/keepalive
  timeouts, in-flight ceiling (503 `E_MCP_HTTP_BUSY`).

## Version matrix

| Component | Current contract |
| --- | --- |
| ForgeLoop core package | `>=1.5.0 <2` dependency range; current repository generation `1.9.x` |
| ForgeLoop protocol | `1` |
| Integration API | `1` |
| MCP package | `0.1.x` initial package |
| MCP protocol target | `2026-07-28` |

Repository implementation is separate from npm publication; nothing here
claims a published release.

## Risk classes and gating examples

Invocations are classified at the adapter boundary:

```text
READ_ONLY · LOOP_MUTATION · CLAIM_REACQUISITION · EXTERNAL_EXECUTION
MAINTENANCE · CLAIM_RELEASE_RECOVERY · LEGACY_MIGRATION · FORCE_DESTRUCTIVE
```

Examples: `bundle` → MAINTENANCE (hidden in readonly/safe);
`task-resume` → CLAIM_REACQUISITION (available in safe — canonical claim
reacquisition); `task-recover` → CLAIM_RELEASE_RECOVERY (full +
`--allow-recovery`, plus the canonical acknowledgement); legacy repair →
separately gated/hidden; force unlock → separately gated. Tool input can
never elevate launch policy.

## Bounds and timeouts

- Structured MCP input is byte-bounded (`E_MCP_INPUT_TOO_LARGE`).
- External execution cannot exceed the server launch timeout maximum:
  omitted/null timeout receives the maximum; `0`, negative, non-integer, or
  above-maximum values are refused.
- Tool, capabilities and resource output is bounded using the exact UTF-8
  serialization actually transmitted. Oversized output fails closed with
  `E_MCP_RESULT_TOO_LARGE` and is never silently truncated.

## Adapter errors

Adapter-level errors are separate from the generated ForgeLoop core error
list in [TROUBLESHOOTING](./TROUBLESHOOTING.md):

| Code | Meaning |
| --- | --- |
| `E_MCP_INPUT_TOO_LARGE` | structured tool input exceeds the byte bound |
| `E_MCP_RESULT_TOO_LARGE` | serialized output exceeds the output bound |
| `E_MCP_HTTP_BUSY` | in-flight HTTP ceiling reached (503, Retry-After) |
| `E_MCP_REMOTE_NOT_SUPPORTED` | non-loopback bind attempted |
| `E_MCP_EXECUTION_TIMEOUT_INVALID` | timeout not a positive integer |
| `E_MCP_EXECUTION_TIMEOUT_EXCEEDS_LIMIT` | timeout above server maximum |
| `E_MCP_FORGELOOP_INTEGRATION_UNSUPPORTED` | installed core integration API mismatch |

Canonical ForgeLoop errors (e.g. `E_TASK_SCOPE_CONFLICT`,
`E_TASK_CLAIM_OWNERSHIP_INCONSISTENT`) are always preserved verbatim.
