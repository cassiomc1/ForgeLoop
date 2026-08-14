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
    `${prefix}/PROTOCOL_INTEGRATION.md`,
  ];
}

export function nativeShim(relativePath) {
  const kitPrefix = nativeShimPrefix(relativePath);
  return `<!-- FORGELOOP_PROJECT_PROTOCOL=REQUIRED -->
# ForgeLoop Project Protocol

This project is ForgeLoop-enabled.

If your execution environment loaded this file, ForgeLoop applies to work
performed in this project regardless of model, provider, product, IDE,
agent name, runtime name, or orchestration environment.

Do not treat ForgeLoop as vendor-specific, harness-specific, optional,
advisory, or something to follow only "in spirit".

Read and follow:
- ${kitPrefix}/LOOP_ENGINEERING.md
- ${kitPrefix}/PROTOCOL_INTEGRATION.md

Before changing product or executable files, establish the ForgeLoop contract,
route, required gates, and READY preflight.

Use the project-local ForgeLoop CLI for lifecycle-owned protocol state.
Never manually synthesize lifecycle chronology or assign ForgeLoop COMPLETE.

Before claiming ForgeLoop-verified completion, require
\`forgeloop complete\` to return \`VALID\`.

If a required capability is unavailable, report that ForgeLoop dimension as
not verified rather than simulating it.
`;
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
    hasProtocolMarker: text.includes("FORGELOOP_PROJECT_PROTOCOL=REQUIRED"),
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
