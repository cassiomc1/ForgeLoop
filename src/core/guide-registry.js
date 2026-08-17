import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rawGuides = JSON.parse(
  readFileSync(path.resolve(currentDir, "../config/guides.json"), "utf8"),
);

export const GUIDE_REGISTRY = Object.freeze(
  Object.fromEntries(
    Object.entries(rawGuides).map(([id, def]) => [
      id,
      Object.freeze({ id, ...def }),
    ]),
  ),
);

export const GUIDE_IDS = Object.freeze(Object.keys(GUIDE_REGISTRY));

export const GUIDE_FILES = Object.freeze(
  Object.fromEntries(Object.entries(GUIDE_REGISTRY).map(([id, def]) => [id, def.path])),
);

export const GUIDE_TEMPLATE_PATHS = Object.freeze(
  Object.values(GUIDE_REGISTRY)
    .filter((def) => def.install)
    .map((def) => def.path),
);
