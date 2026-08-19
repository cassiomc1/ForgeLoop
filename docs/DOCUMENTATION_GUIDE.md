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
| **Consumer Documentation Quality** | [`ENG/documentation-quality-eng.md`](../ENG/documentation-quality-eng.md) | Quality standards for documentation work in projects using ForgeLoop | Governs client/consumer project documentation tasks via guide routing. |
| **Visual Architecture** | `docs/forgeloop-flow.mmd` | Canonical architecture diagram source | Rendered SVG committed at `docs/assets/forgeloop-flow.svg`. |
| **Documentation Index** | `DOCS_INDEX.md` | Single repository index and ownership map | Updated whenever documentation structure changes. |

---

## 2. Documentation Source-of-Truth Rules

When updating documentation, always derive content from its authoritative source:

```text
CLI syntax truth        -> CLI registry / parser (src/cli.js, src/core/cli-command-definitions.js, src/core/cli-metadata.js)
Artifact shape truth    -> JSON schemas (schemas/*.schema.json, src/core/artifact-registry.js)
Lifecycle truth         -> protocol / state machine (src/core/protocol.js)
Reason-code truth       -> exported protocol constants (src/core/error-codes.js, src/core/protocol.js)
Guide registry truth    -> canonical guide registry (src/config/guides.json)
Package contents truth  -> package.json + package tests (tests/package.test.js)
Documentation routing   -> DOCS_INDEX.md
```

Operational documentation must explain canonical behavior, not redefine it.

Canonical phase and transition inventories must be derived from `WORK_PHASES`
and `WORK_TRANSITIONS`; do not maintain independent hand-written transition
enums when a generated or mechanically validated representation is available.

---

## 3. Generated Documentation Provenance & Pipeline

ForgeLoop mechanically enforces documentation freshness using deterministic generator targets. If public facts change and documentation regions are not refreshed, CI fails.

```text
runtime facts
    ↓
canonical registries / schemas
    ↓
deterministic generators (scripts/generate_documentation_reference.mjs)
    ↓
generated Markdown regions (<!-- BEGIN FORGELOOP GENERATED: ... -->)
    ↓
semantic conformance checks (scripts/validate_documentation_conformance.mjs)
    ↓
cross-platform CI (.github/workflows/docs-quality.yml)
```

### Provenance Mapping Table

| Fact Category | Canonical Machine Source | Generated Target File | Generated Region Marker |
| --- | --- | --- | --- |
| **Artifact Inventory** | `ARTIFACT_REGISTRY` (`src/core/artifact-registry.js`) | `docs/ARTIFACT_REFERENCE.md` | `<!-- BEGIN FORGELOOP GENERATED: artifact-registry -->` |
| **Artifact Fields** | `schemas/*.schema.json` | `docs/ARTIFACT_REFERENCE.md` | `<!-- BEGIN FORGELOOP GENERATED: schema:<name> -->` |
| **CLI Command Index** | `CLI_COMMAND_DEFINITIONS` (`src/core/cli-command-definitions.js`) | `docs/CLI_REFERENCE.md` | `<!-- BEGIN FORGELOOP GENERATED: cli-command-index -->` |
| **CLI Common Options** | `CLI_COMMAND_DEFINITIONS` (`src/core/cli-command-definitions.js`) | `docs/CLI_REFERENCE.md` | `<!-- BEGIN FORGELOOP GENERATED: cli-common-options -->` |
| **CLI Command Options** | `CLI_COMMAND_DEFINITIONS` (`src/core/cli-command-definitions.js`) | `docs/CLI_REFERENCE.md` | `<!-- BEGIN FORGELOOP GENERATED: cli:<command>:options -->` |
| **Work-State Transitions** | `WORK_PHASES` / `WORK_TRANSITIONS` (`src/core/protocol.js`) | `ORCHESTRATOR_INTEGRATION.md` | `<!-- BEGIN FORGELOOP GENERATED: work-transitions -->` |
| **Public Error Codes** | `PUBLIC_ERROR_CODES` (`src/core/error-codes.js`) | `docs/TROUBLESHOOTING.md` | `<!-- BEGIN FORGELOOP GENERATED: public-error-codes -->` |
| **Architecture Flow** | `docs/forgeloop-flow.mmd` | `docs/assets/forgeloop-flow.svg` | Verified via embedded SHA-256 fingerprint |

### Maintenance Workflow

Whenever CLI definitions, schemas, or error codes change:

```bash
# 1. Regenerate all deterministic documentation regions
npm run docs:generate

# 2. Run the test suite (includes parser parity and unit tests)
npm test

# 3. Verify freshness, diagram fingerprints, and semantic conformance
npm run docs:check
```

Do not hard-code inventory totals in prose or headings. Counts of commands,
schemas, fields, and public codes are derived from the registries and schemas;
when those sources change, regenerate the reference documents and let the
conformance checks detect omissions.

---

## 4. Documentation Conformance Matrix

| Documentation Area | Canonical Machine Source | Conformance Validator |
| --- | --- | --- |
| **CLI commands & flags** | `CLI_COMMAND_METADATA` (`src/core/cli-metadata.js`) & `src/cli.js` | `scripts/validate_documentation_conformance.mjs` |
| **Artifact paths** | `ARTIFACT_REGISTRY` & `task-paths.js` | `scripts/validate_documentation_conformance.mjs` |
| **Artifact fields & types** | `schemas/*.schema.json` | `scripts/validate_documentation_conformance.mjs` |
| **Enums & consts** | `schemas/*.schema.json` | `scripts/validate_documentation_conformance.mjs` |
| **Lifecycle phases** | `WORK_PHASES` (`src/core/protocol.js`) | `scripts/validate_documentation_conformance.mjs` |
| **Lifecycle transitions** | `WORK_TRANSITIONS` (`src/core/protocol.js`) + the special `BLOCKED` rule | `scripts/generate_documentation_reference.mjs` and `scripts/validate_documentation_conformance.mjs` |
| **Stable error codes** | `PUBLIC_ERROR_CODES` (`src/core/error-codes.js`) | `scripts/validate_documentation_conformance.mjs` |
| **Discovery resume rules** | `DISCOVERY_SURFACES` & `nativeShim` | `scripts/validate_documentation_conformance.mjs` |
| **Task-layout path freshness** | `TASK_LAYOUT_DOCUMENTS` & `task-paths.js` | `scripts/validate_documentation_conformance.mjs` |
| **Package-shipped docs** | `package.json` (`files`) | `tests/package.test.js` |
| **Architecture diagram** | `docs/forgeloop-flow.mmd` | `scripts/check-generated-diagram.mjs` |

---

## 5. Normative Language Conventions

When writing documentation, use precise terms:

- **MUST / MUST NOT**: Strict protocol requirements enforced by schemas or CLI algorithms.
- **SHOULD / SHOULD NOT**: Strong interoperability recommendations for harnesses.
- **MAY**: Optional behaviors or flags.
- **Illustrative**: Non-normative examples provided for human understanding.

Avoid ambiguous phrases like *"should generally"* or *"usually"* for behaviors that are strictly enforced by the validator.

### Multi-Task Layout Rules

- Canonical task-scoped paths are defined in `src/core/task-paths.js` under `.forgeloop/task-state/<taskKey>/`.
- Operational guides (`README.md`, `GETTING_STARTED.md`, `RECIPES.md`, `CROSS_HARNESS_CONTINUITY.md`, `TROUBLESHOOTING.md`) must document namespaced paths by default.
- Architecture/integration documents (`LOOP_SYSTEM_DESIGN.md`, `ORCHESTRATOR_INTEGRATION.md`) are covered by the same task-layout conformance scope (`TASK_LAYOUT_DOCUMENTS`).
- Legacy ForgeLoop 1.0 singleton paths (e.g. `.forgeloop/current-contract.json`) are permitted **only** inside explicit legacy migration regions:

  ```markdown
  <!-- BEGIN FORGELOOP LEGACY LAYOUT EXAMPLE -->
  ...
  <!-- END FORGELOOP LEGACY LAYOUT EXAMPLE -->
  ```

- `scripts/validate_documentation_conformance.mjs` mechanically rejects any singleton task path outside these markers.

---

## 6. Linking Conventions

- **Relative Links Only**: Always use relative markdown links for repository files (e.g. `[`LOOP_ENGINEERING.md`](../LOOP_ENGINEERING.md)`).
- **Valid Targets**: Every relative link must point to an existing file and is validated by `python3 scripts/validate_markdown.py`.
- **Anchors**: Anchor links should match standard GitHub heading slugs.

---

## 7. Mermaid Diagrams and SVG Generation

1. **Source is Canonical**: Diagram source files live in `.mmd` files (e.g. `docs/forgeloop-flow.mmd`). Never modify SVG files directly.
2. **Local Committed SVGs**: Generated SVGs are committed locally in `docs/assets/`. Never hotlink externally rendered diagram images.
3. **Self-Contained & GitHub-Safe**: Generated SVGs must not import external stylesheets (e.g. `@import url(...)`), must not embed `<script>` or `<foreignObject>`, and must be visible via standard Markdown image syntax (`![alt](./path.svg)`).
4. **Fingerprint Verification**: Generated SVGs embed a `data-forgeloop-source-sha256` attribute verified by `npm run docs:check`.

---

## 8. README Hero and Package Boundary

README hero assets are branding/conceptual illustrations. They are not the
canonical protocol diagram. `docs/forgeloop-flow.mmd` remains the canonical
architecture flow source and `docs/assets/forgeloop-flow.svg` remains its
generated render.

The README hero is intentionally GitHub-repository-only:

- `README.md` may reference `docs/assets/eng_readme_forgeloop.png`; GitHub
  renders it from the repository.
- The hero PNG is excluded from the npm package (`package.json` `files`), and
  `tests/package.test.js` asserts that exclusion so it cannot be silently
  re-included.
- The packaged README is therefore not self-contained for that relative hero
  path; do not claim otherwise.
- If a portable hero is ever shipped, any relative README asset referenced by
  packaged Markdown must be present in the package and covered by
  `tests/package.test.js`.

Never delete `docs/assets/forgeloop-flow.svg`; it is generator-owned output of
the diagram workflow.

---

## 9. Documentation Change Checklist for Pull Requests

For documentation-impacting changes, verify each item before merging:

- [ ] Did CLI behavior change?
- [ ] Did any schema field change?
- [ ] Did any enum or status change?
- [ ] Did any lifecycle transition change?
- [ ] Did any artifact mutation rule change?
- [ ] Did any stable reason/error code change?
- [ ] Did cross-harness resume behavior change?
- [ ] Did package-shipped documentation change?
- [ ] Were generated reference docs updated (`npm run docs:generate`)?
- [ ] Did documentation conformance CI pass (`npm run docs:check`)?
