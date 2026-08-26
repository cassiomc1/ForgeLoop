#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ARCHIFY_COMMIT, ARCHIFY_SOURCE, ARCHIFY_VERSION, inspectArchifyToolchain, requireArchify } from "./archify-toolchain.mjs";
import { scanDocumentationDiagrams } from "./documentation-diagram-inventory.mjs";
import { generateDocumentationDiagrams } from "./generate-documentation-diagrams.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestRelativePath = "docs/diagrams/manifest.json";
const sourcePrefix = "docs/diagrams";
const outputPrefix = "docs/assets/diagrams";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveManifestPath(rootDir, value, prefix) {
  if (typeof value !== "string" || path.isAbsolute(value)) throw new Error(`Manifest path must be relative: ${value}`);
  const absolute = path.resolve(rootDir, value);
  const root = path.resolve(rootDir, prefix);
  if (!value.startsWith(`${prefix}/`) || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Manifest path must stay under ${prefix}: ${value}`);
  }
  return absolute;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkHtml(html, diagramId) {
  assert((html.match(/<svg\b/g) ?? []).length === 1, `${diagramId}: HTML must contain one inline SVG`);
  assert(/<svg\b[^>]*\brole="img"/.test(html), `${diagramId}: HTML SVG must expose role=img`);
  assert(/<title\b[^>]*>[^<]+<\/title>/.test(html), `${diagramId}: HTML SVG title is missing`);
  assert(/<desc\b[^>]*>[^<]+<\/desc>/.test(html), `${diagramId}: HTML SVG description is missing`);
  assert(!/<(?:link|script|img|iframe)\b[^>]*(?:href|src)=["']https?:/i.test(html), `${diagramId}: HTML contains an external loaded resource`);
}

function checkSvg(svg, sourceSha256, diagramId) {
  assert((svg.match(/<svg\b/g) ?? []).length === 1, `${diagramId}: static SVG must contain one root SVG`);
  assert(/<svg\b[^>]*\bviewBox="0 0 [0-9.]+ [0-9.]+"/.test(svg), `${diagramId}: static SVG viewBox is missing`);
  assert(/<svg\b[^>]*\brole="img"/.test(svg), `${diagramId}: static SVG role=img is missing`);
  assert(/aria-labelledby="[^"]+"/.test(svg), `${diagramId}: static SVG aria-labelledby is missing`);
  assert(/<title\b[^>]*>[^<]+<\/title>/.test(svg), `${diagramId}: static SVG title is missing`);
  assert(/<desc\b[^>]*>[^<]+<\/desc>/.test(svg), `${diagramId}: static SVG description is missing`);
  assert(/data-theme="dark"/.test(svg), `${diagramId}: static SVG must be dark-first`);
  assert(new RegExp(`data-forgeloop-source-sha256="${sourceSha256}"`).test(svg), `${diagramId}: static SVG source fingerprint is stale`);
  assert(/<style\b[\s\S]*--bg:/.test(svg), `${diagramId}: static SVG must embed its theme CSS`);
  assert(/class="c-bg-rect"/.test(svg), `${diagramId}: static SVG background is missing`);
  assert(!/<script\b/i.test(svg), `${diagramId}: static SVG must not contain scripts`);
  assert(!/<foreignObject\b/i.test(svg), `${diagramId}: static SVG must not contain foreignObject`);
  assert(!/(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg), `${diagramId}: static SVG contains an external resource`);
}

async function checkOneDiagram({ rootDir, diagram }) {
  const sourcePath = resolveManifestPath(rootDir, diagram.source, sourcePrefix);
  const htmlPath = resolveManifestPath(rootDir, diagram.html, outputPrefix);
  const svgPath = resolveManifestPath(rootDir, diagram.svg, outputPrefix);
  const receiptPath = resolveManifestPath(rootDir, diagram.receipt, outputPrefix);
  await Promise.all([access(sourcePath), access(htmlPath), access(svgPath), access(receiptPath)]);

  const sourceBytes = await readFile(sourcePath);
  const htmlBytes = await readFile(htmlPath);
  const svgBytes = await readFile(svgPath);
  const receipt = await readJson(receiptPath);
  const sourceSha256 = sha256(sourceBytes);
  const htmlSha256 = sha256(htmlBytes);
  const svgSha256 = sha256(svgBytes);
  const validation = requireArchify([
    "validate",
    diagram.type,
    sourcePath,
    "--quality",
    "showcase",
    "--json",
  ], { rootDir });
  const validationJson = JSON.parse(validation.stdout);

  assert(validationJson.ok === true, `${diagram.id}: Archify validation failed`);
  assert(receipt.version === 1, `${diagram.id}: receipt version must be 1`);
  assert(receipt.diagramId === diagram.id, `${diagram.id}: receipt id mismatch`);
  assert(receipt.renderer?.name === "archify", `${diagram.id}: receipt renderer mismatch`);
  assert(receipt.renderer?.version === ARCHIFY_VERSION, `${diagram.id}: receipt Archify version mismatch`);
  assert(receipt.renderer?.commit === ARCHIFY_COMMIT, `${diagram.id}: receipt Archify commit mismatch`);
  assert(receipt.renderer?.source === ARCHIFY_SOURCE, `${diagram.id}: receipt Archify source mismatch`);
  assert(receipt.input?.sha256 === sourceSha256, `${diagram.id}: receipt input hash mismatch`);
  assert(receipt.artifacts?.html?.sha256 === htmlSha256, `${diagram.id}: receipt HTML hash mismatch`);
  assert(receipt.artifacts?.svg?.sha256 === svgSha256, `${diagram.id}: receipt SVG hash mismatch`);
  assert(receipt.artifacts?.html?.bytes === htmlBytes.length, `${diagram.id}: receipt HTML byte count mismatch`);
  assert(receipt.artifacts?.svg?.bytes === svgBytes.length, `${diagram.id}: receipt SVG byte count mismatch`);
  assert(receipt.reproducible === true, `${diagram.id}: receipt must mark output reproducible`);
  assert(receipt.staticSvg?.theme === "dark-first", `${diagram.id}: receipt static theme mismatch`);
  assert(receipt.staticSvg?.accessible === true, `${diagram.id}: receipt accessibility flag missing`);
  assert(receipt.staticSvg?.externalResources === false, `${diagram.id}: receipt external-resource flag missing`);
  checkHtml(htmlBytes.toString("utf8"), diagram.id);
  checkSvg(svgBytes.toString("utf8"), sourceSha256, diagram.id);

  return {
    id: diagram.id,
    source: diagram.source,
    html: diagram.html,
    svg: diagram.svg,
    sourceSha256,
    htmlSha256,
    svgSha256,
    composition: validationJson.composition?.status ?? "unknown",
  };
}

export async function checkDocumentationDiagrams({ rootDir = repositoryRoot, reproducible = true } = {}) {
  const root = path.resolve(rootDir);
  const toolchain = await inspectArchifyToolchain({ rootDir: root });
  const manifest = await readJson(path.join(root, manifestRelativePath));
  assert(manifest.version === 1, "Diagram manifest version must be 1");
  assert(manifest.renderer?.name === "archify", "Diagram manifest renderer must be Archify");
  assert(manifest.renderer.version === ARCHIFY_VERSION, "Diagram manifest Archify version is not pinned");
  assert(manifest.renderer.commit === ARCHIFY_COMMIT, "Diagram manifest Archify commit is not pinned");
  assert(manifest.renderer.source === ARCHIFY_SOURCE, "Diagram manifest Archify source is not pinned");
  assert(Array.isArray(manifest.diagrams) && manifest.diagrams.length > 0, "Diagram manifest must list at least one diagram");

  const inventory = await scanDocumentationDiagrams({ rootDir: root });
  assert(inventory.activeMermaid === false, "Active Mermaid sources or fences remain in the documentation tree");
  assert(inventory.unreferencedVisualAssets.length === 0, `Unreferenced visual assets: ${inventory.unreferencedVisualAssets.join(", ")}`);
  const diagrams = [];
  for (const diagram of manifest.diagrams) diagrams.push(await checkOneDiagram({ rootDir: root, diagram }));
  if (reproducible) await generateDocumentationDiagrams({ rootDir: root, check: true });
  return {
    version: 1,
    renderer: toolchain,
    inventory: {
      markdownFiles: inventory.markdownFiles.length,
      visualAssets: inventory.visualAssets.length,
      activeMermaid: inventory.activeMermaid,
      unreferencedVisualAssets: inventory.unreferencedVisualAssets,
    },
    diagrams,
    reproducible,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes("--json");
  const reproducible = !process.argv.includes("--no-reproducibility");
  try {
    const report = await checkDocumentationDiagrams({ reproducible });
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(`Documentation diagrams valid: ${report.diagrams.map((diagram) => diagram.id).join(", ")} (Archify ${ARCHIFY_VERSION})`);
  } catch (error) {
    if (json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    else console.error(error.message);
    process.exitCode = 1;
  }
}

