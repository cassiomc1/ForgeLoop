# Contributing to ForgeLoop

## Before opening a pull request

Run `npm test`, `npm run docs:check`, `npm run pack:check`, and the Python
repository validators. Keep CLI metadata, generated references, schemas, and
conformance scenarios aligned. Do not add vendor-specific runtime behavior:
ForgeLoop remains a file-backed protocol and support CLI.

## Protocol changes

Any persisted artifact or lifecycle change must preserve the published schema
compatibility policy, add valid and invalid fixtures, update `protocol-info`,
and include a recovery path for interrupted writes. A breaking protocol change
requires a new explicit protocol version and migration plan.

## Documentation & MCP verification

- Follow [`docs/DOCUMENTATION_GUIDE.md`](./docs/DOCUMENTATION_GUIDE.md); run
  `npm run docs:generate` before `npm run docs:check`.
- Changes under `integrations/mcp/` require `npm run mcp:test`, and package
  changes require `npm run mcp:pack:check`.

## Review expectations

PRs must explain the task contract, verification evidence, migration impact,
and compatibility impact. Never commit secrets, external credentials, or
unverified publication claims.
