#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHIFY_COMMIT,
  ARCHIFY_SOURCE,
  ARCHIFY_VERSION,
  inspectArchifyToolchain,
  requireArchify,
} from "./archify-toolchain.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIAGRAM_MANIFEST = "docs/diagrams/manifest.json";
const DIAGRAM_ROOT = "docs/diagrams";
const OUTPUT_ROOT = "docs/assets/diagrams";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function resolveSafeRelative(rootDir, relativePath, expectedPrefix) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new Error(`Diagram path must be relative: ${relativePath}`);
  }
  const normalized = relativePath.split(path.sep).join("/");
  if (!normalized.startsWith(`${expectedPrefix}/`) && normalized !== expectedPrefix) {
    throw new Error(`Diagram path must stay under ${expectedPrefix}: ${relativePath}`);
  }
  const absolute = path.resolve(rootDir, relativePath);
  const prefix = path.resolve(rootDir, expectedPrefix);
  if (absolute !== prefix && !absolute.startsWith(`${prefix}${path.sep}`)) {
    throw new Error(`Diagram path escapes ${expectedPrefix}: ${relativePath}`);
  }
  return absolute;
}

function removeRemoteFontLinks(html) {
  return html
    .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, "\n")
    .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/[^>]+>\s*/g, "\n");
}

function extractInlineSvg(html) {
  const start = html.indexOf("<svg");
  const end = html.indexOf("</svg>", start);
  if (start < 0 || end < 0) throw new Error("Archify output did not contain one complete inline SVG");
  const svg = html.slice(start, end + "</svg>".length);
  if ((html.match(/<svg\b/g) ?? []).length !== 1) throw new Error("Archify output must contain exactly one inline SVG");
  return svg;
}

function extractInlineStyles(html) {
  const matches = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  if (matches.length !== 1) throw new Error(`Archify output must contain exactly one style block; found ${matches.length}`);
  return matches[0][1].trim();
}

function addAttribute(svg, name, value) {
  const escaped = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const pattern = new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`, "i");
  if (pattern.test(svg.slice(0, svg.indexOf(">") + 1))) {
    return svg.replace(pattern, ` ${name}="${escaped}"`);
  }
  return svg.replace(/^<svg\b/, `<svg ${name}="${escaped}"`);
}

export function createStaticSvg({ html, sourceSha256 }) {
  const originalSvg = extractInlineSvg(html);
  const css = extractInlineStyles(html);
  let svg = originalSvg;
  svg = addAttribute(svg, "xmlns", "http://www.w3.org/2000/svg");
  svg = addAttribute(svg, "data-theme", "dark");
  svg = addAttribute(svg, "data-forgeloop-source-sha256", sourceSha256);
  svg = addAttribute(svg, "data-archify-version", ARCHIFY_VERSION);
  const openingEnd = svg.indexOf(">") + 1;
  const staticStyle = `<style>\n      .c-bg-rect { fill: var(--bg); }\n${css}\n    </style>`;
  const background = `<rect width="100%" height="100%" class="c-bg-rect" />`;
  return `${svg.slice(0, openingEnd)}\n    ${staticStyle}\n    ${background}${svg.slice(openingEnd)}`;
}

function withGeneratorMeta(html, sourceSha256) {
  const metadata = `    <meta name="forgeloop-diagram-source-sha256" content="${sourceSha256}">\n    <meta name="forgeloop-diagram-renderer" content="archify@${ARCHIFY_VERSION} (${ARCHIFY_COMMIT})">\n`;
  const presentationHtml = html.replace(/<html\b([^>]*)>/i, (openingTag, attributes) => {
    if (/\bdata-present\s*=/.test(attributes)) return openingTag;
    return `<html${attributes} data-present="true">`;
  });
  return presentationHtml.replace(/(<head[^>]*>\s*)/i, `$1${metadata}`);
}

async function readDiagramManifest(rootDir) {
  const manifestPath = path.join(rootDir, DIAGRAM_MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== 1 || !manifest.renderer || !Array.isArray(manifest.diagrams) || manifest.diagrams.length === 0) {
    throw new Error(`${DIAGRAM_MANIFEST} must declare version 1, renderer, and at least one diagram`);
  }
  if (manifest.renderer.name !== "archify" || manifest.renderer.version !== ARCHIFY_VERSION || manifest.renderer.commit !== ARCHIFY_COMMIT) {
    throw new Error("Diagram manifest does not use the pinned Archify renderer");
  }
  return manifest;
}

function outputPaths(rootDir, diagram) {
  return {
    source: resolveSafeRelative(rootDir, diagram.source, DIAGRAM_ROOT),
    html: resolveSafeRelative(rootDir, diagram.html, OUTPUT_ROOT),
    svg: resolveSafeRelative(rootDir, diagram.svg, OUTPUT_ROOT),
    receipt: resolveSafeRelative(rootDir, diagram.receipt, OUTPUT_ROOT),
  };
}

async function stageFile(stageDir, finalPath, content) {
  const staged = path.join(stageDir, path.basename(finalPath));
  await writeFile(staged, content, "utf8");
  return staged;
}

function createReceipt({ diagram, sourceBytes, htmlBytes, svgBytes }) {
  return JSON.stringify({
    version: 1,
    diagramId: diagram.id,
    diagramType: diagram.type,
    source: diagram.source,
    outputs: {
      html: diagram.html,
      svg: diagram.svg,
    },
    renderer: {
      name: "archify",
      version: ARCHIFY_VERSION,
      commit: ARCHIFY_COMMIT,
      source: ARCHIFY_SOURCE,
      license: "MIT",
    },
    input: {
      sha256: sha256(sourceBytes),
      bytes: Buffer.byteLength(sourceBytes),
    },
    artifacts: {
      html: { sha256: sha256(htmlBytes), bytes: Buffer.byteLength(htmlBytes) },
      svg: { sha256: sha256(svgBytes), bytes: Buffer.byteLength(svgBytes) },
    },
    staticSvg: {
      theme: "dark-first",
      accessible: true,
      externalResources: false,
    },
    reproducible: true,
    visualReview: "pending",
  }, null, 2) + "\n";
}

export async function renderDocumentationDiagram({ rootDir = repositoryRoot, diagram }) {
  const paths = outputPaths(rootDir, diagram);
  const sourceBytes = await readFile(paths.source);
  const sourceSha256 = sha256(sourceBytes);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-archify-render-"));
  try {
    const generatedHtmlPath = path.join(tempDir, `${diagram.id}.html`);
    const validation = requireArchify([
      "validate",
      diagram.type,
      paths.source,
      "--quality",
      "showcase",
      "--json",
    ], { rootDir });
    const validationJson = JSON.parse(validation.stdout);
    if (!validationJson.ok) throw new Error(`Archify validation did not pass for ${diagram.id}`);
    requireArchify([
      "deliver",
      diagram.type,
      paths.source,
      generatedHtmlPath,
      "--quality",
      "showcase",
      "--json",
    ], { rootDir });
    const rawHtml = await readFile(generatedHtmlPath, "utf8");
    const html = withGeneratorMeta(removeRemoteFontLinks(normalizeText(rawHtml)), sourceSha256);
    const svg = createStaticSvg({ html, sourceSha256 });
    const htmlBytes = Buffer.from(html, "utf8");
    const svgBytes = Buffer.from(svg, "utf8");
    const receipt = createReceipt({ diagram, sourceBytes, htmlBytes, svgBytes });
    return {
      diagram,
      paths,
      html,
      svg,
      receipt,
      hashes: {
        source: sourceSha256,
        html: sha256(htmlBytes),
        svg: sha256(svgBytes),
      },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeDiagramArtifacts(artifacts, rootDir) {
  const diagram = artifacts.diagram;
  const finalPaths = outputPaths(rootDir, diagram);
  const stageDir = await mkdtemp(path.join(path.dirname(finalPaths.html), ".archify-stage-"));
  try {
    await stageFile(stageDir, finalPaths.html, artifacts.html);
    await stageFile(stageDir, finalPaths.svg, artifacts.svg);
    await stageFile(stageDir, finalPaths.receipt, artifacts.receipt);
    await rename(path.join(stageDir, path.basename(finalPaths.html)), finalPaths.html);
    await rename(path.join(stageDir, path.basename(finalPaths.svg)), finalPaths.svg);
    await rename(path.join(stageDir, path.basename(finalPaths.receipt)), finalPaths.receipt);
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
  return { paths: finalPaths };
}

export async function generateDocumentationDiagrams({ rootDir = repositoryRoot, check = false } = {}) {
  await inspectArchifyToolchain({ rootDir });
  const manifest = await readDiagramManifest(rootDir);
  const results = [];
  for (const diagram of manifest.diagrams) {
    if (diagram.type !== "workflow") throw new Error(`Unsupported documentation diagram type: ${diagram.type}`);
    const rendered = await renderDocumentationDiagram({ rootDir, diagram });
    const paths = outputPaths(rootDir, diagram);
    if (check) {
      for (const [key, content] of [["html", rendered.html], ["svg", rendered.svg], ["receipt", rendered.receipt]]) {
        const actual = await readFile(paths[key], "utf8").catch(() => null);
        if (actual !== content) throw new Error(`Generated ${key} is stale: ${diagram[key]}`);
      }
    } else {
      await mkdir(path.dirname(paths.html), { recursive: true });
      await writeDiagramArtifacts(rendered, rootDir);
    }
    results.push({ id: diagram.id, check, hashes: rendered.hashes, paths });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  try {
    const results = await generateDocumentationDiagrams({ check });
    console.log(`${check ? "Documentation diagrams are fresh" : "Generated documentation diagrams"}: ${results.map((result) => result.id).join(", ")}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
