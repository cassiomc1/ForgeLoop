import { readFile } from "node:fs/promises";

import { ARTIFACT_PATHS, readJsonArtifact } from "./artifacts.js";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import { assertSourceProvenance } from "./sources.js";

const SOURCE_ID_PATTERN = /\b(?:USER|FILE|CMD|DECISION|OBS|INFER|UNKNOWN)-[A-Z0-9_-]+\b/g;
const DIRECTIVE_PATTERN = /forgeloop-source:\s*([A-Z0-9_-]+)\s+kind=([a-z-]+)/gi;

function issue(code, message, artifacts = []) {
  return { code, message, artifacts };
}

export async function validateProfileSources(target, packageRoot) {
  const profilePath = "PROJECT_PROFILE.md";
  await assertSafePath(target, profilePath);
  const absolutePath = ensureWithin(target, profilePath);
  if (!(await fileExists(absolutePath))) {
    return { status: "missing", refs: [], errors: [] };
  }
  const text = await readFile(absolutePath, "utf8");
  const refs = [...new Set(text.match(SOURCE_ID_PATTERN) ?? [])].sort();
  const directives = [...text.matchAll(DIRECTIVE_PATTERN)].map((match) => ({ id: match[1], kind: match[2] }));
  if (refs.length === 0 && directives.length === 0) {
    return { status: "not-referenced", refs: [], errors: [] };
  }
  const errors = [];
  let registry;
  try {
    registry = (await readJsonArtifact(target, ARTIFACT_PATHS.sources, "source-registry", packageRoot)).value;
  } catch (error) {
    errors.push(issue("E_PROFILE_SOURCE_MISSING", error.message, [ARTIFACT_PATHS.sources]));
    return { status: "invalid", refs, errors };
  }
  try {
    assertSourceProvenance(registry, refs);
  } catch (error) {
    errors.push(issue(error.code ?? "E_PROFILE_SOURCE_UNKNOWN", error.message, [ARTIFACT_PATHS.sources]));
  }
  for (const directive of directives) {
    try {
      assertSourceProvenance(registry, [directive.id], { expectedKind: directive.kind });
    } catch (error) {
      errors.push(issue(error.code ?? "E_PROFILE_SOURCE_MISCLASSIFIED", error.message, [ARTIFACT_PATHS.sources]));
    }
  }
  return { status: errors.length === 0 ? "valid" : "invalid", refs, errors };
}
