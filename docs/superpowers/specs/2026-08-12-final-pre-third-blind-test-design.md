# ForgeLoop Final Pre-Third-Blind-Test Design

## Status

Approved implementation direction from the user on 2026-08-12; detailed
design submitted for review before implementation.

## Objective

Make the existing autonomy policy mechanically unambiguous without expanding
the ForgeLoop protocol:

```text
SAFE LOCAL DECISION
    -> current-contract.assumptions[]
    -> preflight may continue

BLOCKING DECISION
    -> current-contract.unresolvedDecisions[]
    -> preflight is BLOCKED
```

The protocol remains version 1, the phase model remains unchanged, and the
third blind run continues to use the existing uncoached prompt.

## Scope

In scope:

- an optional, machine-valid `assumptions[]` field in the current contract;
- canonical creation and validation of safe agent assumptions;
- explicit preflight blocking for non-empty `unresolvedDecisions[]`;
- stable error and repair metadata for unresolved decisions;
- functional, negative, security, and policy regression tests;
- the canonical representation documented in `LOOP_ENGINEERING.md`.

Out of scope:

- changing `protocolVersion` or schema version 1 compatibility;
- router rules, guide metadata, route fingerprints, or required gates;
- phase names, transitions, orchestration, scheduling, or persistence;
- completion, evidence, receipt, audit, or publication semantics;
- changes to the blind prompt or coaching the target agent;
- duplicated assumption schemas in adapters;
- unrelated refactors or new runtime capabilities.

## Current evidence and boundaries

The canonical contract builder is `src/core/contract.js`, the shipped
contract schema is `schemas/current-contract.schema.json`, and preflight
evaluation is implemented in `src/core/preflight.js`. Existing artifact
writes/readers apply schema validation, JSON limits, and the shared
`assertSecretFree` protection. Existing preflight output already supports
structured error objects, while human completion and audit output already
render repair-oriented `NEXT` guidance.

The current checkout is an instruction kit and local protocol-support CLI, not
an LLM runtime. This change therefore only strengthens the contract and
validator boundaries that a host agent can use.

## Contract representation

Add the following optional property to
`schemas/current-contract.schema.json`:

```json
"assumptions": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["value", "reason", "scope", "reversible", "source"],
    "properties": {
      "value": { "type": "string", "minLength": 1 },
      "reason": { "type": "string", "minLength": 1 },
      "scope": { "type": "string", "minLength": 1 },
      "reversible": { "const": true },
      "source": { "const": "agent-default" }
    },
    "additionalProperties": false
  }
}
```

The property is not added to `required`, so existing valid protocol-v1
contracts without `assumptions` remain valid and are interpreted as an empty
list. `createContract()` always serializes the normalized list, using `[]`
when the caller does not provide assumptions. The property is placed in the
canonical output after `objective` and before the existing array fields.

`src/core/contract.js` will expose one focused assumption validator used by
contract creation and explicit validation. It will require an array of plain
objects with exactly the five canonical fields, non-empty strings for
`value`, `reason`, and `scope`, `reversible === true`, and
`source === "agent-default"`. The existing shared secret scanner remains the
authority for secret-like keys and values; assumptions must pass it during
creation, validation, and persistence. No user fact, authority claim, or
destructive operation is made valid merely by being placed in this field.

`validateContract()` and `writeContract()` will apply the same semantic
assumption validation in addition to the shipped JSON schema. Legacy contracts
without the optional property continue through the schema path unchanged.

## Preflight enforcement

After the contract is loaded and schema-validated, `evaluatePreflight()` will
add one stable issue when the contract contains unresolved decisions:

```json
{
  "code": "E_CONTRACT_UNRESOLVED_DECISION",
  "message": "The current contract contains unresolved blocking decisions.",
  "artifacts": [".forgeloop/current-contract.json"],
  "decisions": ["Need the real production domain"],
  "next": "Resolve the blocking decision with the user or applicable authority, update current-contract.json, then rerun preflight."
}
```

The code will be added to the stable protocol failure-code catalog. The
decision list is derived only from the already validated contract, is bounded
to a small deterministic number of entries and character length, and is never
included in the human message. Secret-like contract content is rejected before
this path and therefore is not echoed by the diagnostic. The issue contains
the existing artifact path so integrations can repair the source of truth.

The preflight result is `BLOCKED` whenever this issue exists, and the normal
event path records `PREFLIGHT_BLOCKED`; it cannot emit `PREFLIGHT_READY` for
the same evaluation. The text formatter will render the structured `NEXT`
guidance consistently with completion and audit output. A contract with valid
`assumptions[]` and an empty `unresolvedDecisions[]` receives no such issue.

## Documentation and adapters

`LOOP_ENGINEERING.md` remains the sole canonical policy location. Its safe
assumption rule will explicitly say:

```text
Record safe agent-selected defaults in current-contract.assumptions[].
Each assumption includes value, reason, scope, reversible=true, and
source=agent-default. Do not place resolved safe assumptions in
unresolvedDecisions[].
```

It will also state that non-empty `unresolvedDecisions[]` blocks preflight.
Adapters remain delegating entry points and will not receive a duplicated
schema or a new instruction surface.

## Verification design

Tests will protect both policy text and executable behavior:

1. Contract tests will prove that a valid safe assumption is normalized and
   persists, that an omitted field remains backward-compatible, and that
   invalid `reversible`, `source`, empty fields, unknown properties, malformed
   entries, and secret-like content are rejected.
2. Preflight tests will prepare otherwise valid route and gate artifacts, then
   prove that an unresolved decision returns `BLOCKED` with the stable code,
   remediation, and `PREFLIGHT_BLOCKED` without `PREFLIGHT_READY`.
3. A complementary preflight test will prove that a valid safe assumption
   with no unresolved decisions returns `READY`.
4. Existing autonomy-policy tests will assert the canonical
   `assumptions[]` wording while retaining the current blocking/non-blocking
   examples and adapter delegation checks.
5. Existing routing, completion, schema-health, portability, package, secret,
   Markdown, and protocol tests will remain regression gates.

The implementation will follow RED → expected failure → minimal GREEN →
refactor for each behavior change. Final validation will use the repository's
declared commands and CI-equivalent Python/Markdown/link/secret checks. The
third blind run is a separate post-green activity and is not encoded as a new
protocol feature in this change.

## Acceptance boundary

This design is complete when the repository can mechanically distinguish:

```text
assumptions[] present and valid + unresolvedDecisions[] empty -> READY
unresolvedDecisions[] non-empty -> BLOCKED with stable remediation
```

All existing protocol-v1 artifacts and completion behavior remain compatible,
and no implementation change is made outside the scoped contract, preflight,
documentation, and regression-test surfaces.
