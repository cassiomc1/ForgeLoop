import { readFile } from "node:fs/promises";
import path from "node:path";

import { GUIDE_FILES } from "./guide-registry.js";

function parseList(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start < 0) return [];
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+-\s+/.test(line)) break;
    values.push(line.replace(/^\s+-\s+/, "").trim());
  }
  return values.filter(Boolean);
}

function parseFrontmatter(text, relativePath) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) throw new Error(`${relativePath} is missing YAML frontmatter`);
  const frontmatter = match[1];
  const guideId = frontmatter.match(/^guide-id:\s*([^\s]+)\s*$/m)?.[1] ?? null;
  const lastReviewed = frontmatter.match(/^last-reviewed:\s*"?([^"\r\n]+)"?\s*$/m)?.[1] ?? null;
  const version = frontmatter.match(/^version:\s*"?([^"\r\n]+)"?\s*$/m)?.[1] ?? null;
  return {
    guideId,
    lastReviewed,
    version,
    requiresGates: parseList(frontmatter, "requires-gates"),
    completionEvidence: parseList(frontmatter, "completion-evidence"),
  };
}

export async function readGuideMetadata(packageRoot) {
  const metadata = {};
  for (const [id, relativePath] of Object.entries(GUIDE_FILES)) {
    const text = await readFile(path.join(packageRoot, relativePath), "utf8");
    const parsed = parseFrontmatter(text, relativePath);
    metadata[id] = {
      guideId: parsed.guideId ?? id,
      lastReviewed: parsed.lastReviewed,
      version: parsed.version,
      requiresGates: [...parsed.requiresGates],
      completionEvidence: [...parsed.completionEvidence],
      path: relativePath,
    };
  }
  return metadata;
}

export async function requiredGatesForGuides(guides, packageRoot) {
  const metadata = await readGuideMetadata(packageRoot);
  return [...new Set(guides.flatMap((guide) => metadata[guide]?.requiresGates ?? []))].sort();
}

export async function completionEvidenceForGuides(guides, packageRoot) {
  const metadata = await readGuideMetadata(packageRoot);
  return [...new Set(guides.flatMap((guide) => metadata[guide]?.completionEvidence ?? []))].sort();
}
