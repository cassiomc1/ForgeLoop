# ForgeLoop Documentation Guide

This guide explains how to maintain, write, and safely modify ForgeLoop documentation.

---

## 1. Canonical Ownership Model

ForgeLoop strictly separates normative protocol definitions from operational documentation to avoid contradictory rules.

| Area | Location | Responsibility | Rule |
| --- | --- | --- | --- |
| **Normative Protocol** | Root (`LOOP_ENGINEERING.md`, `PROTOCOL_INTEGRATION.md`, `LOOP_SYSTEM_DESIGN.md`, `THREAT_MODEL.md`, `EXECUTION_STATE.md`) | Canonical authority for protocol rules, schemas, state transitions, and security | Never duplicate normative rules in sub-documents; link back to root files. |
| **Operational & Reference** | `docs/` (`GETTING_STARTED.md`, `CROSS_HARNESS_CONTINUITY.md`, `CLI_REFERENCE.md`, `ARTIFACT_REFERENCE.md`, `TROUBLESHOOTING.md`, `RECIPES.md`) | Tutorials, command reference, handoff workflows, and troubleshooting | Explains how to operate the system. Links to normative sources for formal specifications. |
| **Domain Engineering** | `ENG/` (`clean-code-eng.md`, `design-code-eng.md`, `test-code-eng.md`, etc.) | Domain-specific implementation and quality standards | Frontmatter must adhere to `validate_loop_system.py` standards. |
| **Visual Architecture** | `docs/forgeloop-flow.mmd` | Canonical architecture diagram source | Rendered SVG committed at `docs/assets/forgeloop-flow.svg`. |
| **Documentation Index** | `DOCS_INDEX.md` | Single repository index and ownership map | Updated whenever documentation structure changes. |

---

## 2. Documentation Source-of-Truth Rules

When updating documentation, always derive content from its authoritative source:

```text
CLI syntax truth        -> CLI registry / parser (src/cli.js, src/core/cli-metadata.js)
Artifact shape truth    -> JSON schemas (schemas/*.schema.json, src/core/artifact-registry.js)
Lifecycle truth         -> protocol / state machine (src/core/protocol.js)
Reason-code truth       -> exported protocol constants (src/core/error-codes.js, src/core/protocol.js)
Package contents truth  -> package.json + package tests (tests/package.test.js)
Documentation routing   -> DOCS_INDEX.md
```

Operational documentation must explain canonical behavior, not redefine it.

---

## 3. Documentation Conformance Matrix

| Documentation Area | Canonical Machine Source | Conformance Validator |
| --- | --- | --- |
| **CLI commands & flags** | `CLI_COMMAND_METADATA` (`src/core/cli-metadata.js`) & `src/cli.js` | `scripts/validate_documentation_conformance.mjs` |
| **Artifact paths** | `ARTIFACT_REGISTRY` (`src/core/artifact-registry.js`) | `scripts/validate_documentation_conformance.mjs` |
| **Artifact fields & types** | `schemas/*.schema.json` | `scripts/validate_documentation_conformance.mjs` |
| **Enums & consts** | `schemas/*.schema.json` | `scripts/validate_documentation_conformance.mjs` |
| **Lifecycle phases** | `WORK_PHASES` (`src/core/protocol.js`) | `scripts/validate_documentation_conformance.mjs` |
| **Stable error codes** | `PUBLIC_ERROR_CODES` (`src/core/error-codes.js`) | `scripts/validate_documentation_conformance.mjs` |
| **Discovery resume rules** | `DISCOVERY_SURFACES` & `nativeShim` | `scripts/validate_documentation_conformance.mjs` |
| **Package-shipped docs** | `package.json` (`files`) | `tests/package.test.js` |
| **Architecture diagram** | `docs/forgeloop-flow.mmd` | `scripts/check-generated-diagram.mjs` |

---

## 4. Normative Language Conventions

When writing documentation, use precise terms:

- **MUST / MUST NOT**: Strict protocol requirements enforced by schemas or CLI algorithms.
- **SHOULD / SHOULD NOT**: Strong interoperability recommendations for harnesses.
- **MAY**: Optional behaviors or flags.
- **Illustrative**: Non-normative examples provided for human understanding.

Avoid ambiguous phrases like *"should generally"* or *"usually"* for behaviors that are strictly enforced by the validator.

---

## 5. Linking Conventions

- **Relative Links Only**: Always use relative markdown links for repository files (e.g. `[`LOOP_ENGINEERING.md`](../LOOP_ENGINEERING.md)`).
- **Valid Targets**: Every relative link must point to an existing file and is validated by `python3 scripts/validate_markdown.py`.
- **Anchors**: Anchor links should match standard GitHub heading slugs.

---

## 6. Mermaid Diagrams and SVG Generation

1. **Source is Canonical**: Diagram source files live in `.mmd` files (e.g. `docs/forgeloop-flow.mmd`). Never modify SVG files directly.
2. **Local Committed SVGs**: Generated SVGs are committed locally in `docs/assets/`. Never hotlink externally rendered diagram images.
3. **Fingerprint Verification**: Generated SVGs embed a `data-forgeloop-source-sha256` attribute verified by `npm run docs:check`.

---

## 7. Documentation Change Checklist for Pull Requests

For documentation-impacting changes, verify each item before merging:

- [ ] Did CLI behavior change?
- [ ] Did any schema field change?
- [ ] Did any enum or status change?
- [ ] Did any lifecycle transition change?
- [ ] Did any artifact mutation rule change?
- [ ] Did any stable reason/error code change?
- [ ] Did cross-harness resume behavior change?
- [ ] Did package-shipped documentation change?
- [ ] Were generated/reference docs updated?
- [ ] Did documentation conformance CI pass (`npm run docs:check`)?
