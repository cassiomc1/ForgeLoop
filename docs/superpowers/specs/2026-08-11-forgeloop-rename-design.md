# ForgeLoop Rename and Architecture Diagram

**Repository:** `cassiomc1/mdfiles` (the remote slug is unchanged by this local change)
**Scope:** Rename the active project identity from `mdfiles` to `ForgeLoop` and add a canonical architecture diagram based on the supplied reference.
**Type:** Cross-cutting package, CLI, installer, template, test, and documentation change
**Protocol version:** unchanged at `1`

## Objective

Make `ForgeLoop` the canonical product identity across the executable package,
CLI help, installed target metadata, source code, tests, and active public
documentation. Add a text-only architecture diagram that explains how routing,
state, evidence, freshness, conformance, and delegation combine into a
compatible harness.

## Naming contract

| Surface | New canonical value |
| --- | --- |
| Product and documentation brand | `ForgeLoop` |
| Machine-readable lowercase identifier | `forgeloop` |
| npm package | `@cassiomc1/forgeloop` |
| CLI executable | `forgeloop` |
| Installed target metadata directory | `.forgeloop/` |
| Persisted work state | `.forgeloop/work-state.json` |
| Installed manifest | `.forgeloop/manifest.json` |

The existing `mdfiles` package name, CLI name, and `.mdfiles` path are not
canonical after this change. This is an intentional breaking rename selected
by the user. Existing target projects must migrate their installation before
using the new command; the implementation will not silently write new state
into both directories.

Historical planning records under `docs/superpowers/` may retain the old name
when it describes the historical repository state. Active runtime code,
shipped templates, current tests, and public operational documentation must
use the new identity. Any remaining old-name occurrence must be an explicit
historical or migration note, not an accidental product reference.

## Architecture diagram

Add this canonical diagram to `LOOP_SYSTEM_DESIGN.md` in a fenced `text` block,
with a short link or reference from `README.md`. Keep the diagram dependency-
free and readable in terminals, Markdown renderers, and copied target projects.

```text
                         FORGELOOP
                             │
              ┌──────────────┼──────────────┐
              │              │              │
           ROUTING        STATE         EVIDENCE
              │              │              │
              ▼              ▼              ▼
        deterministic    checkpoint    observable
          decisions        facts         claims
              │              │              │
              │        ┌─────┴─────┐       │
              │        │           │       │
              │    repository   contract   │
              │        │           │       │
              │        └─────┬─────┘       │
              │              │              │
              │          freshness          │
              │              │              │
              └────────┬─────┴─────┬────────┘
                       │           │
                       ▼           ▼
                 CONFORMANCE   DELEGATION
                       │           │
                       └─────┬─────┘
                             ▼
                   VALID / STALE / INVALID
                             │
                             ▼
                     compatible harness
```

The diagram is explanatory documentation, not an executable graph or a new
runtime contract. Its labels must stay aligned with the existing protocol
statuses and architecture boundaries.

## Implementation boundaries

1. **Package and CLI identity:** update `package.json`, package metadata, usage
   text, package tests, and README command examples from `mdfiles` to
   `@cassiomc1/forgeloop` and `forgeloop`.
2. **Installed target paths:** update template paths, manifest/state constants,
   commands, safe-path checks, fixtures, and tests from `.mdfiles` to
   `.forgeloop`.
3. **Active documentation:** update the product name, command examples, path
   examples, badges, links, architecture references, terminology, and
   compatibility statements in shipped/public documents.
4. **Schemas and protocol:** keep schema field names, schema version, protocol
   version, status vocabulary, and serialized artifact semantics unchanged
   except for documented path/name examples.
5. **Historical records:** do not rewrite old design/plan records solely to
   erase historical `mdfiles` references; record the exception in the active
   terminology/migration documentation if needed.
6. **Remote boundary:** do not rename the GitHub repository, push, open a PR,
   merge, or publish the new npm package in this implementation task. The
   current remote URL remains operational evidence until separately changed.

## Migration behavior

The rename is breaking at the active package and target-path boundary. The
documentation will state the manual migration sequence:

```bash
mv .mdfiles .forgeloop
npx @cassiomc1/forgeloop update
```

The CLI must reject or report missing new-path state using its existing safe
and explicit health output. It must not recursively delete `.mdfiles`, merge
two manifests, or overwrite a local target file during migration.

## Verification contract

- `npm test` passes with updated package, CLI, target-path, fixture, and
  documentation assertions.
- `npm run pack:check` confirms the renamed package ships `.forgeloop/.gitignore`
  and excludes local `.forgeloop/work-state.json`.
- The Markdown, universal-loop, workflow-policy, and secret validators pass.
- A repository-wide search confirms that active runtime and shipped public
  references use `ForgeLoop`/`forgeloop`/`.forgeloop`, with only documented
  historical or migration exceptions.
- `schemas/*.schema.json` preserve their current protocol metadata and fields.
- The architecture diagram appears in the canonical design document and is
  included in the installed template set through the existing template path.

## Non-goals

- No graph runtime, scheduler, provider, or agent implementation.
- No protocol-version or schema-version migration.
- No automatic migration of arbitrary user projects.
- No GitHub repository rename or npm publication.
