#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repositoryRoot, "docs", "forgeloop-flow.mmd");
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repositoryRoot, "docs", "assets", "forgeloop-flow.svg");

try {
  const [source, rendered] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(outputPath, "utf8"),
  ]);
  const expectedFingerprint = createHash("sha256").update(source).digest("hex");
  const actualFingerprint = rendered.match(
    /<svg\b[^>]*data-forgeloop-source-sha256="([a-f0-9]{64})"/,
  )?.[1];

  if (!/<svg\b/.test(rendered)) {
    throw new Error(`diagram is not an SVG document: ${outputPath}`);
  }
  if (actualFingerprint !== expectedFingerprint) {
    throw new Error(
      `diagram source fingerprint mismatch: expected ${expectedFingerprint}, found ${actualFingerprint ?? "missing"}`,
    );
  }

  console.log(`Diagram source fingerprint valid: ${path.relative(repositoryRoot, outputPath)}`);
} catch (error) {
  console.error(`Diagram validation failed: ${error.message}`);
  process.exitCode = 1;
}
