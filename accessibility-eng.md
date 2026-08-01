# Accessibility as a Baseline (A11Y)

> Accessibility instructions adapted from the [A11Y.md](https://github.com/fecarrico/A11Y.md) project (Felipe A. Carriço, MIT license) — a validation protocol and persistent context system for building accessible software from the very first line of code, aligned with **WCAG 2.2 AA**, **ISO 9241-171**, **ADA**, and **EAA**.

> **Related documents**: for visual/UX direction (palettes, typography, motion), see `design-code-eng.md`. For automated testing tools (axe-core, Lighthouse, visual regression), see `test-code-eng.md`. For code quality/structure, see `clean-code-eng.md`. This file is the canonical reference for **accessibility rules** (WCAG, ARIA, keyboard, focus, screen readers) — it does not repeat the content of the others.

## 0. Principle Zero: accessibility as a pre-condition

- Accessibility is not a feature or an incremental improvement; it is a **pre-condition for use**.
- If a user cannot complete a task due to an accessibility barrier, the feature is considered **technically broken**.
- **Task completion** success is our primary quality metric.

## 0.1. Compliance profiles

This document defaults to **Standard (AA)** compliance. When generating or reviewing interface code, the agent **MUST ask** the user which compliance profile to apply if not already specified:

| Profile | Target | Contrast (text / UI) | Min font† | Min target | Use case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🛡️ Shield (AAA)** | WCAG AAA | 7:1 / 3:1 (SC 1.4.6, 1.4.11) | 14px† | 44×44px (SC 2.5.5) · 48×48px† advised | Regulated industries, healthcare, gov |
| **⚖️ Standard (AA)** | WCAG AA | 4.5:1 / 3:1 (SC 1.4.3, 1.4.11) | 12px† | 24×24px (SC 2.5.8) · 44×44px† advised | Default. Production apps, public web |
| **🚀 Launchpad (A)** | WCAG A | 3:1† (house floor) | 10px† | 24×24px† | MVPs, internal tools, prototypes |

*† = **House Rule**, non-normative: this standard's ergonomic policy where WCAG requires less — or nothing — at that level. WCAG defines no minimum font size at any level; Level A defines no contrast or target-size criteria; 44–48px targets come from Apple HIG / Material Design. Skipping a **WCAG SC** at your target level MUST be logged in `EXCEPTIONS.md`; relaxing a **House Rule** is a product decision — record it in `A11Y-DECISIONS.md`.*

*The Launchpad profile additionally requires explicit `EXCEPTIONS.md` documentation for each criterion relaxed below AA.*

> ⚠️ The **Launchpad (A)** profile does NOT relax CRITICAL rules (Section 1). Keyboard operability, focus management, and semantic HTML remain mandatory at ALL levels — these are Level A requirements.

## 1. Severity and impact model

Evaluate the impact of any design or implementation decision following these levels:

- 🔴 **CRITICAL:** **operation** failures. Blocks task completion or renders the function unusable (e.g., broken keyboard navigation, click on `div`/`span`, modal without focus management). **MUST FIX.**
- 🟠 **HIGH:** **perception and readability** failures. Significantly increases the error or abandonment rate (e.g., insufficient contrast, fonts < 12px in critical text, lack of dynamic feedback). **MUST FIX.**
- 🟡 **MEDIUM:** reduces **efficiency and satisfaction** (e.g., lack of optional keyboard shortcuts, lack of redundant labels). **SHOULD FIX.**
- 🔵 **LOW:** **cosmetic or polish** impact (e.g., micro-interactions without `aria-label`, improvements to focus indicators that are already visible). **MAY FIX.**

## 2. AI agent behavior contract

To ensure technical integrity, any AI interacting with the project **MUST**:

- **No inference:** never infer accessibility without direct evidence in the code or specification.
- **Reference APG:** prioritize patterns from the [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/).
- **Protocol for ambiguity:** follow the *Complex Component Protocol* (Section 5) in case of uncertainty.
- **Explain trade-offs:** explain impacts on Accessibility vs UX vs Business when suggesting changes.
- **UI component interrogation:** before adding `onClick` to non-semantic elements, **propose replacing them** with native elements or full ARIA patterns.
- **Framework adaptation:** examples use React/TSX syntax. On **web** frameworks, transpose patterns to the active project's framework while preserving semantic equivalence.
- **Platform awareness:** identify the target platform **before** applying any technical reference. The normative layer (Principle Zero, POUR, profiles, severity, governance) is platform-agnostic; the technical references are web-first. On native platforms (iOS, Android, React Native, Flutter), read web references as **semantic intent to translate — never implementation to copy**: no ARIA attributes or CSS pixels outside the web.
- **Component reuse:** before generating any interactive component, check for an existing implementation in the project or its design system and extend it. Generating a parallel implementation of an existing pattern is a violation.
- **Decision memory:** choices between equally conformant alternatives (e.g., `alertdialog` vs `dialog` for a destructive confirmation) MUST be recorded in `A11Y-DECISIONS.md` — indexed by pattern, never by screen — and reused in later turns.
- **Mode awareness:** when generating new code, apply all rules proactively. When reviewing existing code, identify violations, classify by severity (Section 1), and suggest targeted fixes — do not propose full rewrites unless the structural damage is CRITICAL. If an `EXCEPTIONS.md` exists, consult it: an entry there is a legitimate dispensation, but an entry past its expiry date MUST be flagged as 🟠 HIGH technical debt.

## 3. Technical standards (POUR framework)

### Perceivable

- **Contrast (SC 1.4.3, 1.4.11):** text **MUST** have 4.5:1; UI components and meaningful graphics **MUST** have 3:1. Prioritize real **luminance difference** (light vs dark) beyond hue.
- **Alt text (SC 1.1.1):** informative images **MUST** have a functional description in `alt`; decorative images use `alt=""` or `aria-hidden="true"`.
- **Semantic redundancy:** **MUST NOT** convey state using color alone. The use of **icon + text + color** (e.g., 🔴 Error) is the mandatory standard.
- **Visual patterns:** charts and dashboards **MUST** use textures or distinct line styles to ensure differentiation without color.

### Operable

- **Keyboard (SC 2.1.1):** 100% of functionalities **MUST** be operable without a mouse. Avoid purely pointer-based listeners without keyboard event equivalents (`onKeyDown`).
- **Focus (SC 2.4.7, 2.4.11):** focus **MUST** be visible, never entirely obscured by author content (e.g., sticky headers/footers), persistent, and never suppressed via CSS (`outline: none` without fallback is forbidden).
- **SPA routing:** after client-side routing changes, focus **MUST** be managed and properly reset (e.g., sending focus to the top or an `h1`). Avoid lost focus on the screen.
- **Targets (SC 2.5.8):** interactive elements MUST have a minimum size of **24×24 CSS pixels** — the WCAG 2.2 AA floor — except when an equivalent larger target exists, sufficient spacing prevents accidental activation, or the target sits inline in text.
  **House Rule†:** design to **44×44px** (48×48 under Shield), the ergonomic floor shared by Apple HIG and Material Design. Under Shield, 44×44 is normative (SC 2.5.5 AAA).
- **Motion (SC 2.3.3 AAA — enforced as a House Rule† at every profile):** **MUST** respect the CSS media query `@media (prefers-reduced-motion)`. Avoid heavy state animations during crucial transitions if the preference is active.

### Understandable

- **Labels (SC 1.3.1, 3.3.2):** forms **MUST** have explicit labels connected via `id`/`for`, or via tag wrapping. Avoid reinventions that break native browser events.
- **Predictability:** navigation behavior **MUST** be consistent and interactions must not cause unannounced sudden structural changes.
- **Dynamic feedback (SC 4.1.3):** dynamic events based on component state (such as toasts, loading, and AJAX/fetch form successes) **MUST** be actively announced through `aria-live` regions or modern equivalents (`role="status"`, `role="alert"`).

### Robust

- **Semantic HTML:** **MUST** prefer native (HTML5) elements over custom ones.
- **Interoperability:** the code **MUST** be compatible with current assistive technologies (ISO 9241-171).

## 4. Visual directives (strict UI criteria)

To ensure certification, these visual guidelines are non-negotiable:

- **Focus indicator (House Rule† — inspired by SC 2.4.13 AAA):** the focus ring **MUST** have a minimum thickness of 2px and a contrast of at least 3:1 against the background. (The AA floor: focus visible — SC 2.4.7 — and not entirely obscured by author content — SC 2.4.11.)
- **Typography (House Rule† — WCAG defines no minimum font size at any level):** text **MUST NOT** be smaller than the minimum font size of the active compliance profile (Section 0.1); 12px under the default Standard (AA).
  - *Density exception:* in complex dashboards or secondary metadata (badges), **min 10px** is allowed, provided the contrast is raised to **7:1** as mitigation — a trade-off defined by this standard's policy, not by WCAG — and the relaxation is documented in `EXCEPTIONS.md`.
- **Target spacing and hit area:** see *Section 3 — Targets* for the minimum size rule and exceptions. In dense UIs (e.g., tables), if the visual size is smaller than 44px, the **hit area** (invisible clickable area) **MUST** be expanded via CSS/padding. Adjacent targets **SHOULD** have 8px of spacing.

## 5. Complex component protocol

When identifying an unmapped or highly complex component (e.g., charts, dynamic grids):

1. **Identify:** look for a similar pattern in the [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/).
2. **Validate:** request human validation with a screen reader — the AI **MUST NOT** claim this test was performed, nor fabricate its results.
3. **Document:** document the expected behavior (keyboard and announcements).
4. **Scale:** record the resolved pattern in `A11Y-DECISIONS.md` so future components reuse it instead of re-deriving it.

## 6. Anti-patterns (Do NOT do this)

- **Clickable divs:** **MUST NOT** use `div` or `span` for click actions. Prefer native buttons. If forced to use them, manually replicate the behavior of a `<button>` (`role`, `tabindex="0"`, Enter and Space event listeners).
- **Leaked focus traps:** **MUST NOT** create modals without managing focus. When a modal is open:
  - focus MUST move into the modal;
  - focus MUST be trapped within the modal;
  - focus MUST return to the triggering element when closed;
  - background content MUST NOT be interactive or reachable via keyboard.
- **Placeholder labels:** **MUST NOT** use `placeholder` as the sole form of label. Crucial instructions (like date formats) **MUST** be visible outside the field to prevent disappearance during filling.
- **ARIA soup:** **MUST NOT** add ARIA where native HTML already provides the semantics — no ARIA is better than bad ARIA. Forbidden by default: redundant roles (`role="button"` on a `<button>`), `aria-label` duplicating visible text (harmless today, but it drifts into an SC 2.5.3 failure when the text changes), and static ARIA states that are never updated (hardcoded `aria-expanded` — an SC 4.1.2 failure). ARIA is the fallback for gaps in native semantics ([First Rule of ARIA Use](https://www.w3.org/TR/using-aria/#rule1)), not a seasoning. *(Field data: WebAIM Million 2026 — pages average 133+ ARIA attributes, 6× the 2019 figure, and more ARIA correlates with more detected errors.)*
- **Reinventing the complex wheel:** if you need complex components (autocomplete selects, treeviews, datepickers), it is strongly recommended to use robust and accessible libraries (e.g., Headless UI) rather than building proprietary logic from scratch.

## 7. Verification workflow (Definition of Done)

- [ ] **Technical check:** clean code, testable via integrated linter (`eslint-plugin-jsx-a11y` or similar), and passing without critical violations through engines like `Axe` (see `test-code-eng.md` for tool setup).
- [ ] **Tab order:** `Tab` key path manually validated (ensures absence of frontend dead-ends).
- [ ] **User flow:** dynamic interactions (SPAs) tested for feedback via `aria-live` in error and success scenarios without mouse use.
- [ ] **Zoom and reflow:** text resizes up to 200% without loss of content or function (SC 1.4.4); content reflows at 320 CSS px width — equivalent to 400% zoom on a 1280px viewport — without two-dimensional scrolling (SC 1.4.10). Preserve flexibility using relative units (rem/em).
- [ ] **Color and perception:** no functional loss when losing the exclusive use of color (vision deficiency simulators).
- [ ] **Exceptions audit:** `EXCEPTIONS.md` reviewed — every active entry has a risk owner, approver, tracking issue, and expiry; no expired entries left unaddressed.

---

## References

- Original project: https://github.com/fecarrico/A11Y.md (MIT license — Felipe A. Carriço)
- WAI-ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/
- eBay MIND Patterns: https://ebay.github.io/mindpatterns/
- Deque Axe Core: https://github.com/dequelabs/axe-core
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Optional templates from the original project: accessibility report (`REPORT.md`), exceptions log (`EXCEPTIONS.md`), and decisions log (`A11Y-DECISIONS.md`) — available under `docs/*/templates/` in the original repository.
