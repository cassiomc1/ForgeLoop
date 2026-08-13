import path from "node:path";

import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { isKitPath } from "./target-layout.js";

const LEGACY_REFERENCE_PATTERN = /(?:\.\.\/|\.\/)+(?:LOOP_ENGINEERING|PROJECT_PROFILE|GUIDE_ROUTER)\.md\b/g;

export function nativeShimPrefix(relativePath) {
  if (relativePath.startsWith(".cursor/")) return "../../.forgeloop/kit";
  if (relativePath.startsWith(".github/")) return "../.forgeloop/kit";
  return ".forgeloop/kit";
}

export function nativeShimReferences(relativePath) {
  const prefix = nativeShimPrefix(relativePath);
  return [
    `${prefix}/LOOP_ENGINEERING.md`,
    `${prefix}/AGENT_COMPATIBILITY.md`,
  ];
}

export function nativeShim(relativePath) {
  const kitPrefix = nativeShimPrefix(relativePath);
  return `# ForgeLoop native adapter\n\nRead and follow the canonical ForgeLoop protocol in ${kitPrefix}/LOOP_ENGINEERING.md and ${kitPrefix}/AGENT_COMPATIBILITY.md.\nThe canonical guides and schemas are under ${kitPrefix}/; keep this adapter concise and preserve any host-specific instructions.\n`;
}

export function resolveNativeReference(relativePath, reference) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), reference));
}

export function inspectNativeAdapter(relativePath, bytes) {
  const text = Buffer.from(bytes).toString("utf8");
  const expected = nativeShimReferences(relativePath);
  const legacyReferences = text.match(LEGACY_REFERENCE_PATTERN) ?? [];
  const missingReferences = expected.filter((reference) => !text.includes(reference));
  const resolvedReferences = expected.map((reference) => ({
    reference,
    path: resolveNativeReference(relativePath, reference),
  }));

  return {
    text,
    expected,
    legacyReferences,
    missingReferences,
    resolvedReferences,
    hasForgeLoopMarker: /forgeloop/i.test(text),
  };
}

export async function validateNativeAdapterTargets({ target, relativePath, bytes }) {
  const inspection = inspectNativeAdapter(relativePath, bytes);
  const invalidReferences = inspection.resolvedReferences.filter(({ path: resolvedPath }) => !isKitPath(resolvedPath));
  const missingTargets = [];

  for (const { path: resolvedPath } of inspection.resolvedReferences) {
    if (!isKitPath(resolvedPath)) continue;
    try {
      await assertSafePath(target, resolvedPath);
      if (!(await fileExists(ensureWithin(target, resolvedPath)))) missingTargets.push(resolvedPath);
    } catch (error) {
      invalidReferences.push({ path: resolvedPath, error: error.message });
    }
  }

  return {
    ...inspection,
    invalidReferences,
    missingTargets,
    stale: inspection.legacyReferences.length > 0
      || inspection.missingReferences.length > 0
      || invalidReferences.length > 0,
  };
}
