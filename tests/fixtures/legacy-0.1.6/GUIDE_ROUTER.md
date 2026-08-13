# Guide Router

> Select technical context for [Loop Engineering](./LOOP_ENGINEERING.md). This file decides **which** guides to consult; each guide defines **how** to work in its domain.

## Selection contract

1. Read the request, the nearest repository instructions, and [PROJECT_PROFILE.md](./PROJECT_PROFILE.md).
2. Confirm the actual stack from manifests and configuration.
3. Identify the surfaces that will change.
4. Activate the primary guide and every complementary guide required by the risks.
5. Locate relevant headings and keywords before loading a long guide.
6. Load only the sections needed for the current task.
7. Reassess the route if the scope changes during execution.

Activate a guide from a combination of intent, files, and risk. A word in documentation, a lockfile, or an example does not by itself prove a stack or activate a guide.

Useful questions:

- What behavior or artifact will change?
- Is there a human interface, sensitive data, critical path, or external system?
- Which files will change?
- Which checks will demonstrate the result?
- Did the user explicitly request a standard or domain?

## Canonical catalog

Guide frontmatter may declare protocol metadata in addition to its human
description:

```yaml
guide-id: premium
requires-gates:
  - design
completion-evidence:
  - build
```

`requires-gates` contributes to `forgeloop preflight`; each
`completion-evidence` identifier contributes to completion coverage. Metadata
is descriptive and local: it does not authorize tools, remote services, or
project commands.

| ID | Guide | Responsibility |
| --- | --- | --- |
| `premium` | [Premium websites](./ENG/premium-sites-studio-eng.md) | End-to-end delivery of high-quality websites and web experiences |
| `clean` | [Clean code](./ENG/clean-code-eng.md) | Structure, readability, observability, and maintenance |
| `test` | [Testing](./ENG/test-code-eng.md) | Risk-driven verification strategy and tooling |
| `security` | [Security](./ENG/sec-code-eng.md) | Web, API, mobile, desktop, data, and supply-chain security |
| `design` | [Design](./ENG/design-code-eng.md) | Visual direction, UX, motion, and perceived performance |
| `performance` | [Performance](./ENG/perf-code-eng.md) | Measurement, diagnosis, budgets, and optimization |
| `accessibility` | [Accessibility](./ENG/accessibility-eng.md) | WCAG, keyboard access, focus, semantics, and assistive technology |
| `games` | [Web games](./ENG/games-code-design-web-eng.md) | Architecture and operation of 2D, 3D, and procedural web games |

## Domain rules

### `clean` — code and structure

**Activate when:** creating or modifying code, fixing a bug, refactoring, changing architecture, reviewing quality, or producing development instructions.

**Do not activate merely because:** documentation contains code snippets but no software behavior changes.

**Usually combine with:** `test`; add `security`, `performance`, `design`, or `accessibility` according to the affected surface.

Locate relevant sections first:

```bash
rg -n '^## (Style|Comments|Tests|Dependencies|Structure|Logging|Debugging)|responsibility|typing|errors' ENG/clean-code-eng.md
```

**Expected evidence:** a small readable diff, coherent interfaces, error handling, tests, and official checks.

### `test` — verification strategy

**Activate when:** behavior changes, a bug is fixed, an integration or release changes, executable configuration changes, or QA is requested.

**Do not activate merely because:** prose names a testing framework without executing or changing software.

**Usually combine with:** every guide that produces behavior; use the domain to choose test levels.

```bash
rg -n '^## |risk|regression|unit|integration|E2E|accessibility|load|CI' ENG/test-code-eng.md
```

**Expected evidence:** a RED reproduction when applicable, a GREEN targeted check, and proportional regression coverage.

### `security` — trust and external surfaces

**Activate when:** authentication, authorization, untrusted input, APIs, databases, uploads, secrets, dependencies, CI/CD, mobile or desktop platforms, cryptography, personal data, payments, or publication are involved.

**Do not activate merely because:** a reference mentions OWASP or security without changing a trust surface.

**Usually combine with:** `clean` and `test`; add `performance` when controls affect latency or availability.

```bash
rg -n '^## |authentication|authorization|upload|SSRF|CSP|OAuth|JWT|secrets|supply chain|mobile|desktop' ENG/sec-code-eng.md
```

**Expected evidence:** explicit trust boundaries, server-side validation, least privilege, no secrets in Git, and negative tests.

### `performance` — measurable cost

**Activate when:** the request involves latency, scale, a critical path, rendering, bundles, databases, networking, memory, battery, load, Web Vitals, FPS, or a budget.

**Do not activate merely because:** every task could theoretically be faster. Avoid speculative optimization without a risk or metric.

**Usually combine with:** the main domain guide and `test`.

```bash
rg -n '^## |baseline|budget|p75|p95|Web Vitals|profil|database|mobile|desktop|load' ENG/perf-code-eng.md
```

**Expected evidence:** a baseline, a hypothesis, comparable before-and-after measurement, and no functional regression.

### `design` — interface and experience

**Activate when:** creating, redesigning, or reviewing UI, layout, components, visual identity, motion, responsive behavior, mobile or desktop apps, or premium experiences.

**Do not activate merely because:** an interface-free API uses the word "design" in architecture documentation.

**Usually combine with:** `accessibility`, `test`, and `performance`; use `security` for forms, authentication, and external content.

```bash
rg -n '^## |palette|typography|layout|mobile|motion|components|checklist' ENG/design-code-eng.md
```

**Expected evidence:** complete states, coherent hierarchy, responsive behavior, visual validation, and fallbacks for optional enhancements.

### `accessibility` — inclusive completion

**Activate when:** work affects an interface, audiovisual content, navigation, forms, interactive components, games, mobile or desktop apps, or task completion.

**Do not activate merely because:** an internal service transports normalized data and changes neither user-facing content nor a consumed contract.

**Usually combine with:** `design` and `test`; add the interface domain guide.

```bash
rg -n '^## |WCAG|keyboard|focus|contrast|ARIA|screen reader|motion|Definition of Done' ENG/accessibility-eng.md
```

**Expected evidence:** semantics, keyboard operation, focus, contrast, zoom and reflow, reduced motion, and compatible manual or automated tests.

### `premium` — complete website production

**Activate when:** creating or comprehensively reviewing a landing page, institutional site, portfolio, campaign, or web experience that requires studio-quality delivery.

**Do not activate when:** the task is an isolated component, an API, or technical maintenance without a complete website process.

**Usually combine with:** `design`, `accessibility`, `clean`, `test`, `security`, and `performance`.

```bash
rg -n '^## [0-9]+\.|brief|content|direction|design system|implementation|quality|launch' ENG/premium-sites-studio-eng.md
```

**Expected evidence:** approved strategy, content, direction, production, quality, launch, and operation gates.

### `games` — web game architecture and operation

**Activate when:** designing, implementing, testing, or operating a 2D or 3D web game, procedural generation, game loops, assets, input, multiplayer, or game distribution.

**Do not activate when:** "game" means lightweight gamification in an ordinary interface; use the UI and code guides instead.

**Usually combine with:** `clean`, `test`, `security`, `performance`, and `accessibility`; add `design` for UI and visual direction.

```bash
rg -n '^## |game loop|procedural|input|assets|audio|multiplayer|WASM|PWA|CI/CD' ENG/games-code-design-web-eng.md
```

**Expected evidence:** verifiable simulation, determinism when promised, capability fallbacks, budgets, accessibility, and release gates.

## Work-type matrix

| Work | Primary guide | Common complements | Exclude when |
| --- | --- | --- | --- |
| Documentation change | Relevant domain | `test` only for executable examples or commands | No software behavior exists |
| Code or bug without UI | `clean` | `test`; risk may add `security` or `performance` | The surface is unchanged |
| Backend, API, or data | `clean` | `test`, `security`; `performance` for a critical path | That layer does not exist |
| Web, mobile, or desktop UI | `design` | `accessibility`, `clean`, `test`; risk defines the rest | Users cannot observe the change |
| Complete website | `premium` | `design`, `accessibility`, `clean`, `test`, `security`, `performance` | The deliverable is not a complete site |
| Web game | `games` | `clean`, `test`, `security`, `performance`, `accessibility`; `design` with UI | The product is not a game |
| HTML video or motion | `design` | `accessibility`, `performance`, `test`, `security` | There is no audiovisual composition |
| Infrastructure or CI/CD | `security` | `test`; `performance` when availability or cost changes | The change is non-executable prose |

HyperFrames is optional and may be used only when requested or already available and appropriate. A reference to it does not authorize installation.

## Deterministic route contract

The active agent may classify natural language, but it must pass declared
signals to the deterministic evaluator in `src/core/router.js`. The evaluator
does not parse natural language, call a model, or infer a stack from a word in
the repository.

The first routing contract is versioned as `schemaVersion: 1`. It accepts:

- `workType`: `documentation`, `code`, `bug`, `refactor`, `backend`, `api`,
  `api-auth`, `complete-website`, `mobile-ui`, `web-game`, `html-video`,
  `infrastructure`, `security-review`, `performance`, `accessibility`,
  `test-only`, `dependency-update`, or `release`;
- `surfaces`: `ui`, `forms`, `api`, `auth`, `data`, `database`, `mobile`,
  `desktop`, `game`, `video`, `ci`, `config`, or `critical-path`;
- `risks`: `untrusted-input`, `personal-data`, `secrets`, `external-service`,
  `publication`, `critical-path`, `performance`, or `accessibility`;
- `platforms`: `web`, `mobile`, `desktop`, `server`, `ci`, or
  `cross-platform`;
- optional boolean `behaviorChange` and `executableChange` signals.

Rule precedence is deterministic: the work type establishes the primary
closure; affected surfaces add mandatory complements; risks add security,
performance, or accessibility; executable/behavior changes add clean and
test; required rules win over optional exclusions; and the evaluator preserves
canonical insertion order. Unknown or duplicate signals fail with a routing
error.

Every selected guide has stable reason codes such as
`WORK_COMPLETE_WEBSITE`, `SURFACE_UI`, `RISK_UNTRUSTED_INPUT`, and
`CHANGE_EXECUTABLE_CONFIG`. Exclusions use stable codes such as
`NO_TRUST_BOUNDARY` and `NO_MEASURABLE_PERFORMANCE_RISK`. Documentation-only
input records `DOCUMENTATION_DOMAIN_GUIDE_REQUIRED` instead of activating
technical guides automatically.

Platform signals are contextual, not automatic guide activators:

| Platform | Semantic effect | Stable reason |
| --- | --- | --- |
| `mobile` | With an existing UI surface, reinforces design/accessibility and adds performance constraints. | `PLATFORM_MOBILE` |
| `desktop` | With an existing UI surface, reinforces design/accessibility. | `PLATFORM_DESKTOP` |
| `server` | With `auth`, reinforces the trust boundary and adds testing. | `PLATFORM_SERVER` |
| `ci` | With `executableChange: true`, adds security to the existing change checks. | `PLATFORM_CI` |
| `web` | Informational-only; surface and risk signals remain authoritative. | — |
| `cross-platform` | Informational-only; it never selects a guide by itself. | — |

Equivalent normalized signal arrays produce identical JSON. A valid route has
no duplicate guides, a reason for every selected guide, an exclusion reason
for every excluded guide, no selected/excluded overlap, and a primary that is
either null or selected. The local `validate-protocol` command checks
cross-artifact relationships without executing task data.

Negative routing guarantees:

- a documentation mention of OAuth does not activate `security`;
- a backend refactor does not activate `design` or `accessibility`;
- static UI copy does not activate `security` without a trust-boundary signal;
- a package file alone does not prove that Node is an affected task surface;
- an explicit executable-change signal adds `clean` and `test` even when the
  semantic work type is documentation.

## Verifiable scenarios

Route comments are stable contracts for the validator. They contain IDs, not loading instructions.

### Premium landing page

<!-- route:landing-page-premium=premium,design,accessibility,clean,test,security,performance -->

Verify the brief, content, responsive UI, states, WCAG coverage, build, tests, Web Vitals, forms, analytics, launch, and operation.

### Authenticated API

<!-- route:api-auth=clean,test,security,performance -->

Verify HTTP contracts, input validation, authentication and authorization, negative tests, persistence, rate limiting, observability, and critical-path latency.

### Bug without UI

<!-- route:bug-without-ui=clean,test -->

Start with reproduction and a regression test. Activate `security` or `performance` only if the cause or fix reaches those surfaces.

### Mobile app with UI

<!-- route:app-mobile-ui=clean,test,design,accessibility,security,performance -->

Verify the actual native or cross-platform target, states, gestures, keyboard and focus behavior, accessibility, storage, networking, battery, memory, and tests on a compatible target.

### Multiplayer web game

<!-- route:game-web-multiplayer=games,clean,test,security,performance,accessibility,design -->

Verify the game loop, authoritative server, reconciliation, input, assets, fallbacks, budgets, accessibility, security, and release process.

### Documentation

<!-- route:documentation=domain -->

`domain` means the single domain guide implicated by the change. Verify Markdown, links, paths, commands, and examples.

## Route changes

If investigation reveals a new surface, update the guide set before editing that area. Record only the concise reason; do not create a versioned task log.

If an applicable guide is missing or inaccessible, use conservative defaults, do not invent its content, and disclose the limitation in the delivery.
