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

### Profile-aware context

The resolved execution profile is available from the persisted route and from
compact `next`/`task-show` projections. `complianceMode` remains the policy
enforcement dimension; `executionProfile` is the independent process/context
depth dimension.

The API's read-only `task/context` resource provides the canonical host
projection for this decision. It includes the objective, deliverables,
constraints, selected guide IDs, current phase, next action, verification
requirements, resolved profile, and bounded optional-context policy. The MCP
adapter exposes the same projection at
`forgeloop://task/{taskId}/context`.

For `light`, an adapter should send only the current objective, deliverables,
hard constraints, resolved profile, selected guide IDs or relevant guide
sections, current phase, exact next action, and verification requirements. It
should reuse unchanged state locally instead of repeatedly sending full
ledgers, schemas, receipts, or protocol documents. This is presentation
optimization only: required gates, verification truth, authority, provenance,
and validated completion remain unchanged. A lifecycle fast path is not part
of protocol v1.

Optional reflection, trajectory evaluation, handoff, responsibility,
attestation, benchmark, and continuity artifacts are lazy and should be
created only when policy, an explicit request, or recovery requires them.

The profile never authorizes a lifecycle-phase or required-gate skip. A phase
may be absent only when the canonical protocol marks it not applicable;
presentation depth cannot change evidence, verification truth, authority,
provenance, safety-floor, or validator-backed completion requirements.

### Usage and efficiency boundary

Create a context with an optional trusted provider:

```js
const context = createForgeLoopContext({
  usageProvider: {
    async getTaskUsage({ projectPath, taskId }) {
      return hostUsageStore.lookup({ projectPath, taskId });
    },
  },
});
```

The provider returns `PROVIDER_REPORTED` or `HOST_REPORTED` snapshots. The CLI
fallback is explicitly `ACTOR_REPORTED`; missing fields remain `null` and no
token or cost estimate is produced. Usage never satisfies a check or
completion requirement. Use `efficiency --task --baseline <project-local-json>`
only for metadata-compatible comparisons; otherwise the result is
`NOT_COMPARABLE`.

For measured execution-profile comparisons, use the reproducible benchmark
commands in [`EXECUTION_PROFILE_BENCHMARKS.md`](./EXECUTION_PROFILE_BENCHMARKS.md).
The benchmark source policy accepts provider or host observations only and
keeps unavailable or non-comparable measurements out of efficiency claims.

## Consumers

| Surface | Entry |
| --- | --- |
| ForgeLoop CLI | human terminal rendering over the same executors |
| ForgeLoop MCP | `@cassiomc1/forgeloop-mcp`: stdio (default/recommended) plus optional strict-modern loopback-only HTTP; see [MCP.md](./MCP.md) |
| Studio / IDE / CI adapters | the same integration subpath |

All consumers share one protocol authority: `.forgeloop/` state written only
by canonical ForgeLoop commands, so cross-harness continuity and recovery work
identically regardless of transport.

Optional integrations use the same ownership boundary. ForgeLoop derives and
validates workspace bindings, immutable handoffs, responsibility constraints,
verification scopes, execution evidence, code manifests, attestation
statements, and provider results. The embedding host owns checkout selection,
model/tool execution, scheduling, transport, external signer credentials, and
platform presentation. A handoff or continuity note never becomes evidence;
`CHANGED`/`CLAIMED` verification scope never becomes revision-range coverage;
and only a validated external signature can raise `VERIFIED` to `ATTESTED`.
These extensions are optional and do not change the zero-configuration basic
loop.
