import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isNativeAdapterPath,
  legacyPathForSource,
  targetPathForSource,
} from "./target-layout.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TEMPLATE_SOURCE_PATHS = Object.freeze({
  ".forgeloop/.gitignore": ".forgeloop/forgeloop.gitignore",
});

export const TEMPLATE_PATHS = [
  ".forgeloop/.gitignore",
  "AGENTS.md",
  "CLAUDE.md",
  ".cursor/rules/project-loop.mdc",
  ".github/copilot-instructions.md",
  "LOOP_ENGINEERING.md",
  "GUIDE_ROUTER.md",
  "PROJECT_PROFILE.md",
  "LOOP_SYSTEM_DESIGN.md",
  "QUALITY_SCORECARD.md",
  "TERMINOLOGY.md",
  "EXECUTION_STATE.md",
  "DELEGATION_PROTOCOL.md",
  "ORCHESTRATOR_INTEGRATION.md",
  "THREAT_MODEL.md",
  "CONTRACT_COVERAGE.md",
  "AGENT_COMPATIBILITY.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  "LICENSE-DOCS.md",
  "ENG/accessibility-eng.md",
  "ENG/clean-code-eng.md",
  "ENG/design-code-eng.md",
  "ENG/games-code-design-web-eng.md",
  "ENG/perf-code-eng.md",
  "ENG/premium-sites-studio-eng.md",
  "ENG/taste-frontend-eng.md",
  "ENG/sec-code-eng.md",
  "ENG/test-code-eng.md",
  "schemas/routing-input.schema.json",
  "schemas/routing-result.schema.json",
  "schemas/work-state.schema.json",
  "schemas/execution-receipt.schema.json",
  "schemas/task-brief.schema.json",
  "schemas/delegated-result.schema.json",
  "schemas/evidence.schema.json",
  "schemas/current-contract.schema.json",
  "schemas/gate.schema.json",
  "schemas/source-registry.schema.json",
  "schemas/config.schema.json",
  "schemas/preflight.schema.json",
  "schemas/check.schema.json",
  "schemas/evidence-coverage.schema.json",
  "schemas/event.schema.json",
  "schemas/activation.schema.json",
  "schemas/policy.schema.json",
  "schemas/task-bundle.schema.json",
];

export function getPackageRoot() {
  return PACKAGE_ROOT;
}

function nativeShim(relativePath) {
  const kitPrefix = relativePath.startsWith(".cursor/")
    ? "../../.forgeloop/kit"
    : relativePath.startsWith(".github/")
      ? "../.forgeloop/kit"
      : ".forgeloop/kit";
  return `# ForgeLoop native adapter\n\nRead and follow the canonical ForgeLoop protocol in ${kitPrefix}/LOOP_ENGINEERING.md and ${kitPrefix}/AGENT_COMPATIBILITY.md.\nThe canonical guides and schemas are under ${kitPrefix}/; keep this adapter concise and preserve any host-specific instructions.\n`;
}

export async function readTemplateEntries(packageRoot = PACKAGE_ROOT) {
  return Promise.all(
    TEMPLATE_PATHS.map(async (relativePath) => {
      const sourcePath = TEMPLATE_SOURCE_PATHS[relativePath] ?? relativePath;
      return {
        relativePath: targetPathForSource(relativePath),
        sourcePath,
        legacyRelativePath: legacyPathForSource(sourcePath),
        bytes: Buffer.from(isNativeAdapterPath(relativePath)
          ? nativeShim(relativePath)
          : await readFile(path.join(packageRoot, sourcePath))),
      };
    }),
  );
}
