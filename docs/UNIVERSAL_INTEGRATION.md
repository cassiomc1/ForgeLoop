# Universal ForgeLoop Integration

ForgeLoop applies to any agent, harness, IDE, or orchestration runtime — with
or without MCP. The universal rule:

> If the active host exposes an official ForgeLoop structured integration,
> prefer it for protocol operations. Otherwise use the project-local ForgeLoop
> CLI. Never manually synthesize ForgeLoop-managed lifecycle, claim, recovery,
> ledger, or completion state because an integration is unavailable.

## The programmatic integration API

`@cassiomc1/forgeloop/integration` (integration API version 1) is the
transport-neutral entrypoint:

```js
import {
  executeForgeLoopCommand,
  validateForgeLoopCommandInput,
  getForgeLoopCapabilities,
  classifyForgeLoopInvocation,
  readForgeLoopIntegrationResource,
} from "@cassiomc1/forgeloop/integration";
```

- `executeForgeLoopCommand({command, projectPath, input})` returns a
  deterministic envelope: `{ok, command, exitCode, result, error, metadata}`.
  Domain rejections (preflight BLOCKED, audit INVALID) keep `ok:true` with a
  non-zero exit code; `ok:false` means the command could not be executed and
  preserves the canonical public error code.
- Ownership values always come from `resolveTaskClaimState()` through the
  `task/ownership` resource — never derived from raw artifacts.
- Invocation risk classes (READ_ONLY, LOOP_MUTATION, CLAIM_REACQUISITION,
  EXTERNAL_EXECUTION, MAINTENANCE, CLAIM_RELEASE_RECOVERY, LEGACY_MIGRATION,
  FORCE_DESTRUCTIVE) describe what an invocation would do; launch policy
  decides what is allowed.

## Consumers

| Surface | Entry |
| --- | --- |
| ForgeLoop CLI | human terminal rendering over the same executors |
| ForgeLoop MCP | `@cassiomc1/forgeloop-mcp`: stdio (default/recommended) plus optional strict-modern loopback-only HTTP; see [MCP.md](./MCP.md) |
| Studio / IDE / CI adapters | the same integration subpath |

All consumers share one protocol authority: `.forgeloop/` state written only
by canonical ForgeLoop commands, so cross-harness continuity and recovery work
identically regardless of transport.
