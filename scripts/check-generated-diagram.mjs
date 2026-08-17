#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Normalizes text to canonical LF line endings before fingerprinting.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTextForFingerprint(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Computes a deterministic SHA-256 fingerprint for canonical text across all platforms.
 * @param {string} text
 * @returns {string}
 */
export function fingerprintText(text) {
  return createHash("sha256")
    .update(normalizeTextForFingerprint(text), "utf8")
    .digest("hex");
}

/**
 * Validates that an SVG file contains a valid SHA-256 fingerprint matching the canonical Mermaid source.
 * @param {string} [targetPath] - Optional path to target SVG
 * @param {string} [rootDir] - Optional root directory
 */
export async function checkGeneratedDiagram(targetPath = null, rootDir = repositoryRoot) {
  const sourcePath = path.join(rootDir, "docs", "forgeloop-flow.mmd");
  const outputPath = targetPath
    ? path.resolve(rootDir, targetPath)
    : path.join(rootDir, "docs", "assets", "forgeloop-flow.svg");

  const [source, rendered] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(outputPath, "utf8"),
  ]);
  const expectedFingerprint = fingerprintText(source);
  const actualFingerprint = rendered.match(
    /<svg\b[^>]*data-forgeloop-source-sha256="([a-f0-9]{64})"/,
  )?.[1];

  if (!/<svg\b/.test(rendered)) {
    throw new Error(`diagram is not an SVG document: ${outputPath}`);
  }
  if (actualFingerprint !== expectedFingerprint) {
    throw new Error(
      `diagram source fingerprint mismatch: expected ${expectedFingerprint}, found ${actualFingerprint ?? "missing"} (fingerprint does not match canonical source)`,
    );
  }

  return {
    valid: true,
    outputPath,
    fingerprint: actualFingerprint,
  };
}

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const targetArg = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;
    const result = await checkGeneratedDiagram(targetArg);
    console.log(`Diagram source fingerprint valid: ${path.relative(repositoryRoot, result.outputPath)}`);
  } catch (error) {
    console.error(`Diagram validation failed: ${error.message}`);
    process.exit(1);
  }
}
