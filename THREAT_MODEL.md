# mdfiles protocol threat model

**Status:** Implemented boundary inventory; verify target-specific permissions
and external publication evidence separately.

`mdfiles` reads untrusted project files and local protocol artifacts, but it is
not an agent runtime. It does not execute commands found in those files, call
an LLM, or publish on behalf of a target. The controls below describe the
remaining trust boundaries and their executable evidence.

| Threat | Impact | Trust boundary | Mitigation | Residual limitation | Test evidence |
| --- | --- | --- | --- | --- | --- |
| Path traversal | Writes or reads outside the selected target | Target path and every managed relative path | `ensureWithin`, safe-path checks, realpath containment, Windows-drive rejection | A separately privileged process can change the filesystem after validation | `tests/core.test.js`, `tests/portability.test.js`, `tests/fixtures/protocol/invalid/path-traversal.json` |
| Symlink escape | Redirects a managed path to another directory | Existing target parents and artifact paths | Reject symlinked targets, parents, and destinations before access | The check is not a filesystem lock | `tests/core.test.js`, `tests/portability.test.js`, `tests/fixtures/protocol/invalid/symlink-target.json` |
| Malicious manifest | Causes unsafe update or false ownership claims | `.mdfiles/manifest.json` | Schema, hash, safe-path, and preserve-flag validation; conflicts remain visible | A trusted operator can still deliberately edit the manifest | `tests/cli.test.js`, `tests/core.test.js` |
| Malicious work-state | Resumes stale, secret-bearing, or invalid work | `.mdfiles/work-state.json` | Schema/semantic checks, version checks, transition checks, contract/HEAD/artifact freshness, secret scan, size/depth bounds | Freshness cannot prove that an external process did not alter a file immediately afterward | `tests/work-state.test.js`, `tests/checkpoint-freshness.test.js`, `tests/security-limits.test.js` |
| Malicious receipt | Turns local claims into false publication or completion claims | Execution receipt JSON | Semantic evidence checks for completion, checks, review, push, commit, and deployment; explicit publication booleans | Evidence text is declarative and must still be reviewed for provenance | `tests/receipt-semantics.test.js`, `tests/observability.test.js` |
| Malicious task brief | Grants a child task more authority than intended | Delegation brief JSON and host harness | Relative path boundaries, guide/verification/authority checks, secret-free validation, set validation, parent integration ownership | The host harness remains responsible for OS permissions and execution policy | `tests/delegation.test.js`, `tests/delegation-set.test.js` |
| Artifact content exposure | Sensitive material enters portable artifacts or diagnostics | State, receipt, delegation, evidence, and repository text | Nested key/value detection, shaped marker patterns, scanner coverage, no content echo in errors | Content scanners cannot prove that an unknown encoding is harmless | `tests/security-limits.test.js`, `tests/test_scan_secrets.py`, `scripts/scan_secrets.py` |
| Stale checkpoint replay | Repeats work against a changed contract or material file | Resume boundary between a saved state and current target | Contract fingerprint, repository fingerprint, required-artifact hashes, protocol version, and conservative revalidation | A contract author must provide the current contract file for comparison | `tests/checkpoint-freshness.test.js`, `tests/cli.test.js` |
| Unsafe publication claim | Local output is mistaken for push, PR, merge, or deployment | Receipt publication fields and evidence | Publication starts false; each true claim requires matching evidence; no CLI publication action | Remote provider state is outside local verification | `tests/receipt-semantics.test.js`, `README.md` |
| Schema confusion | A malformed or altered schema is treated as available | Shipped and target-local `schemas/` directory | Health checks parse every schema and classify valid, missing, invalid, or unsupported-version | Schema health does not replace review of semantic relationships | `tests/schema-health.test.js`, `src/core/schema-validation.js` |
| Protocol-version confusion | Old/future artifacts are silently reinterpreted | Cross-artifact protocol boundary | Explicit v1 checks and conformance errors for unsupported or mixed versions | A future protocol needs a deliberate migration implementation | `tests/conformance.test.js`, `tests/fixtures/protocol/invalid/` |
| Dependency-cycle denial of service | Coordination cannot make progress or spends unbounded work | Delegation dependency graph | Deterministic DFS cycle detection, unknown-reference rejection, and bounded JSON | A caller can still submit many valid tasks; host-level quotas remain external | `tests/delegation.test.js`, `tests/delegation-set.test.js` |
| Oversized JSON artifacts | Excess CPU or memory during validation | Any untrusted JSON artifact | Byte, depth, array, object-key, and string limits before semantic traversal | Limits are conservative defaults, not a complete resource scheduler | `tests/security-limits.test.js`, `src/core/json-safety.js` |

## Boundary rules

- Safe paths are checked before reading or writing; no protocol field is a
  shell command.
- A `NOT_VERIFIED` or `BLOCKED` evidence record is never upgraded to observed
  success by a formatter.
- Local checks do not imply remote publication, merge, deployment, or provider
  confirmation.
- Credentials remain outside Git and outside protocol artifacts.
