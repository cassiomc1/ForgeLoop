# Documentation diagrams

The ForgeLoop architecture flow is authored as typed Archify workflow IR in
[`forgeloop-engineering-flow.workflow.json`](./forgeloop-engineering-flow.workflow.json).
The checked-in outputs are generated from that source with the pinned Archify
v2.15.0 toolchain:

- [interactive HTML explorer](../assets/diagrams/forgeloop-engineering-flow.html)
- [dark-first static SVG](../assets/diagrams/forgeloop-engineering-flow.svg)
- [deterministic generation receipt](../assets/diagrams/forgeloop-engineering-flow.receipt.json)

The JSON IR is the source of truth. Do not edit the generated HTML or SVG by
hand. Run `npm run docs:diagrams` to regenerate the outputs and
`npm run docs:diagrams:check` to validate the pinned renderer, source semantics,
artifact fingerprints, and GitHub-safe SVG constraints.

The HTML view opens in Archify's dark presentation stage so the official flow
is visible without scrolling; its Present control returns to the full reader
layout. It also supports the Archify theme control and reduced-motion behavior.
The static SVG intentionally defaults to the dark presentation so it remains
legible in repository previews; the adjacent text fallback in
[`README.md`](../../README.md#architecture-flow) carries the same lifecycle
semantics for text-only readers.

Archify is vendored at `vendor/archify/v2.15.0/archify` under its MIT license.
The exact source commit and generated-file hashes are recorded in the receipt.
