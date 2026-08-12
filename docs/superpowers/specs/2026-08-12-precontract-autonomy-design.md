# ForgeLoop Pre-Contract Autonomy Design

## Status

Approved for implementation by the user after design review on 2026-08-12.

## Objective

Prevent a blind agent from stopping before contract creation when a missing
product detail is safe to choose locally, while keeping real, sensitive,
irreversible, external, and authoritative decisions user-gated.

The desired behavior is:

```text
NON-BLOCKING AMBIGUITY
    -> SAFE REVERSIBLE DEFAULT
    -> EXPLICIT AGENT ASSUMPTION
    -> CONTRACT CREATION CONTINUES
```

## Scope

In scope:

- a canonical Blocking vs Non-Blocking Decisions policy in
  `LOOP_ENGINEERING.md`;
- an explicit assumption-recording rule that uses the existing contract and
  instruction surfaces, without introducing a new artifact or protocol
  version;
- clarified Execution Contract and Design Gate guidance;
- compact delegation wording in all shipped instruction adapters;
- regression coverage for safe assumptions, blocking decisions, the unchanged
  blind law-firm prompt, and the second-run classification;
- a `Pre-contract autonomy` quality-scorecard dimension.

Out of scope:

- router semantics, guide metadata, phase names or transitions;
- preflight, checkpoint, evidence, receipt, or completion semantics;
- a new CLI command, persistence layer, graph runtime, scheduler, or agent
  runtime;
- forcing a particular fictional brand, contact value, or visual identity;
- changing the blind prompt or pretending that downstream capabilities were
  tested by the second run.

## Decision policy

Classify every unresolved decision before deciding whether to ask the user.

`NON_BLOCKING` applies when a safe local default exists, the choice is
reversible, it does not change external state, it is not sensitive or
authoritative, and it does not assert a real user or business fact. Examples
include fictional identity, demo contacts, placeholder copy, visual defaults,
section ordering, and local-only form behavior.

`BLOCKING` applies when proceeding would require real publishable identity or
contact data, credentials, payment data, production endpoints, deployment or
domain authority, destructive work, irreversible data or architecture choices,
regulated claims, or another externally consequential/high-impact decision.

The safe assumption boundary is therefore:

```text
SAFE + REVERSIBLE + LOCAL + NON-SENSITIVE + NON-AUTHORITATIVE + NON-DESTRUCTIVE
```

## Assumption recording

ForgeLoop will not add a new assumption artifact or change the protocol
version. The agent must record a non-blocking choice in the existing contract
context using an explicit `ASSUMPTION` marker and `source=agent-default`, with
the selected value, reason, scope, and reversible status. Remaining blocking
items stay in the existing unresolved-decision context and still prevent
contract creation.

An assumption is never a verified user or business fact. For a local prototype,
fictional values must remain clearly fictional or demonstrative and publication
or production claims remain independently gated.

## Instruction architecture

`LOOP_ENGINEERING.md` remains the single source of truth. It will state that
unknown non-blocking details do not prevent contract creation and will update
the Design Gate from unconditional approval to classification followed by
either user approval or a recorded safe default.

`AGENTS.md`, `CLAUDE.md`, Cursor, and Copilot adapters will carry only a short
delegation rule: do not stop for reversible placeholder details; follow the
canonical policy. They will not duplicate the classification matrix.

## Verification architecture

`tests/autonomy-policy.test.js` will assert both positive and negative policy
examples directly against the canonical text and adapter delegation markers.
`tests/conformance-scenarios.test.js` will keep the exact blind prompt free of
ForgeLoop coaching and assert that it is explicitly covered by the autonomy
regression contract. The second run record will remain `PARTIAL` with the
failure classified as a pre-contract clarification stop, and downstream
capabilities will remain `NOT_REACHED` rather than being marked failed.

The final validation will include the full Node suite, package check, Python
validators, secret scan, Markdown checks, and a complete diff review.

## Risks and controls

- Over-assumption: countered by explicit blocking examples and the six-part
  safe-boundary invariant.
- Silent invention: countered by mandatory `ASSUMPTION` and
  `source=agent-default` recording.
- Adapter drift: countered by tests requiring delegation wording in every
  shipped adapter.
- Scope expansion: countered by preserving protocol v1, existing phase/router
  semantics, and all completion improvements.
