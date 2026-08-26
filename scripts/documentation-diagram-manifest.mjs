#!/usr/bin/env node

import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  ARCHIFY_COMMIT,
  ARCHIFY_SOURCE,
  ARCHIFY_VERSION,
} from "./archify-toolchain.mjs";

export const GOVERNED_DIAGRAM_TYPES = Object.freeze([
  "workflow",
  "architecture",
  "sequence",
  "dataflow",
  "lifecycle",
]);

export const ARCHIFY_RENDERERS = Object.freeze({
  workflow: Object.freeze({
    validateType: "workflow",
    deliverType: "workflow",
  }),
});

const RENDERER_IDENTITY = Object.freeze({
  name: "archify",
  version: ARCHIFY_VERSION,
  commit: ARCHIFY_COMMIT,
  source: ARCHIFY_SOURCE,
  license: "MIT",
});

const OWNED_PATH_FIELDS = Object.freeze(["source", "html", "svg", "receipt", "review"]);

function manifestError(code, message, details = {}) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isManifestRelativePath(value) {
  return isNonEmptyString(value)
    && !value.includes("\\")
    && !path.posix.isAbsolute(value)
    && !/^[A-Za-z]:/.test(value)
    && path.posix.normalize(value) === value
    && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function isContainedManifestPath(value, prefix) {
  return isManifestRelativePath(value) && value.startsWith(`${prefix}/`);
}

function assertRendererIdentity(renderer) {
  if (!isRecord(renderer)) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "renderer identity must be an object");
  }
  for (const [key, expected] of Object.entries(RENDERER_IDENTITY)) {
    if (renderer[key] !== expected) {
      throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `renderer.${key} is not pinned`);
    }
  }
  const keys = Object.keys(renderer).sort();
  const expectedKeys = Object.keys(RENDERER_IDENTITY).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "renderer identity contains unexpected fields");
  }
}

function assertSupportedTypes(policy) {
  if (!isRecord(policy) || !Array.isArray(policy.supportedTypes)
    || JSON.stringify(policy.supportedTypes) !== JSON.stringify(GOVERNED_DIAGRAM_TYPES)) {
    throw manifestError("E_DIAGRAM_MANIFEST_TYPE", "policy.supportedTypes must exactly match governed diagram types");
  }
  if (policy.requireVisualReview !== true) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "policy.requireVisualReview must be true");
  }
}

function assertPath(value, prefix, field, diagramId) {
  if (!isContainedManifestPath(value, prefix)) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${diagramId}.${field} must stay under ${prefix}`, { field, diagramId, value });
  }
}

function assertReferencePaths(referencedBy, diagramId) {
  if (!Array.isArray(referencedBy) || referencedBy.length === 0
    || referencedBy.some((value) => !isManifestRelativePath(value))) {
    throw manifestError("E_DIAGRAM_MANIFEST_REFERENCE", `${diagramId}.referencedBy must contain non-empty relative paths`, { diagramId });
  }
}

export function validateDiagramManifest(manifest) {
  if (!isRecord(manifest) || manifest.version !== 2) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "manifest version must be 2");
  }
  assertRendererIdentity(manifest.renderer);
  assertSupportedTypes(manifest.policy);
  if (!Array.isArray(manifest.diagrams) || manifest.diagrams.length === 0) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "manifest must declare at least one diagram");
  }

  const ids = new Set();
  const canonicalPurposes = new Map();
  const ownedPaths = new Map();
  for (const diagram of manifest.diagrams) {
    if (!isRecord(diagram) || !isNonEmptyString(diagram.id)) {
      throw manifestError("E_DIAGRAM_MANIFEST_INVALID", "every diagram requires a non-empty id");
    }
    if (ids.has(diagram.id)) {
      throw manifestError("E_DIAGRAM_MANIFEST_DUPLICATE_ID", `duplicate diagram id: ${diagram.id}`, { diagramId: diagram.id });
    }
    ids.add(diagram.id);

    if (!GOVERNED_DIAGRAM_TYPES.includes(diagram.type)) {
      throw manifestError("E_DIAGRAM_MANIFEST_TYPE", `diagram type is not governed: ${diagram.type}`, { diagramId: diagram.id });
    }
    if (diagram.defaultTheme !== "dark") {
      throw manifestError("E_DIAGRAM_MANIFEST_THEME", `${diagram.id}.defaultTheme must be dark`, { diagramId: diagram.id });
    }
    if (!Array.isArray(diagram.canonicalFor) || diagram.canonicalFor.length === 0
      || diagram.canonicalFor.some((purpose) => !isNonEmptyString(purpose))) {
      throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${diagram.id}.canonicalFor must be non-empty`, { diagramId: diagram.id });
    }
    for (const purpose of diagram.canonicalFor) {
      if (canonicalPurposes.has(purpose)) {
        throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `canonical purpose is claimed more than once: ${purpose}`, {
          diagramId: diagram.id,
          owner: canonicalPurposes.get(purpose),
        });
      }
      canonicalPurposes.set(purpose, diagram.id);
    }

    assertPath(diagram.source, "docs/diagrams", "source", diagram.id);
    assertPath(diagram.html, "docs/assets/diagrams", "html", diagram.id);
    assertPath(diagram.svg, "docs/assets/diagrams", "svg", diagram.id);
    assertPath(diagram.receipt, "docs/assets/diagrams", "receipt", diagram.id);
    assertPath(diagram.review, "docs/diagrams/reviews", "review", diagram.id);
    if (!isNonEmptyString(diagram.fallback)) {
      throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${diagram.id}.fallback must be non-empty`, { diagramId: diagram.id });
    }
    assertReferencePaths(diagram.referencedBy, diagram.id);

    for (const field of OWNED_PATH_FIELDS) {
      const value = diagram[field];
      if (ownedPaths.has(value)) {
        throw manifestError("E_DIAGRAM_MANIFEST_DUPLICATE_PATH", `path is owned more than once: ${value}`, {
          path: value,
          diagramId: diagram.id,
          owner: ownedPaths.get(value),
        });
      }
      ownedPaths.set(value, `${diagram.id}.${field}`);
    }
  }
  return manifest;
}

export function rendererForDiagramType(type) {
  const renderer = ARCHIFY_RENDERERS[type];
  if (!renderer) {
    const error = manifestError("E_DIAGRAM_RENDERER_NOT_IMPLEMENTED", `renderer is not implemented: ${type}`, { type });
    error.message = `${error.code}: ${type}`;
    throw error;
  }
  return renderer;
}

function resolveManifestPath(rootDir, value) {
  return path.resolve(rootDir, value);
}

async function assertFile(rootDir, value, label) {
  const absolute = resolveManifestPath(rootDir, value);
  let info;
  try {
    info = await lstat(absolute);
  } catch (error) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${label} is missing: ${value}`, { value, cause: error });
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${label} must be a regular file: ${value}`, { value });
  }
  return absolute;
}

function meaningfulReferenceTokens(diagram) {
  return [
    diagram.source,
    diagram.svg,
    diagram.html,
    diagram.review,
    "docs/diagrams/README.md",
    "architecture-flow",
  ];
}

export async function validateDiagramManifestFiles(manifest, { rootDir = process.cwd() } = {}) {
  const validated = validateDiagramManifest(manifest);
  const root = path.resolve(rootDir);
  const rootReal = await realpath(root).catch((error) => {
    throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `manifest root cannot be resolved: ${root}`, { cause: error });
  });
  for (const diagram of validated.diagrams) {
    for (const field of OWNED_PATH_FIELDS) {
      const filePath = await assertFile(root, diagram[field], `${diagram.id}.${field}`);
      const resolved = await realpath(filePath).catch((error) => {
        throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${diagram.id}.${field} cannot be resolved`, { cause: error });
      });
      const relative = path.relative(rootReal, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw manifestError("E_DIAGRAM_MANIFEST_INVALID", `${diagram.id}.${field} resolves outside repository`, { value: diagram[field] });
      }
    }
    const tokens = meaningfulReferenceTokens(diagram);
    for (const reference of diagram.referencedBy) {
      const referencePath = await assertFile(root, reference, `${diagram.id}.referencedBy`);
      const content = await readFile(referencePath, "utf8");
      if (!tokens.some((token) => content.includes(token))) {
        throw manifestError("E_DIAGRAM_MANIFEST_REFERENCE", `${reference} does not meaningfully reference ${diagram.id}`, {
          diagramId: diagram.id,
          reference,
        });
      }
    }
  }
  return validated;
}
