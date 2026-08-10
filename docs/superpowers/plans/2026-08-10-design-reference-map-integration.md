# Design reference map integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an actionable, provenance-aware map of nine design reference sites to the canonical design documentation without adding dependencies or copying external material.

**Architecture:** Keep `ENG/design-code-eng.md` as the usage-oriented source of truth and `THIRD_PARTY_NOTICES.md` as the rights/provenance boundary. Synchronize the repository's global guide metadata contract because the validator requires every English guide to share one version and review date; change no other guide content.

**Tech Stack:** English Markdown; Python 3 standard-library repository validators; Node.js 20+ test runner; existing Markdown lint and Lychee checks when locally available.

## Global Constraints

- Do not copy source code, images, fonts, templates, or assets from the referenced sites.
- Do not install packages, add runtime dependencies, or change application behavior.
- Keep the repository's root and `ENG/` documentation English-only.
- Document all nine supplied URLs and distinguish catalogs, authors, components, fonts, assets, dependencies, and premium content.
- Preserve semantic HTML, keyboard/focus access, contrast, reduced-motion, touch/coarse-pointer, fallback, and performance requirements.
- Treat every external license and current term as specific to the exact resource; a catalog listing does not transfer rights.
- Use `2026.09` and `2026-08-10` for the synchronized guide version and `last-reviewed` metadata.
- Do not push, open a pull request, or merge this task unless separately requested.
- Report unavailable local tools or unstable external link checks instead of weakening validation or silently downloading tools.

---

## File map

- Modify `ENG/design-code-eng.md`: add the reference map, source links, usage guidance, and design guardrails.
- Modify all eight `ENG/*.md` front matters: synchronize only `version` and `last-reviewed` because the repository validator applies those values globally.
- Modify `scripts/validate_loop_system.py`: update the authoritative `GUIDE_VERSION` and `GUIDE_LAST_REVIEWED` constants used by both structural validators.
- Modify `THIRD_PARTY_NOTICES.md`: record the nine reference sites and their non-transfer-of-rights boundaries.
- Do not modify `README.md`, `package.json`, lockfiles, source code, assets, or workflow configuration.

### Task 1: Synchronize the guide metadata contract

**Files:**

- Modify: `scripts/validate_loop_system.py:71-72`
- Modify: `ENG/accessibility-eng.md` front matter
- Modify: `ENG/clean-code-eng.md` front matter
- Modify: `ENG/design-code-eng.md` front matter
- Modify: `ENG/games-code-design-web-eng.md` front matter
- Modify: `ENG/perf-code-eng.md` front matter
- Modify: `ENG/premium-sites-studio-eng.md` front matter
- Modify: `ENG/sec-code-eng.md` front matter
- Modify: `ENG/test-code-eng.md` front matter

**Interfaces:**

- Consumes: the approved specification and the validator's single-version/single-date contract.
- Produces: `GUIDE_VERSION == "2026.09"` and `GUIDE_LAST_REVIEWED == "2026-08-10"`, with identical quoted values in all eight English guide front matters.

- [ ] **Step 1: Confirm the metadata surface**

  Run:

  ```bash
  rg -n '^(version|last-reviewed):' ENG/*.md scripts/validate_loop_system.py
  ```

  Expected: eight guides and the two validator constants report the current `2026.08` / `2026-08-08` pair before the edit.

- [ ] **Step 2: Update the authoritative constants**

  Change only these values in `scripts/validate_loop_system.py`:

  ```python
  GUIDE_VERSION = "2026.09"
  GUIDE_LAST_REVIEWED = "2026-08-10"
  ```

- [ ] **Step 3: Synchronize all eight guide front matters**

  In each listed `ENG/*.md`, change only:

  ```yaml
  version: "2026.09"
  last-reviewed: "2026-08-10"
  ```

- [ ] **Step 4: Verify the metadata contract**

  Run:

  ```bash
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  ```

  Expected: both commands exit 0; the repository validator reports eight validated guides.

- [ ] **Step 5: Commit the metadata-only change**

  ```bash
  git add scripts/validate_loop_system.py ENG/*.md
  git commit -m "docs: synchronize guide metadata"
  ```

### Task 2: Add the design reference map

**Files:**

- Modify: `ENG/design-code-eng.md:299-310` near `UI libraries and data visualization`
- Modify: `ENG/design-code-eng.md:468-490` in `Sources and References (Base Skills)`

**Interfaces:**

- Consumes: the metadata contract from Task 1 and the existing motion, accessibility, performance, canvas/WebGL, typography, and component guidance.
- Produces: one compact map that links all nine sites and states a use case plus a concrete guardrail for each group/source.

- [ ] **Step 1: Add the grouped external-reference section**

  Insert a section after the existing UI libraries/data visualization bullets and before `## UX, Accessibility, and Quality`. Use these groups and links:

  - Component source and interaction inspiration: `https://21st.dev/`, `https://reactbits.dev/`, `https://www.fancycomponents.dev/`, `https://motion-primitives.com/`.
  - Component and design-system research: `https://component.gallery/`.
  - Numeric feedback: `https://number-flow.barvian.me/`.
  - Pointer enhancement: `https://cursify.ui-layouts.com/`.
  - Typography discovery: `https://uncut.wtf/`.
  - Creative coding and WebGL: `https://cables.gl/`.

- [ ] **Step 2: Add the cross-cutting guardrails**

  State that references are selected for a product problem, do not override project tokens or semantics, and must be checked for keyboard/focus access, contrast, reduced motion, touch, bundle/runtime cost, and fallback behavior. State that cursor, canvas, 3D, audio, and decorative motion are progressive enhancement only.

- [ ] **Step 3: Add source-specific guidance**

  Include the approved constraints: inspect source/dependencies and separate free from premium material for component sites; use Component Gallery for comparison rather than license assumptions; reserve NumberFlow for changing metrics with locale-aware formatting and static/reduced-motion behavior; restrict Cursify to pointer-capable enhancement; verify each UNCUT font's author/license/weights/hosting rights; and require semantic fallback, pause/offscreen behavior, performance budget, and asset/operator provenance for cables.gl.

- [ ] **Step 4: Add the nine source links to the existing references list**

  Group the links by category instead of adding dynamic counts or claims about current catalog size. Keep the existing Gradient Studio and other references intact.

- [ ] **Step 5: Verify the guide content**

  Run:

  ```bash
  rg -n 'https://(21st\.dev|reactbits\.dev|www\.fancycomponents\.dev|motion-primitives\.com|component\.gallery|number-flow\.barvian\.me|cursify\.ui-layouts\.com|uncut\.wtf|cables\.gl)' ENG/design-code-eng.md
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  git diff --check
  ```

  Expected: every supplied URL appears in the guide, both Markdown validator commands exit 0, and `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Commit the guide integration**

  ```bash
  git add ENG/design-code-eng.md
  git commit -m "docs: map design reference sites"
  ```

### Task 3: Record provenance and rights boundaries

**Files:**

- Modify: `THIRD_PARTY_NOTICES.md` after the existing identified-source entries

**Interfaces:**

- Consumes: the nine URLs and guardrails added in Task 2.
- Produces: a grouped notice section that explains each site's role and explicitly preserves the terms of the site, author, component, font, asset, dependency, and premium content.

- [ ] **Step 1: Add the grouped design-reference notice section**

  Add one heading for the nine sites with concise bullets or subsections covering:

  - 21st.dev: community components, registries, authors, templates, and any premium material remain separately governed.
  - React Bits: distinguish the public/free material from React Bits Pro and inspect each source/dependency license.
  - Fancy Components: retain the site's current claim for its own material without relicensing Motion, Tailwind, shadcn, or other dependencies.
  - Motion Primitives: distinguish documented open-source material from the separate Pro offering and verify component/dependency terms.
  - Component Gallery: treat it as a comparison catalog; the original design systems and examples retain their own terms.
  - NumberFlow: record the upstream project as a software reference and verify its current repository license and dependency terms before adoption.
  - Cursify: verify the current component/source terms and any underlying UI-layouts or Motion dependencies.
  - UNCUT: a catalog listing is not a font license; verify the exact creator, source, weights, and hosting/redistribution rights.
  - cables.gl: verify the tool, exported patches/operators, code, and third-party assets independently before distribution.

  End the section with the collection-wide rule that URL inclusion does not imply endorsement, affiliation, license transfer, or redistribution permission.

- [ ] **Step 2: Verify notices and secret hygiene**

  Run:

  ```bash
  rg -n '21st\.dev|reactbits\.dev|fancycomponents\.dev|motion-primitives\.com|component\.gallery|number-flow\.barvian\.me|cursify\.ui-layouts\.com|uncut\.wtf|cables\.gl' THIRD_PARTY_NOTICES.md
  python3 scripts/scan_secrets.py
  git diff --check
  ```

  Expected: all nine references are present, the secret scan exits 0, and no whitespace errors are reported.

- [ ] **Step 3: Commit the notices**

  ```bash
  git add THIRD_PARTY_NOTICES.md
  git commit -m "docs: record design reference provenance"
  ```

### Task 4: Run the repository regression gates and inspect scope

**Files:**

- Test: existing repository validators, unit tests, package checks, and available Markdown/link tools

**Interfaces:**

- Consumes: the three committed documentation changes.
- Produces: evidence that structure, links, secret scanning, tests, and package behavior remain valid, plus an explicit report for tools unavailable locally or links blocked by external service state.

- [ ] **Step 1: Run the exact repository Python checks**

  ```bash
  python3 -m unittest tests.test_validate_markdown -v
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 -m unittest tests.test_validate_loop_system -v
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  python3 -m unittest tests.test_scan_secrets -v
  python3 scripts/scan_secrets.py
  ```

  Expected: all commands exit 0 and the validators accept the synchronized eight-guide metadata.

- [ ] **Step 2: Run the Node/package regression checks**

  ```bash
  npm test
  npm run pack:check
  ```

  Expected: the Node test suite and package-content checks pass without package or lockfile changes.

- [ ] **Step 3: Run available Markdown and link tooling**

  ```bash
  command -v markdownlint-cli2
  command -v lychee
  ```

  If a command is available, run it using the repository configuration:

  ```bash
  markdownlint-cli2
  lychee --config .lychee.toml './**/*.md'
  ```

  If either tool is unavailable, report that fact; do not download it with `npx` or another installer without explicit authorization. If an external site returns a transient error, record the exact URL and status rather than declaring the link check green or weakening `.lychee.toml`.

- [ ] **Step 4: Inspect the final diff and publication state**

  ```bash
  git diff --check
  git status --short
  git diff --stat HEAD~3..HEAD
  git log -3 --oneline
  ```

  Expected: only the approved metadata, design-guide, and notice changes are present; no source, asset, dependency, or workflow files changed; the branch remains local and unpushed.
