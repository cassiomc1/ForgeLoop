# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability in ForgeLoop's file
handling, task isolation, command execution, or release process. Report it
privately to the repository maintainers with a minimal reproduction, affected
version, impact, and any safe mitigation already identified.

## Supported releases

Only the latest published npm release receives security fixes. Protocol
artifacts declare both `protocolVersion` and `schemaVersion`; unknown versions
must be rejected rather than interpreted permissively.

## Security boundaries

ForgeLoop does not execute shell strings: command checks use exact argv,
bounded output capture, and timeout termination. It does not install software
without a host-attested authority grant. Paths must remain within the selected
target and cannot traverse symlinks. Transaction journals, task locks, and
hash-chained events are integrity mechanisms, not a substitute for operating
system access control.

## MCP local boundary

The optional ForgeLoop MCP HTTP transport is **loopback-only**; non-loopback
binds are refused (`E_MCP_REMOTE_NOT_SUPPORTED`) and authenticated remote MCP
is unsupported. Host/Origin validation is DNS-rebinding defense, not remote
authentication. Security reports covering the MCP adapter are in scope.
