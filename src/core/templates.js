import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const TEMPLATE_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursor/rules/project-loop.mdc",
  ".github/copilot-instructions.md",
  "LOOP_ENGINEERING.md",
  "GUIDE_ROUTER.md",
  "PROJECT_PROFILE.md",
  "LOOP_SYSTEM_DESIGN.md",
  "AGENT_COMPATIBILITY.md",
  "THIRD_PARTY_NOTICES.md",
  "ENG/accessibility-eng.md",
  "ENG/clean-code-eng.md",
  "ENG/design-code-eng.md",
  "ENG/games-code-design-web-eng.md",
  "ENG/perf-code-eng.md",
  "ENG/premium-sites-studio-eng.md",
  "ENG/sec-code-eng.md",
  "ENG/test-code-eng.md",
];

export function getPackageRoot() {
  return PACKAGE_ROOT;
}

export async function readTemplateEntries(packageRoot = PACKAGE_ROOT) {
  return Promise.all(
    TEMPLATE_PATHS.map(async (relativePath) => ({
      relativePath,
      bytes: await readFile(path.join(packageRoot, relativePath)),
    })),
  );
}
