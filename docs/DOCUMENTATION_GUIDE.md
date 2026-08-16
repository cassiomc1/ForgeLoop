# ForgeLoop Documentation Guide

This guide explains how to maintain, write, and safely modify ForgeLoop documentation.

---

## 1. Canonical Ownership Model

ForgeLoop strictly separates normative protocol definitions from operational documentation to avoid contradictory rules.

| Area | Location | Responsibility | Rule |
|---|---|---|---|
| **Normative Protocol** | Root (`LOOP_ENGINEERING.md`, `PROTOCOL_INTEGRATION.md`, `LOOP_SYSTEM_DESIGN.md`, `THREAT_MODEL.md`, `EXECUTION_STATE.md`) | Canonical authority for protocol rules, schemas, state transitions, and security | Never duplicate normative rules in sub-documents; link back to root files. |
| **Operational & Reference** | `docs/` (`GETTING_STARTED.md`, `CROSS_HARNESS_CONTINUITY.md`, `CLI_REFERENCE.md`, `ARTIFACT_REFERENCE.md`, `TROUBLESHOOTING.md`, `RECIPES.md`) | Tutorials, command reference, handoff workflows, and troubleshooting | Explains how to operate the system. Links to normative sources for formal specifications. |
| **Domain Engineering** | `ENG/` (`clean-code-eng.md`, `design-code-eng.md`, `test-code-eng.md`, etc.) | Domain-specific implementation and quality standards | Frontmatter must adhere to `validate_loop_system.py` standards. |
| **Visual Architecture** | `docs/forgeloop-flow.mmd` | Canonical architecture diagram source | Rendered SVG committed at `docs/assets/forgeloop-flow.svg`. |
| **Documentation Index** | `DOCS_INDEX.md` | Single repository index and ownership map | Updated whenever documentation structure changes. |

---

## 2. Normative Language Conventions

When writing documentation, use precise terms:

- **MUST / MUST NOT**: Strict protocol requirements enforced by schemas or CLI algorithms.
- **SHOULD / SHOULD NOT**: Strong interoperability recommendations for harnesses.
- **MAY**: Optional behaviors or flags.
- **Illustrative**: Non-normative examples provided for human understanding.

Avoid ambiguous phrases like *"should generally"* or *"usually"* for behaviors that are strictly enforced by the validator.

---

## 3. Linking Conventions

- **Relative Links Only**: Always use relative markdown links for repository files (e.g. `[`LOOP_ENGINEERING.md`](../LOOP_ENGINEERING.md)`).
- **Valid Targets**: Every relative link must point to an existing file and is validated by `python3 scripts/validate_markdown.py`.
- **Anchors**: Anchor links should match standard GitHub heading slugs.

---

## 4. Mermaid Diagrams and SVG Generation

1. **Source is Canonical**: Diagram source files live in `.mmd` files (e.g. `docs/forgeloop-flow.mmd`). Never modify SVG files directly.
2. **Local Committed SVGs**: Generated SVGs are committed locally in `docs/assets/`. Never hotlink externally rendered diagram images.
3. **Fingerprint Verification**: Generated SVGs embed a `data-forgeloop-source-sha256` attribute verified by `npm run docs:check`.

---

## 5. Documentation Change Checklist

Before opening a pull request with documentation changes:

- [ ] Identified the canonical owner of the documented behavior.
- [ ] Did not duplicate normative protocol rules unnecessarily.
- [ ] Updated `DOCS_INDEX.md` if new documents were added.
- [ ] All relative links point to existing files (`python3 scripts/validate_markdown.py`).
- [ ] Python loop system validator passes (`python3 scripts/validate_loop_system.py`).
- [ ] Secret scanner passes (`python3 scripts/scan_secrets.py`).
- [ ] Diagram fingerprint valid (`npm run docs:check`).
- [ ] Node tests pass (`npm test`).
