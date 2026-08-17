import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isNativeAdapterPath,
  legacyPathForSource,
  targetPathForSource,
} from "./target-layout.js";
import { nativeShim } from "./native-adapters.js";
import { GUIDE_TEMPLATE_PATHS } from "./guide-registry.js";

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
  "PROTOCOL_INTEGRATION.md",
  "AGENT_COMPATIBILITY.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  "LICENSE-DOCS.md",
  ...GUIDE_TEMPLATE_PATHS,
  "schemas/routing-input.schema.json",
  "schemas/routing-result.schema.json",
  "schemas/work-state.schema.json",
  "schemas/continuity.schema.json",
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
  "schemas/execution.schema.json",
  "schemas/evidence-coverage.schema.json",
  "schemas/event.schema.json",
  "schemas/activation.schema.json",
  "schemas/policy.schema.json",
  "schemas/task-bundle.schema.json",
  "schemas/authority.schema.json",
  "schemas/task-descriptor.schema.json",
];

export function getPackageRoot() {
  return PACKAGE_ROOT;
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
