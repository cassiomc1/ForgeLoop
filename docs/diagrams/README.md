# Documentation diagrams

The ForgeLoop architecture flow is authored as typed Archify workflow IR in
[`forgeloop-engineering-flow.workflow.json`](./forgeloop-engineering-flow.workflow.json).
The checked-in outputs are generated from that source with the pinned Archify
v2.15.0 toolchain. The animated interactive explorer is the primary experience:

- [animated HTML explorer](../assets/diagrams/forgeloop-engineering-flow.html)
- [animated, self-contained SVG fallback](../assets/diagrams/forgeloop-engineering-flow.svg)
- [deterministic generation receipt](../assets/diagrams/forgeloop-engineering-flow.receipt.json)

The canonical source sets `meta.animation` to `trace`, so the explorer and SVG
trace the workflow edges and nodes. Use the explorer's Present, playback, and
focus controls for the full animated experience; the SVG remains available for
repository previews and text-only fallbacks.

[`manifest.json`](./manifest.json) is the governance source for diagram types,
renderer support, canonical purposes, artifact ownership, and required
references. The persistent human approval is kept separately in
[`reviews/forgeloop-engineering-flow.review.json`](./reviews/forgeloop-engineering-flow.review.json).

The JSON IR is the source of truth. Do not edit the generated HTML or SVG by
hand. Run `npm run docs:diagrams` to regenerate the outputs and
`npm run docs:diagrams:check` to validate the pinned renderer, source semantics,
animation markers, artifact fingerprints, persistent review binding, manifest
ownership, and GitHub-safe SVG constraints.

The HTML view opens in Archify's dark presentation stage so the official flow
is visible without scrolling; its Present and playback controls expose the
animated trace, while reduced-motion preferences remain respected. The SVG
fallback also carries the trace-capable styles and intentionally defaults to the
dark presentation so it remains legible in repository previews; the adjacent text fallback in
[`README.md`](../../README.md#architecture-flow) carries the same lifecycle
semantics for text-only readers.

Archify is vendored at `vendor/archify/v2.15.0/archify` under its MIT license.
The exact source commit and cryptographic vendor-tree hash are recorded in
`vendor/archify/v2.15.0/PIN.json`; generated-file hashes are recorded in the
receipt and the visual approval binds the current source and SVG fingerprints.

The ForgeLoop Archify wrapper is intentionally documentation-scoped. It reads
canonical inputs only from `docs/diagrams/` and permits deliver outputs only
under `docs/assets/diagrams/`.

ForgeLoop governs five documentation-diagram categories: workflow,
architecture, sequence, dataflow, and lifecycle. The current repository has
one canonical workflow diagram. Governance support does not imply renderer
support: a type requires an explicit renderer mapping before it can be added as
an active diagram.
