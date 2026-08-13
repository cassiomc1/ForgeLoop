# ForgeLoop conformance scenarios

These scenarios are adapter-facing contracts. They describe requests and the
artifacts a live agent must produce; they do not invoke a model runtime and are
not part of the deterministic `npm test` execution path.

The current published baseline for new runs is
`@cassiomc1/forgeloop@0.1.9`. Pin that version when preparing a reproducible
blind run; historical reports retain the exact package version they used.

The frozen baseline was verified on 2026-08-13 with this identity:

```text
package: @cassiomc1/forgeloop@0.1.9
npm gitHead: 0e48240894671ecda2458b15671020b0a7255e70
release commit: 0e48240894671ecda2458b15671020b0a7255e70
GitHub tag: v0.1.9 -> 0e48240894671ecda2458b15671020b0a7255e70
tarball URL: https://registry.npmjs.org/@cassiomc1/forgeloop/-/forgeloop-0.1.9.tgz
tarball SHA-1: fef7587ebd878e845e9746b4d049a6fe6ef333c5
npm SHA-512 integrity: sha512-sCvPEDOYT1svNnA8+zw57dJ97N6sNCUH8eDbM6f3cS6eXLCIFFXRPkCAASA+ZPu5mAKbcNaU1TaFKjojbL3DEA==
release identity: RELEASE_IDENTITY_VALID
```

The repository may contain documentation or executable commits after this
frozen package. Those commits do not change the package used by the blind run;
the repository's `0.1.10` candidate includes completion-validation and cleanup
TOCTOU fixes that are not in `0.1.9`. If a blind run needs those executable
changes, publish and tag the candidate, then repeat the complete identity check
before starting the run.

Run a scenario in a disposable target using the Standard profile first:

```bash
npx @cassiomc1/forgeloop preflight --json
npx @cassiomc1/forgeloop next --json
npx @cassiomc1/forgeloop audit --json
npx @cassiomc1/forgeloop complete --json
```

The expected post-implementation path is:

```text
implementation
→ forgeloop next
→ advance --to VERIFYING
→ forgeloop next
→ prepare-completion
→ forgeloop next
→ checks + record-check
→ forgeloop next
→ advance --to REVIEWING
→ forgeloop next
→ complete
```

Use the Strict profile only as a separate experiment:

```bash
# .forgeloop/kit/PROJECT_PROFILE.md must be verified before this profile starts.
npx @cassiomc1/forgeloop preflight --strict --json
npx @cassiomc1/forgeloop audit --strict --json
npx @cassiomc1/forgeloop complete --strict --json
```

Do not mix Standard and Strict criteria in one conformance result. Live-run
diagnostic records belong under [`conformance/runs/`](./runs/); they must not
contain secrets, credentials, hidden reasoning, or unnecessary conversation
history.

## Release identity evidence

Every live-run report records the exact published package used by the target.
Include all of these fields before sending the blind prompt:

```text
package: @cassiomc1/forgeloop@X.Y.Z
npm gitHead: <40-character commit SHA>
release commit: <40-character commit SHA>
GitHub tag: vX.Y.Z -> <40-character commit SHA>
tarball URL: https://registry.npmjs.org/...
tarball SHA-1: <40-character hex digest>
npm SHA-512 integrity: sha512-<base64 digest>
release identity: RELEASE_IDENTITY_VALID
```

Run the repository's read-only verifier against the exact release commit:

```bash
RELEASE_COMMIT="$(git rev-list -n1 vX.Y.Z)"
npm run release:identity -- --version X.Y.Z --release-commit "$RELEASE_COMMIT"
```

Do not interpret a local package version, a green build, or a tarball URL by
itself as publication proof. If the verifier cannot establish every identity
field, record `RELEASE_IDENTITY_NOT_VERIFIED` or
`RELEASE_IDENTITY_INVALID` and do not start the blind run.

The complete-website scenario deliberately fails when implementation starts
before the contract, route, and required gates exist.

## Migration compatibility evidence

The real published `0.1.6` fixture at
[`tests/fixtures/legacy-0.1.6/`](../tests/fixtures/legacy-0.1.6/) is frozen
with package, tarball, SHA-1, SHA-512, `gitHead`, and extraction-date metadata.
The migration tests run from those local bytes and cover interruptions after
hidden writes, after hidden verification, after the manifest authority switch,
and during legacy cleanup. An interrupted target must be diagnosed as
`E_MIGRATION_INCOMPLETE`; a later `update` may retry only hash-owned cleanup.
User-modified, unmanaged, and `preserve=true` files remain untouched even when
that leaves a root residual. ForgeLoop revalidates the recorded ownership hash
immediately before deleting each managed legacy file. This narrows the race
window but does not provide OS-level filesystem locking against a separately
privileged concurrent process.

## Autonomous blind-run isolation

External workflows may help with local planning, review, tests, or
documentation, but a mandatory approval policy for a ForgeLoop `NON_BLOCKING`
decision is `INCOMPATIBLE WITH AUTONOMOUS MODE`. The harness must exclude that
policy before the blind prompt starts; do not add a hint to the prompt that
changes the scenario. `NON_BLOCKING` must remain non-blocking, and any
compatibility conflict is recorded as `WORKFLOW_CONFLICT`, not as a fake user
blocker.

For the sixth blind run, record these values before sending the unchanged blind
prompt:

```text
mandatory-approval workflows enabled: NO
external brainstorming hard gate enabled: NO
external design approval gate enabled: NO
subagents enabled: NO
delegation enabled: NO
```

Also record the available and invoked external workflows, explicit autonomy
mode, process count, subagent count, and delegation status. If the harness
cannot disable a mandatory approval workflow, record `TEST_NOT_STARTED` and do
not interpret the run as a conformance failure or success. An installed
workflow and a compatible workflow are separate claims; use
`INCOMPATIBLE WITH AUTONOMOUS MODE`, not "broken", for the former.

Every live-run report must classify how it ended with exactly one
`terminationSource`: `AGENT`, `OPERATOR`, `HARNESS`, `TIMEOUT`, or `BLOCKER`.
An operator-terminated run is recorded as `RUN_STATUS: OPERATOR_INTERRUPTED`,
`CONFORMANCE: PARTIAL`, with post-termination capabilities marked
`NOT_REACHED` and the smallest failure class `OPERATOR_INTERRUPTION`.
