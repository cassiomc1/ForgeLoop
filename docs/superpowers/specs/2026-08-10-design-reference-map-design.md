# Design reference map integration

## Status

Approved direction; implementation pending repository-owner review of this specification.

## Context

The repository's canonical design guide already defines visual quality, motion,
accessibility, performance, canvas/WebGL, and provenance expectations. The nine
design-focused sites supplied by the user should become useful research inputs
without becoming an unmanaged dependency list or implying that a catalog's
terms transfer the rights of its contributors.

The integration is documentation-only. It will not copy source code, images,
fonts, templates, or assets; install packages; or change application behavior.

## Goals

1. Explain what each site provides and when it is useful during design work.
2. Make the references discoverable from the canonical English design guide.
3. Record provenance and licensing boundaries in the repository's third-party
   notices.
4. Preserve the existing design system, accessibility contract, and
   performance budgets as the source of project-specific decisions.
5. Keep the change small enough that future reference updates remain easy to
   audit.

## Non-goals

- Adding a new runtime dependency or UI framework.
- Declaring every component, font, example, or asset on a referenced site safe
  to copy or redistribute.
- Treating a gallery or catalog as a substitute for the original author's
  license, documentation, or attribution requirements.
- Selecting a visual style for the project or requiring every project to use
  every referenced library.
- Publishing, pushing, opening a pull request, or merging this documentation
  change.

## Proposed integration

### 1. Canonical design guide

Update `ENG/design-code-eng.md` with a compact reference map near the existing
component, motion, and creative-coding guidance. Each entry will contain four
pieces of information:

- what the site provides;
- the design task it is appropriate for;
- the implementation or UX guardrail that applies; and
- the provenance/licensing check required before reuse.

The sites will be grouped as follows:

| Group | References | Intended use |
| --- | --- | --- |
| Component source and interaction inspiration | [21st.dev](https://21st.dev/), [React Bits](https://reactbits.dev/), [Fancy Components](https://www.fancycomponents.dev/), [Motion Primitives](https://motion-primitives.com/) | Explore React components, animated patterns, microinteractions, registries, and implementation ideas. Adapt only after checking the specific source, license, dependency, and maintenance status. |
| Component and design-system research | [Component Gallery](https://component.gallery/) | Compare component anatomy, states, variants, semantics, accessibility guidance, and design-system conventions. Treat the catalog as research, not as a blanket code license. |
| Numeric feedback | [NumberFlow](https://number-flow.barvian.me/) | Animate changing metrics, counters, prices, and status values when the transition adds comprehension. Preserve locale formatting, motion preferences, and static behavior. |
| Pointer enhancement | [Cursify](https://cursify.ui-layouts.com/) | Prototype cursor followers, trails, magnetic effects, and pointer-reactive decoration for pointer-capable devices. Never make cursor behavior essential to meaning or navigation. |
| Typography discovery | [UNCUT](https://uncut.wtf/) | Discover contemporary typefaces and investigate possible typographic direction. Verify each font's author, original license, weights, file provenance, and hosting rights independently. |
| Creative coding and WebGL | [cables.gl](https://cables.gl/) | Prototype real-time visual systems, shader/3D ideas, interactive scenes, and export/embed possibilities. Keep semantic HTML, an opaque fallback, pause/offscreen behavior, and a measurable performance budget. |

Cross-cutting rules will make the map actionable:

- Choose references by the product problem; do not combine libraries merely
  because their demos are visually impressive.
- Preserve the project's tokens, type scale, semantic structure, and content
  hierarchy when adapting an example.
- Treat cursor, canvas, 3D, sound, and decorative motion as progressive
  enhancement. Essential information and task completion must work without
  them.
- Check keyboard access, focus visibility, contrast, touch/coarse pointers,
  `prefers-reduced-motion`, pause/stop controls, bundle cost, and runtime
  performance before accepting an adaptation.
- Verify the current terms for the exact component, author, font, asset,
  dependency, and distribution method. A site's free, open-source, or catalog
  description is not evidence that every underlying item has the same terms.

Specific guidance will include the following constraints:

- **21st.dev, React Bits, Fancy Components, and Motion Primitives:** use as
  source and interaction references; inspect copied source and transitive
  dependencies; distinguish free material from separate premium offerings;
  avoid importing multiple overlapping motion systems without a reason.
- **Component Gallery:** compare component states and accessibility patterns;
  follow the original design system's documentation and license rather than
  assuming the gallery owns the examples.
- **NumberFlow:** reserve animated numbers for changing values; use locale-aware
  formatting; respect reduced motion or provide a static mode; account for the
  documented locale/digit limitations and avoid unnecessary `will-change`.
- **Cursify:** limit cursor effects to pointer-capable contexts; disable or
  simplify them for touch and reduced-motion users; keep mouse tracking from
  affecting task performance.
- **UNCUT:** use for discovery only; record the exact font source, author,
  license, weights, and fallback before adding a font; use a resilient loading
  strategy such as `font-display: swap`.
- **cables.gl:** use for creative-coding prototypes or justified WebGL
  enhancement; preserve a semantic/fallback path, pause work outside the
  viewport where appropriate, and validate exported operators and assets.

The guide front matter will be reviewed with the repository validator. Because
the map adds normative guardrails, the design guide is expected to move its
`last-reviewed` date to `2026-08-10` and its version from `2026.08` to
`2026.09`, provided the existing versioning rule confirms that interpretation.

### 2. Third-party notices

Add a grouped section to `THIRD_PARTY_NOTICES.md` covering all nine sites. The
section will identify each site's role in this documentation collection and
state that:

- the site is a reference source, not a project dependency unless separately
  approved and recorded;
- site, author, component, font, asset, dependency, and premium-content terms
  remain separate and authoritative;
- no license, endorsement, attribution, or redistribution right is inferred
  by listing a URL here; and
- exact provenance and current terms must be checked before reuse.

The notices will be especially explicit that component catalogs aggregate
third-party work, free/open-source claims do not automatically cover premium
material or dependencies, and a font catalog does not itself grant font
hosting rights.

## Files and boundaries

Expected implementation files:

- `ENG/design-code-eng.md`
- `THIRD_PARTY_NOTICES.md`

This specification is the only additional file. No README, package manifest,
lockfile, source code, asset directory, or dependency configuration should
change unless verification reveals an existing repository rule that requires a
metadata update.

## Verification and acceptance criteria

The implementation is acceptable when:

1. All nine URLs are present as working Markdown links in the canonical design
   guide and are represented in the third-party notices.
2. Each entry states both a useful design application and a concrete guardrail.
3. The text avoids dynamic counts, unverified blanket licensing claims,
   endorsements, and assumptions that premium content is free.
4. The guide remains English-only and consistent with its existing motion,
   accessibility, performance, and canvas/WebGL contracts.
5. Markdown formatting, repository loop/profile validation, secret scanning,
   and link checks are run where available; unavailable tools are reported
   rather than silently substituted.
6. `git diff --check` passes and no unrelated files change.
7. The final publication state is explicitly reported; this task does not
   publish or merge unless separately requested.
