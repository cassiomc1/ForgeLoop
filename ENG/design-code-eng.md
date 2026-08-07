---
name: web-design-premium-v2-eng
description: 'Premium guide to visual direction, UX, motion, and performance in sophisticated digital experiences — desktop web, mobile web, native iOS/Android apps, and Windows/macOS desktop apps. ALWAYS use it when creating, redesigning, or reviewing a landing page, institutional website, digital product, or application that needs to look premium/high-end.'
---

# Web Design Premium v2 — Practical Guidelines

> This guide is a RECIPE, not a suggestion. Wherever there is a numeric value, palette, or snippet, USE exactly what is here, unless the user explicitly requests something different. Do not invent values "by eye". This exists so that any execution (even without refined aesthetic judgment) results in something premium.

> **Related documents**: for the complete studio-level website production process, see [`premium-sites-studio-eng.md`](./premium-sites-studio-eng.md). For the quality/structure of the code that implements this design, see [`clean-code-eng.md`](./clean-code-eng.md). For accessibility/visual/E2E testing, see [`test-code-eng.md`](./test-code-eng.md). For form security, authentication, and client-side storage, see [`sec-code-eng.md`](./sec-code-eng.md). To translate visual direction into HTML video, see [HyperFrames](https://hyperframes.heygen.com). This file focuses exclusively on UI/UX/visuals — it does not repeat code, testing, or security rules.

> **Mandatory tooling**: if any tool, dependency, runtime, CLI or utility required to execute this guide (linter, formatter, test framework, scanner, profiler, engine, etc.) is not installed in the environment, **request its installation from the user immediately** (or install it with approval, per the environment's policy). No step, check or deliverable may be skipped, postponed or replaced because "the tool is not installed" — the task is only complete when all required checks have actually been executed.

## How to use this guide (mandatory process)

Follow this order whenever creating a page from scratch:

1. **Choose 1 ready-made palette** from the "Ready-made Palettes" section (do not mix palettes).
2. **Choose 1 ready-made typographic combination** from the "Typographic Combinations" section.
3. **Define the page's section list** using the "Premium Page Anatomy".
4. **Apply the exact grid and spacing** from the "Layout & Spacing" section.
5. **Apply components** (buttons, cards, nav) with the exact specs from the "Components" section.
6. **Add motion** only according to the snippets in the "Motion" section — never "creative" motion outside the standard.
7. **Run the Anti-Slop Checklist** before considering it ready.

Never skip steps 1 and 2. The biggest cause of an "amateur" result is mixing random palettes/fonts or using framework defaults (e.g., Bootstrap blue, Inter everywhere, generic shadow `box-shadow: 0 0 10px rgba(0,0,0,0.1)`).

> **This guide covers 3 contexts.** For web sites/products (desktop and mobile), follow the flow above normally. For **native mobile apps** (iOS/Android), go directly to the "Premium Mobile Apps" section. For **native desktop apps** (Windows/macOS), go to "Premium Desktop Apps". In the latter two cases, this guide's palettes and typography still serve as tone references, but platform guidelines (HIG, Material Design, Fluent) take priority over the generic values defined here.

---

## Principles (Anti-Slop)

- Fewer elements, more intention: each block must have a clear function.
- Avoid a template appearance: vary composition, rhythm, and hierarchy between sections (never repeat the same section layout 2x in a row).
- Visual consistency over effects: motion and 3D should reinforce the narrative, not distract.
- Premium finish = refined detail in typography, spacing, contrast, and microinteractions — not quantity of elements.
- **Golden rule of whitespace**: if you are wondering whether there is too much space, there is too little. Premium sites breathe.

---

## Ready-made Palettes (choose 1, do not mix)

Each palette has: background, text, primary, supporting neutral, accent (rare use, <5% of the UI).

**A. Dark Editorial (fashion, architecture, luxury)**

- Background: `#0B0B0C` | Alt background: `#141416`
- Text: `#F5F4F1` | Secondary text: `#A8A7A3`
- Primary: `#C9A876` (matte gold)
- Border/divider: `#2A2A2C`
- Accent (rare use): `#D14F3E`

**B. Light Clean Corporate (SaaS, premium fintech)**

- Background: `#FAFAF8` | Alt background: `#F0EFEB`
- Text: `#141414` | Secondary text: `#5C5C5C`
- Primary: `#1F3D2B` (deep green)
- Border/divider: `#E3E1DB`
- Accent (rare use): `#C4623A`

**C. Minimal Warm Neutral (studios, portfolio, branding)**

- Background: `#F7F5F2` | Alt background: `#EDEAE4`
- Text: `#1C1B19` | Secondary text: `#726F68`
- Primary: `#3D3A34` (almost-black brown)
- Border/divider: `#DEDAD2`
- Accent (rare use): `#8A6E4B`

**D. Vibrant Dark Tech (digital product, AI, dev tools)**

- Background: `#08090C` | Alt background: `#101218`
- Text: `#EDEEF0` | Secondary text: `#8A8F98`
- Primary: `#6E6AF5` (indigo)
- Border/divider: `#1F2128`
- Accent (rare use): `#3EDBB8`

Color usage rules:

- Primary: used in CTAs, active links, key icons. Max. 10% of the visible area.
- Accent: used 1–2 times per entire page (e.g., a single badge, a single highlight).
- Never use more than 4 distinct colors in the total palette (counting neutrals).
- Never use a gradient with more than 2 colors; gradient opacity always between 5%–20% when over a solid background.

---

## Ready-made Typographic Combinations (choose 1)

Format: Display (headings) + Text (body). All via Google Fonts, free.

1. **Classic editorial**: `Fraunces` (display, serif, weights 400/600) + `Inter` (body).
2. **Modern luxury**: `Playfair Display` (display) + `Manrope` (body).
3. **Tech/product**: `General Sans` or `Space Grotesk` (display) + `Inter` (body).
4. **Warm minimal**: `Instrument Serif` (display, only for large headings) + neutral `Sans` such as `Public Sans` (body).
5. **Contemporary bold**: `Clash Display` (display) + `Satoshi` (body).

Rules:

- Never use more than 2 font families on the entire page.
- Never use the display font for long paragraphs (only H1/H2/short highlight blocks).
- Typographic scale (rem, base 16px):
  - H1: `clamp(2.75rem, 5vw, 5rem)`, line-height `1.05`, letter-spacing `-0.02em`
  - H2: `clamp(2rem, 3.5vw, 3rem)`, line-height `1.1`, letter-spacing `-0.01em`
  - H3: `clamp(1.5rem, 2.2vw, 2rem)`, line-height `1.2`
  - Body: `1.125rem` (18px), line-height `1.6`
  - Small/caption: `0.875rem`, line-height `1.5`
- Maximum running-text width: `65ch`.
- Font weight: headings 500–700, body 400–450 (never 300 for body text, as it harms legibility).

---

## Layout & Spacing (exact values)

- Maximum container: `1280px`, centered, side padding `clamp(24px, 6vw, 96px)`.
- Grid: 12 columns, gap `24px` desktop / `16px` mobile.
- Spacing scale (ALWAYS use multiples of this scale, never arbitrary values):
  `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192px`
- Vertical spacing between sections: minimum `96px` mobile, `160px` desktop.
- Section internal spacing (top/bottom padding): `64px` mobile, `120px` desktop.
- Breakpoints: mobile `< 640px`, tablet `640–1024px`, desktop `> 1024px`.
- Rhythm: alternate between "dense" sections (text + image + CTA) and "empty" sections (one large centered sentence, lots of space). Rule of thumb: every 2 dense sections, 1 breathing section.
- Consistent border-radius: choose 1 scale value and use it everywhere — `8px` (sober/corporate) or `16px` (soft/product) or `2px` (editorial/luxury). Never mix different radii in the same project.
- Standard shadow (use only 1 recipe per project, applied consistently):
  - Subtle: `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)`
  - Elevated (modals/dropdowns): `0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)`

---

## Web Mobile — Specifics (it is not just "shrinking desktop")

A premium mobile site is not a reduced desktop layout — hierarchy, density, and interaction change.

- **Viewport**: always `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Safe areas**: use `env(safe-area-inset-top/bottom/left/right)` in fixed elements (nav, sticky CTA) to respect the notch/Dynamic Island/home indicator.
- **Touch, not hover**: every interactive element must have a minimum real touch area of `44x44px`, even if the visual element is smaller (use invisible padding to compensate).
- **Never depend on hover** to reveal essential information or interaction (tooltips, dropdown menus) — always have a touch/click equivalent.
- **Mobile nav**: prefer a fullscreen hamburger menu (see Components section) or fixed bottom nav for web apps/PWAs with few sections (3–5 items).
- **Sticky CTA**: on long conversion pages, consider a CTA fixed to the bottom of the mobile viewport (bar with 1 button, height `56–64px`, subtle upward shadow), with `env(safe-area-inset-bottom)` in the padding.
- **Content density**: reduce to 1 column, headline smaller than the desktop scale but still dominant (use the `clamp()` already defined — never set a fixed `px` value that ignores the clamp).
- **Forms**: inputs with minimum `font-size` of `16px` (prevents automatic zoom in iOS Safari), correct `inputmode`/`type` (`email`, `tel`, `numeric`) for the contextual keyboard.
- **Mobile-first performance**: always test using simulated 4G/3G network throttling; images on mobile must be smaller variants via `srcset`, never the same desktop image resized by CSS.
- **Gestures**: swipe in carousels/galleries must have a fallback of visible dots/arrows; never depend only on the gesture without a visual indication that more content exists.

---

## Premium Page Anatomy (recommended order)

Use this as the standard skeleton for landing pages; adapt it according to the product, but maintain the logic of "open strong → prove → convert".

1. **Nav**: logo on the left, 3–5 links in the center/right, 1 prominent CTA. Fixed or with a transparent background that gains blur while scrolling.
2. **Hero**: 1 strong headline (max. 8–10 words), 1 subheadline (1–2 sentences), 1 primary CTA + 1 secondary (text/link). Never more than 2 CTAs in the hero.
3. **Light social proof**: client/press logos in grayscale, single line, no embellishment.
4. **Value section (2–3 blocks)**: each block = 1 idea, icon or simple image, short title, 1–2 lines of text.
5. **Product/demo section**: real screenshot, mockup, or short video — never a generic stock illustration.
6. **Testimonials or data/numbers**: 2–4 real testimonials OR 3–4 large metrics with numbers.
7. **Intermediate conversion CTA**: breathing section, large centered sentence + 1 button.
8. **FAQ** (if applicable): simple accordion, 4–6 questions.
9. **Final CTA**: repeat the central value proposition + primary button.
10. **Footer**: organized link columns, social media, copyright. No excessive columns (max. 4).

Rule: never repeat the same "image left + text right" pattern in 2 consecutive sections — alternate sides, or switch to a centered layout.

---

## Color, Contrast, and Depth

- Minimum AA contrast: normal text ≥ 4.5:1, large text (≥24px) ≥ 3:1.
- Soft backgrounds and subtle gradients (opacity 5–20%, without banding).
- Depth built with light layers: blur (`8–24px`), subtle shadow, controlled overlay — never hard shadows (`0 0 20px black`).

---

## Motion (GSAP / ScrollTrigger)

ALWAYS use this base reveal pattern (do not invent variations):

```js
gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray('[data-reveal]').forEach((el) => {
  gsap.from(el, {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
  });
});
```

### Motion for video with HyperFrames (optional)

When the output is a video, trailer, product demo, or motion graphic rendered from HTML, CSS, and JavaScript, consider [HyperFrames](https://hyperframes.heygen.com). It complements — and does not replace — this guide's visual rules.

- Preserve brand tokens (palette, typography, spacing, and radius) when adapting the interface to the frame; do not simply capture the entire page.
- Prefer deterministic, frame-controllable animation with a paused/seekable timeline so preview, tests, and rendering reproduce the same result.
- Keep text large enough for the output format, maintain AA contrast and safe areas, and do not make meaning depend on audio or motion.
- Respect `prefers-reduced-motion` in interactive previews and provide a static or reduced-motion alternative when appropriate.
- Start with the [official quickstart](https://hyperframes.heygen.com/quickstart) and use `npx hyperframes preview`, `npx hyperframes lint`, and `npx hyperframes render` in the quality loop when the project uses the CLI.

Motion rules:

- Vertical displacement: `16–32px` (never more than that — avoids a "flying" effect).
- Duration: `0.6–0.9s` for reveals, `0.2–0.35s` for hover/microinteractions.
- Easing: `power3.out` or `expo.out` for entrances; `power2.inOut` for state transitions.
- Stagger between elements in a list: `0.06–0.1s`.
- Never: bounce, elastic, exaggerated rotation, aggressive parallax (>30% of scroll speed), video autoplay with sound, infinite decorative loops that compete with the content.
- Always wrap all motion logic in:

```js
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // inicializar animações
}
```

---

## 3D and Interactivity (Three.js) — optional, only if justified

- Use only if it reinforces the product/narrative (e.g., physical product, technical data, technology brand). If you are not sure it helps, do not use it.
- Keep elements subtle: light particles, simple shapes, soft lighting.
- Always provide a 2D fallback (static image) for browsers without WebGL and for `prefers-reduced-motion`.
- Limit: <5000 particles, no heavy post-processing (bloom may stay, avoid SSAO/motion blur).
- Pause rendering when the canvas leaves the viewport (`IntersectionObserver`).

---

## Premium Components (exact specs)

**Primary button**

- Padding: `14px 28px` (mobile `12px 24px`)
- Border-radius: equal to the radius chosen in the project
- Font-weight: 500–600, font-size `1rem`
- Transition: `all 0.2s ease` (background color + slight `translateY(-1px)` on hover)
- Minimum touch area: `44x44px`
- Focus state: visible outline (`2px solid`, primary color, offset `2px`) — never `outline: none` without a replacement.

**Cards**

- Internal padding: `32px` (mobile `24px`)
- Border: `1px solid` palette border color, OR subtle shadow — choose 1 of the two, not both.
- Radius: equal to the project standard.
- Hover (if clickable): subtle elevation (elevated shadow) + `translateY(-2px)`, transition `0.25s ease`.

**Navigation**

- Height: `72–88px` desktop, `64px` mobile.
- Active item: subtle underline or primary color — never a fully colored background.
- Mobile menu: fullscreen overlay, fade+slide transition `0.3s`.

**Images**

- Always `object-fit: cover` with a fixed `aspect-ratio` per context (e.g., `16/10` for cards, `1/1` for avatars).
- `border-radius` consistent with the rest of the UI.
- Never stretch/distort an image.

**UI libraries and data visualization**

- For accessible, composable, and customizable web components, consult [shadcn/ui](https://ui.shadcn.com/); adapt tokens, states, and composition to the project's visual system instead of copying defaults without intent.
- For charts and data visualization, consult [TanStack Charts](https://github.com/TanStack/charts); preserve responsiveness, contrast, keyboard readability, and never rely on color alone to communicate series or states.
- For subtle interaction sounds, consult [Cuelume](https://cuelume-site.pages.dev/); provide volume/mute controls and never rely on audio to communicate essential information.

---

## UX, Accessibility, and Quality

- 100% functional keyboard navigation, focus always visible, no interaction traps.
- Minimum AA contrast (see Color section).
- Never communicate state through color alone (add an icon, text, or pattern).
- Test at 200% zoom and on screens 360px wide.
- Every `<img>` with descriptive `alt`; decorative icons with `aria-hidden="true"`.

---

## Performance

- Animate only `transform` and `opacity`; use `will-change` sparingly (remove after the animation).
- Images in `WebP`/`AVIF`, `srcset` + `loading="lazy"` (except the hero image, which must be eager/preload).
- Fonts: `font-display: swap`, preload only the critical hero font (1–2 files, max.).
- Performance budget: LCP < 2.5s, CLS < 0.1, motion/3D JS must not block the initial load (load via `defer`/lazy-init after interaction or scroll).

---

## Blacklist — Anti-Patterns (never do)

- Generic framework blue (`#007BFF`, `#3B82F6` default) as the primary color without intention.
- Generic shadow `box-shadow: 0 0 10px rgba(0,0,0,0.1)` on everything.
- `Inter` or `Roboto` as the site's only font without a display font.
- Generic stock-library icons (3D arrows, rocket emojis, "lightbulb").
- Centered text in long paragraph blocks.
- More than 3 fonts or more than 4 colors.
- Sections all using the same grid/alignment pattern ("cloned template" look).
- Identical "fade in" animation applied indiscriminately to EVERYTHING without timing hierarchy.
- Buttons without a noticeable hover/focus state.
- Excessive badges, tags, and decorative "glassmorphism" without a function.
- Footer with 6+ columns of irrelevant links just to fill space.

---

## Review Checklist (before publishing)

- [ ] I chose 1 ready-made palette and did not mix colors outside it.
- [ ] I used at most 2 font families, following the defined scale.
- [ ] Spacing between sections follows the scale (minimum 96–160px).
- [ ] No section repeats the same layout as the previous one.
- [ ] Each section has 1 purpose and (when applicable) 1 clear CTA.
- [ ] Motion follows the defined snippets/patterns and respects `prefers-reduced-motion`.
- [ ] Text contrast passes AA.
- [ ] Buttons/links have visible focus and noticeable hover.
- [ ] The page works (visually and functionally) without motion/3D JS.
- [ ] No item from the "Blacklist" is present.
- [ ] Tested on mobile (360px) and desktop (1440px).

---

## Premium Mobile Apps (iOS & Android)

> Native apps do NOT strictly follow this guide's web palette/typography guidelines. The priority is the platform's design language (Apple HIG / Material Design 3), ensuring that the app looks "premium native", not like a packaged website.

### iOS (Human Interface Guidelines)

- **Typography**: system font `SF Pro` (Display for large headings, Text for body). Use the system's dynamic styles (Dynamic Type) instead of fixed sizes, to support accessibility:
  - Large Title `34pt`, Title 1 `28pt`, Title 2 `22pt`, Title 3 `20pt`
  - Headline `17pt` (semibold), Body `17pt`, Callout `16pt`, Subhead `15pt`
  - Footnote `13pt`, Caption `12pt`
- **Spacing**: `8pt` grid. Safe screen margins: `16–20pt`. Always respect *safe areas* (notch, Dynamic Island, home indicator) via `safeAreaInsets`.
- **Navigation**: bottom Tab Bar for up to 5 main destinations; top Navigation Bar with a Large Title that collapses while scrolling. Avoid side-drawer navigation (drawer) — it is not an iOS standard.
- **Components**: use native controls (`UIButton`, `UISwitch`, `UISegmentedControl` or equivalent SwiftUI) and `SF Symbols` icons (never custom icons when an equivalent SF Symbol exists).
- **Minimum touch area**: `44x44pt`.
- **Color**: define semantic colors (`label`, `secondaryLabel`, `systemBackground`) that automatically adapt to Light/Dark Mode — never hardcode an absolute color in system elements.
- **Motion**: use native spring curves from UIKit/SwiftUI, duration `0.3–0.35s` for screen transitions, `0.2s` for microinteractions. Use haptics (`UIImpactFeedbackGenerator`) moderately, only for significant actions (confirmation, error, success).
- **Modals and sheets**: use `sheet`/`.presentationDetents` (native bottom sheet) instead of custom modals whenever possible.

### Android (Material Design 3 / Material You)

- **Typography**: `Roboto` (or a brand font registered in the theme) following the M3 type scale: Display, Headline, Title, Body, Label (each with a Large/Medium/Small variant).
- **Spacing**: `8dp` grid, screen margins `16dp` (`24dp` on large screens/tablets).
- **Navigation**: Bottom Navigation Bar (3–5 destinations) on phones; Navigation Rail or Navigation Drawer on tablets/large screens. Top App Bar with title and contextual actions.
- **Components**: use Material 3 components (`FilledButton`, `FAB`, `Card`, `Chip`, `NavigationBar`) with *tonal elevation* (surfaces with layers of color, not just shadow). Consider dynamic color (Material You) when it makes sense for the product.
- **Minimum touch area**: `48x48dp`.
- **Dark theme**: required to support (`isSystemInDarkTheme()` / `DayNight` theme), it is not optional in premium Android products.
- **Motion**: use M3 easing curves (`emphasized`, `standard`), durations `200–500ms` according to the size of the transition (small → fast, full screen → longer). Container transitions (`Container Transform`) for navigation between card and detail.
- **Icons**: `Material Symbols` (outlined by default, filled for active/selected state). For searching and discovering web/app icons, see also [Koboyo Icons](https://koboyo.com/icons).

### Common rules for both platforms

- Never clone 100% of one platform's visual style onto the other (e.g., an iOS-style Tab Bar inside an Android app). Adapt the same brand/palette to each OS's native language.
- Onboarding: maximum 3–4 screens, always with an option to skip.
- Empty, error, and loading states (skeleton screens) are mandatory on every screen with asynchronous data — never leave a blank screen during loading.
- Test on at least 1 small device (e.g., iPhone SE / compact Android) and 1 large device (Pro Max / Android tablet).
- System gestures (swipe back, notification shade) must never be blocked by app overlays.
- The app icon and splash screen follow each platform's official grids (Apple App Icon grid; Android Adaptive Icon with foreground/background layers).

**Quick checklist — Mobile Apps**

- [ ] I used native platform components/navigation (Tab Bar on iOS, Bottom Nav/Rail on Android), not a generic hybrid.
- [ ] Dynamic Type (iOS) / system font scale (Android) work without breaking the layout.
- [ ] Dark Mode implemented and tested on both platforms.
- [ ] Touch areas ≥ 44pt (iOS) / 48dp (Android).
- [ ] Loading, empty, and error states covered on all screens with data.
- [ ] Safe areas respected (notch, system gestures, home indicator).

---

## Premium Desktop Apps (Windows & macOS)

> Like mobile, native desktop apps should follow the operating system's visual language. A "premium" desktop app looks like part of the OS, not a resizable website window.

### Windows (Fluent Design / WinUI 3)

- **Typography**: `Segoe UI Variable` (Display for headings, Text for body), following the Fluent Type Ramp (Display, Title Large, Title, Subtitle, Body Large, Body, Caption).
- **Spacing**: `4px`/`8px` grid. Standard content padding `24px` in main panels.
- **Navigation**: `NavigationView` with a collapsible left rail/panel for apps with multiple sections; custom title bar optional, but always with the standard controls (minimize/maximize/close) in the correct corner.
- **Materials**: use `Mica` (main window) or `Acrylic` (floating panels, flyouts) for subtle translucent depth — do not overuse it, apply it to only 1–2 layers per screen.
- **Components**: native Fluent controls (`Button`, `ToggleSwitch`, `NavigationView`, `InfoBar`), radius `4–8px`, respecting the system's light/dark theme (`Windows.UI.ViewManagement`).
- **Keyboard and accessibility**: 100% navigation via `Tab`/arrows, shortcuts with accelerators (`Alt` underlines the menu letter), tooltips on every control without visible text.
- **Scaling**: test at 100%, 125%, 150%, and 200% Windows scaling (DPI scaling) without cutting off text/icons.

### macOS (Human Interface Guidelines)

- **Typography**: `SF Pro` (Display/Text), respecting system text sizes; support user text-size preferences when applicable.
- **Spacing**: `8pt` grid, generous margins (macOS tends to have more breathing room than Windows). Content padding `20–24pt`.
- **Navigation**: `NSSplitView`/left sidebar + contextual top toolbar; the system menu bar (top of the screen) must contain all of the app's main commands, not only shortcuts hidden in the UI.
- **Window**: respect the native traffic-light controls (close/minimize/maximize), system rounded corners, and support native full screen (`Full Screen` on macOS) and the system's Split View.
- **Materials**: `vibrancy`/blur (`NSVisualEffectView`) in sidebars and floating panels, moderately.
- **Components**: native AppKit/SwiftUI controls for macOS (do not reuse iOS components without adaptation — macOS has different density and affordances, e.g., mouse/trackpad use, hover states exist here unlike on mobile).
- **Keyboard shortcuts**: every relevant command should have a `Cmd+` shortcut, displayed in the menu itself. Full support for keyboard navigation.
- **Accent Color**: respect the accent color chosen by the user in the system when it makes sense for the product, instead of always forcing the brand color on all native controls.

### Common rules for both platforms

- Support window resizing with a defined minimum layout (never allow the UI to break below a reasonable minimum size, e.g. `960x600px`).
- Persist user preferences (window size/position, theme, open panels) between sessions.
- Dark Mode and Light Mode mandatory, following the system preference by default, with an option for manual override.
- Immediate visual feedback for every action (hover, pressed, disabled, loading) — on desktop, hover is a valid and expected affordance, unlike on mobile.
- Contextual menus (right-click) should expose the most-used actions for that element.
- Never use only custom modals when the OS standard (native file dialogs, system alerts) resolves the need with greater familiarity for the user.

**Quick checklist — Desktop Apps**

- [ ] Layout, typography, and materials follow the native language (Fluent on Windows, HIG on macOS), not a generic hybrid between the two.
- [ ] Window is resizable with a defined minimum and no layout breakage.
- [ ] Dark Mode and Light Mode work according to the system preference.
- [ ] 100% keyboard navigation, with shortcuts visible in menus.
- [ ] Hover/pressed/disabled/loading states implemented (desktop has cursor/hover).
- [ ] Tested at least 2 DPI scales (Windows) or 2 screen sizes (macOS).

---

## Sources and References (Base Skills)

- TasteSkill / Anti-Slop: https://github.com/Leonxlnx/taste-skill | https://www.tasteskill.dev/
- Emil Kowalski (Design Engineering / Motion): https://github.com/emilkowalski/skills
- GSAP: https://github.com/greensock/gsap-skills
- ScrollWorld: https://github.com/oso95/scroll-world
- Three.js: https://threejs.org/
- HyperFrames (HTML video and motion): https://hyperframes.heygen.com/ | https://github.com/heygen-com/hyperframes
- Koboyo Icons (Icon Search & Discovery): https://koboyo.com/icons
- Apple Human Interface Guidelines (iOS/macOS): https://developer.apple.com/design/human-interface-guidelines/
- Material Design 3 (Android): https://m3.material.io/
- Microsoft Fluent Design / WinUI 3 (Windows): https://learn.microsoft.com/windows/apps/design/
- shadcn/ui (accessible, composable web components): https://ui.shadcn.com/
- TanStack Charts (data visualization): https://github.com/TanStack/charts
- Cuelume (web interaction sounds): https://cuelume-site.pages.dev/
