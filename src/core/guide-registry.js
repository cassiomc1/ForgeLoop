/**
 * Canonical Guide Registry for ForgeLoop.
 * Single source of truth for all supported engineering guides.
 */

export const GUIDE_REGISTRY = Object.freeze({
  premium: Object.freeze({
    id: "premium",
    path: "ENG/premium-sites-studio-eng.md",
    install: true,
  }),
  clean: Object.freeze({
    id: "clean",
    path: "ENG/clean-code-eng.md",
    install: true,
  }),
  test: Object.freeze({
    id: "test",
    path: "ENG/test-code-eng.md",
    install: true,
  }),
  security: Object.freeze({
    id: "security",
    path: "ENG/sec-code-eng.md",
    install: true,
  }),
  design: Object.freeze({
    id: "design",
    path: "ENG/design-code-eng.md",
    install: true,
  }),
  taste: Object.freeze({
    id: "taste",
    path: "ENG/taste-frontend-eng.md",
    install: true,
  }),
  performance: Object.freeze({
    id: "performance",
    path: "ENG/perf-code-eng.md",
    install: true,
  }),
  accessibility: Object.freeze({
    id: "accessibility",
    path: "ENG/accessibility-eng.md",
    install: true,
  }),
  games: Object.freeze({
    id: "games",
    path: "ENG/games-code-design-web-eng.md",
    install: true,
  }),
  documentation: Object.freeze({
    id: "documentation",
    path: "ENG/documentation-quality-eng.md",
    install: true,
  }),
});

export const GUIDE_IDS = Object.freeze(Object.keys(GUIDE_REGISTRY));

export const GUIDE_FILES = Object.freeze(
  Object.fromEntries(Object.entries(GUIDE_REGISTRY).map(([id, def]) => [id, def.path])),
);

export const GUIDE_TEMPLATE_PATHS = Object.freeze(
  Object.values(GUIDE_REGISTRY)
    .filter((def) => def.install)
    .map((def) => def.path),
);
