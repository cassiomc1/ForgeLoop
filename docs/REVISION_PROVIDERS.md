# Revision Providers

Revision providers supply the exact source snapshot used by ForgeLoop code
manifests and revision-range coverage. The interface is source-control-host
neutral; Git is the first implementation.

## Contract

A provider must expose these methods:

```js
{
  detect(target),
  getCurrentRevision(target),
  getChangedEntries({ target, baseRevision, headRevision, paths }),
  readContent({ target, revision, path }),
  getContentIdentity({ target, revision, path }),
  getRepositoryIdentity(target)
}
```

Changed entries use normalized forward-slash paths and carry an operation,
content kind, optional raw bytes, an optional provider content identity, and
provider metadata. Provider revision identifiers are opaque to ForgeLoop.

## Git provider

The built-in `git` provider handles:

- worktree, commit, index, and opaque revision reads;
- exact raw bytes for files and symlink targets;
- deletion, rename, copy, type-change, and Gitlink entries;
- Git object identity when it is available;
- literal path arguments through `execFile`, without shell interpolation.

Select it explicitly in a range check:

```bash
forgeloop attestation-verify-range \
  --revision-provider git \
  --base origin/main \
  --head HEAD \
  --require-complete-coverage
```

Git metadata is an implementation detail of this provider. The attestation
core does not import Git helpers and can accept a future snapshot or
content-addressable provider without changing the statement schema.

## Error boundary

Providers must expose stable ForgeLoop errors rather than requiring callers to
parse command output:

| Code | Meaning |
| --- | --- |
| `E_REVISION_PROVIDER_UNAVAILABLE` | No selected provider can service the target. |
| `E_REVISION_PROVIDER_AMBIGUOUS` | Automatic detection found multiple providers. |
| `E_REVISION_PROVIDER_INVALID` | Provider output or contract is malformed. |
| `E_REVISION_NOT_FOUND` | The requested revision cannot be resolved. |
| `E_REVISION_CONTENT_UNAVAILABLE` | The requested path content cannot be read. |

Providers must reject unsafe or reserved paths, preserve deletion semantics,
and distinguish a missing content path from an unavailable provider. Unknown
provider semantics fail closed.

## Conformance expectations

An implementation should be tested for deterministic identity, exact bytes,
binary and empty files, Unicode and space-containing paths, symlinks,
Gitlinks, deletions, renames, path traversal, and stable error mapping.
