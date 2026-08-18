---
name: taste-frontend-eng
language: en
description: "Contextual visual-taste review for premium frontend and brand-heavy work."
version: "2026.09"
last-reviewed: "2026-08-17"
guide-id: taste
---

# Taste Skill for ForgeLoop Frontend Work

This is a contextual review guide for premium marketing sites, landing pages,
portfolios, brand surfaces, and high-finish redesigns. It is selected by the
ForgeLoop router only when the work has that visual context. It is advisory: it
does not create an approval gate, block an autonomous task, or require a
specific framework, font, layout, animation library, or visual tool.

The upstream inspiration is Taste Skill's design-read and anti-default
approach. ForgeLoop keeps the useful review vocabulary while applying its own
protocol boundaries: user evidence, accessibility, performance, security, and
the active product constraints have priority over aesthetic preference.

## Design Read

Before editing, describe the existing or proposed system in observable terms:

- What is the product promise, audience, and primary action?
- Which visual idea creates recognition, and which elements are merely
  decoration?
- What are the current typography roles, color roles, spacing rhythm, grid,
  image treatment, component shapes, and motion cues?
- Where does the hierarchy break at the first viewport, on a narrow viewport,
  or in a dense interaction state?

Separate observed evidence from inference. If the implementation is not yet
available, record the read as a hypothesis and keep it reversible.

## Design Dials

Use three lightweight dials to make an intentional decision rather than a
generic default:

- **Design variance:** familiar, distinctive, or experimental relative to the
  product category.
- **Motion intensity:** static, restrained, or expressive, limited by user
  preference and runtime budget.
- **Visual density:** quiet, balanced, or information-rich, tuned to the task
  and reading conditions.

Record the chosen direction in the design gate or contract assumptions when it
materially changes implementation. Do not randomize values to manufacture
novelty; deliberate variation should have a product or communication reason.

## Anti-Slop Checks

Review the whole page, not only the hero:

- The first viewport states what the product is, for whom, and what to do.
- Repeated sections have a reason and do not reuse one composition by habit.
- The strongest contrast, scale, and whitespace support the intended hierarchy.
- Decorative effects do not compete with content, controls, or error states.
- Images, icons, testimonials, logos, metrics, and claims are real or clearly
  marked as representative; never fabricate proof.
- Framework, component, and template defaults are changed only when the
  resulting system is more coherent and the change is justified.
- Empty, loading, error, focus, hover, pressed, disabled, consent, and form
  states belong to the same visual system.

## Typography Quality

Choose typography by role and reading need. Limit the number of families and
weights to what the product needs, keep running text at a comfortable measure,
and establish a clear display/body/metadata hierarchy. Verify the exact font
source, license, loading cost, fallback, and language coverage before adding an
external font. A distinctive type choice is optional; legibility and product
evidence are not.

## Layout Composition

Build hierarchy from relationships: container, grid, alignment, rhythm,
contrast, grouping, and breathing room. Vary section composition when that
clarifies a narrative, but preserve predictable navigation and interaction.
Use the smallest set of tokens that explains the system. Treat a deliberate
asymmetry, quiet section, oversized statement, or dense data region as a
decision to validate, not a rule to apply everywhere.

## Motion Restraint

Motion should explain change, guide attention, or provide feedback. Prefer
short, interruptible, seek-safe transitions and respect
`prefers-reduced-motion`, reduced-transparency preferences, focus, and input
latency. A static implementation is valid when it communicates better or
meets the performance budget. GSAP, scroll effects, canvas, WebGL, and shader
effects are optional implementation choices, never universal requirements.

## Responsive Composition

Design narrow and wide compositions as related states, not as a desktop page
scaled down. Re-check hierarchy, line length, touch targets, safe areas,
navigation, image crops, overflow, and the primary action at the smallest
supported viewport. Test intermediate widths when layout changes are likely;
do not invent a breakpoint merely to match a visual convention.

## Design-System Selection

Use the existing product system when one is present. If the target has no
system, choose a small coherent set of semantic tokens, components, states,
and usage rules that the team can maintain. A vendor guide, gallery, template,
or AI output can inform a direction, but it is not evidence of product fit,
license, accessibility, or performance. For external component, AI-interface,
or motion references — including React Bits, AIcss, beUI, and Transition Kit
when contextually applicable — follow the canonical adoption rules in
[`design-code-eng.md`](./design-code-eng.md) rather than treating a gallery
component as a project design-system default. Keep any external reference in
the task's source and attribution records; do not add a network dependency to
ForgeLoop runtime.

## Visual Pre-Flight

Before calling a visual task ready, check the smallest useful evidence set:

- hierarchy and primary action at wide and narrow viewports;
- keyboard focus, contrast, zoom, reduced motion, and semantic controls;
- loading/error/empty/form states that are in scope;
- image and font loading, console/runtime errors, and performance budget;
- consistency of tokens, spacing, type roles, component states, and content
  claims.

If visual evidence is unavailable, record `NOT_VERIFIED` or a bounded
limitation. Never turn an imagined screenshot or an unrun browser check into
an observed result.

## Redesign Audit

For an existing interface, scan first and classify each issue as hierarchy,
typography, color/contrast, composition, content, interaction, responsive
behavior, accessibility, performance, or evidence. Fix the highest-leverage
issues in small coherent batches. Re-read the whole system after each batch so
local polish does not create a new inconsistency elsewhere.

The final decision remains protocol-owned: this guide can recommend a visual
change, but the contract, routing, gates, evidence, completion rules, and
user-authorized constraints decide whether the task may proceed or close.
