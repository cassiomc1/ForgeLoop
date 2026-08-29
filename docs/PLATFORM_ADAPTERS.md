# Platform Adapters

Platform adapters are convenience layers around the provider-neutral
ForgeLoop verifier. They translate platform context into revisions and an
optional signing policy; they do not become part of ForgeLoop protocol
semantics.

## Generic contract

Every adapter supplies:

```text
revisionProvider
baseRevision
headRevision
optional signingProvider and signer policy
```

The canonical command is:

```bash
forgeloop attestation-verify-range \
  --revision-provider "$FORGELOOP_REVISION_PROVIDER" \
  --base "$FORGELOOP_BASE_REVISION" \
  --head "$FORGELOOP_HEAD_REVISION" \
  --require-complete-coverage \
  --json
```

The repository includes a shell adapter at
[`integrations/generic-ci/verify.sh`](../integrations/generic-ci/verify.sh).
It has no hosting-platform API dependency.

## Mapping examples

| Platform context | Base revision | Head revision |
| --- | --- | --- |
| GitHub change request | change-request base commit | change-request head commit |
| GitLab merge request | merge-request diff base | pipeline commit |
| Local branch comparison | `origin/main` | `HEAD` |
| Enterprise CI | job-provided baseline | job-provided candidate |

Adapters may add platform presentation, annotations, or status publication
after the generic verifier returns. They must not reimplement coverage,
content, evidence, or signature rules; override an invalid result; or require a
platform API in the core package.

Optional adapter examples must pin third-party actions or images immutably.
No adapter is installed into an existing target by ordinary `init` or `update`.
