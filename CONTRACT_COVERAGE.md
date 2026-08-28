# Protocol contract coverage map

Every critical contract maps to an implementation and executable positive and
negative evidence. A row is not complete when it has only structural schema
coverage.

| Contract | Implementation | Positive test | Negative test |
| --- | --- | --- | --- |
| Routing work types and primary guides | `src/core/router.js` | `tests/routing-invariants.test.js` and `tests/fixtures/routes/` | unknown work type in `tests/router.test.js` |
| Routing platform semantics | `src/core/router.js`, `GUIDE_ROUTER.md` | mobile/desktop/server/CI cases in `tests/routing-invariants.test.js` | platform-only no-guide case |
| Routing exclusions and invariants | `assertRouteInvariants` | route fixture loop | overlap, missing reason, and primary checks |
| State transitions | `src/core/protocol.js` | `tests/protocol-transitions.test.js` | terminal regression and same-phase cases |
| Contract and repository freshness | `src/core/work-state.js`, `classifyLoadedWorkState` | `tests/checkpoint-freshness.test.js`, `tests/validate-protocol-cli.test.js` | changed contract/HEAD, omitted contract, and missing comparison |
| Required artifact freshness | `readRequiredArtifactFingerprints`, `classifyLoadedWorkState` | `tests/checkpoint-freshness.test.js`, `tests/validate-protocol-cli.test.js` | matching hash, missing, and changed artifact cases |
| Schema health | `inspectSchemaHealth` | `tests/schema-health.test.js` | missing, invalid, and unsupported-version schemas |
| Evidence vocabulary | `src/core/evidence.js` | `tests/evidence.test.js` | unknown kind and incomplete record |
| Verification execution isolation | `src/core/verification-execution.js`, `src/core/runtime-context.js` | adapter call binding, disposable cwd, timeout/termination/truncation preservation, and canonical isolation combinations in `tests/verification-execution-isolation.test.js` | missing adapter under required policy, malformed/contradictory isolation metadata, and live-root cwd claims in `tests/verification-execution-isolation.test.js` |
| Receipt semantics | `src/core/receipt.js` | `tests/receipt-semantics.test.js` | unsupported publication, review, check, and completion claims |
| Cross-artifact conformance | `src/core/conformance.js`, `src/commands/validate-protocol.js` | `tests/conformance.test.js`, `tests/validate-protocol-cli.test.js` | `stateClassification`, derived stale details, precedence, mismatch, incomplete, and incompatible fixtures |
| Delegation conflicts | `src/core/delegation.js` | `tests/delegation-set.test.js` | WRITE/WRITE, WRITE/READ, unknown dependency, and cycle cases |
| Safe path boundary | `src/core/filesystem.js` | `tests/core.test.js`, `tests/portability.test.js` | traversal, drive escape, and symlink fixtures |
| Untrusted JSON limits | `src/core/json-safety.js` | `tests/security-limits.test.js` | depth, array, string, and byte limits |
| Artifact content boundary | `src/core/receipt.js`, `scripts/scan_secrets.py` | `tests/security-limits.test.js`, `tests/test_scan_secrets.py` | nested marker values and scanner fixtures |
| Deterministic CLI JSON | CLI command modules | route, inspect, status, doctor, state, receipt, and protocol tests | malformed artifact and path-boundary cases |

The map is maintained with the protocol and is intentionally explicit about
negative evidence. Remote checks, provider calls, publication, and deployment
remain outside the local contract.
