#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ARCHIFY_COMMIT, ARCHIFY_SOURCE, ARCHIFY_VERSION, inspectArchifyToolchain } from "./archify-toolchain.mjs";
import {
  rendererForDiagramType,
  validateDiagramManifestFiles,
} from "./documentation-diagram-manifest.mjs";
import { scanDocumentationDiagrams } from "./documentation-diagram-inventory.mjs";
import { readDiagramManifest, renderDocumentationDiagram } from "./generate-documentation-diagrams.mjs";
import { validateDiagramReview } from "./documentation-diagram-review.mjs";

export { validateDiagramReview } from "./documentation-diagram-review.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  assert(/<html\b[^>]*\bdata-theme="dark"/.test(html), `${diagramId}: HTML must default to the dark theme`);
  assert(/<html\b[^>]*\bdata-present="true"/.test(html), `${diagramId}: HTML must contain the presentation marker`);
  assert(/<svg\b[^>]*\bdata-animation="trace"/.test(html), `${diagramId}: HTML must expose trace animation`);
  assert(/data-animate="edge"/.test(html), `${diagramId}: HTML must contain animated edges`);
  assert(/@keyframes\s+archify-edge-flow/.test(html), `${diagramId}: HTML trace keyframes are missing`);
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
  assert(/<svg\b[^>]*\bdata-animation="trace"/.test(svg), `${diagramId}: SVG must expose trace animation`);
  assert(/data-animate="edge"/.test(svg), `${diagramId}: SVG must contain animated edges`);
  assert(new RegExp(`data-forgeloop-source-sha256="${sourceSha256}"`).test(svg), `${diagramId}: static SVG source fingerprint is stale`);
  assert(/<style\b[\s\S]*--bg:/.test(svg), `${diagramId}: static SVG must embed its theme CSS`);
  assert(/class="c-bg-rect"/.test(svg), `${diagramId}: static SVG background is missing`);
  assert(!/<script\b/i.test(svg), `${diagramId}: static SVG must not contain scripts`);
  assert(!/<foreignObject\b/i.test(svg), `${diagramId}: static SVG must not contain foreignObject`);
  assert(!/\sdata-(?:detail-anchor|legend(?:-bridge)?)(?=\s|\/?>)/.test(svg), `${diagramId}: static SVG contains unquoted boolean attributes`);
  assert(!/(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg), `${diagramId}: static SVG contains an external resource`);
}

async function checkOneDiagram({ rootDir, diagram }) {
  const sourcePath = resolveManifestPath(rootDir, diagram.source, sourcePrefix);
  const htmlPath = resolveManifestPath(rootDir, diagram.html, outputPrefix);
  const svgPath = resolveManifestPath(rootDir, diagram.svg, outputPrefix);
  const receiptPath = resolveManifestPath(rootDir, diagram.receipt, outputPrefix);
  const reviewPath = resolveManifestPath(rootDir, diagram.review, "docs/diagrams/reviews");

  const sourceBytes = await readFile(sourcePath);
  const htmlBytes = await readFile(htmlPath);
  const svgBytes = await readFile(svgPath);
  const receipt = await readJson(receiptPath);
  const sourceSha256 = sha256(sourceBytes);
  const htmlSha256 = sha256(htmlBytes);
  const svgSha256 = sha256(svgBytes);
  const renderer = rendererForDiagramType(diagram.type);

  let review;
  let reviewBytes;
  try {
    reviewBytes = await readFile(reviewPath, "utf8");
  } catch (error) {
    const reviewError = new Error(`E_DIAGRAM_REVIEW_MISSING: ${diagram.review}`);
    reviewError.code = "E_DIAGRAM_REVIEW_MISSING";
    reviewError.cause = error;
    throw reviewError;
  }
  try {
    review = JSON.parse(reviewBytes);
  } catch (error) {
    const reviewError = new Error(`E_DIAGRAM_REVIEW_INVALID: ${diagram.review}`);
    reviewError.code = "E_DIAGRAM_REVIEW_INVALID";
    reviewError.cause = error;
    throw reviewError;
  }
  validateDiagramReview(review, {
    diagramId: diagram.id,
    sourceSha256,
    svgSha256,
  });

  const rendered = await renderDocumentationDiagram({ rootDir, diagram });
  assert(Buffer.from(rendered.html, "utf8").equals(htmlBytes), `${diagram.id}: generated HTML is stale: ${diagram.html}`);
  assert(Buffer.from(rendered.svg, "utf8").equals(svgBytes), `${diagram.id}: generated SVG is stale: ${diagram.svg}`);
  assert(rendered.receipt === (await readFile(receiptPath, "utf8")), `${diagram.id}: generated receipt is stale: ${diagram.receipt}`);
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
  assert(!Object.hasOwn(receipt, "visualReview"), `${diagram.id}: review state must be stored separately`);
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
    composition: rendered.composition ?? "unknown",
    renderer: renderer.validateType,
  };
}

export async function checkDocumentationDiagrams({ rootDir = repositoryRoot, reproducible = true } = {}) {
  const root = path.resolve(rootDir);
  const toolchain = await inspectArchifyToolchain({ rootDir: root });
  const manifest = await readDiagramManifest(root);
  try {
    await validateDiagramManifestFiles(manifest, { rootDir: root });
  } catch (error) {
    const missingReview = manifest.diagrams.find((diagram) => error.value === diagram.review);
    if (missingReview) {
      const reviewError = new Error(`E_DIAGRAM_REVIEW_MISSING: ${missingReview.review}`);
      reviewError.code = "E_DIAGRAM_REVIEW_MISSING";
      reviewError.cause = error;
      throw reviewError;
    }
    throw error;
  }

  const inventory = await scanDocumentationDiagrams({ rootDir: root, manifest });
  assert(inventory.activeMermaid === false, "Active Mermaid sources or fences remain in the documentation tree");
  assert(inventory.unreferencedVisualAssets.length === 0, `Unreferenced visual assets: ${inventory.unreferencedVisualAssets.join(", ")}`);
  assert(inventory.orphanedDiagramArtifacts.length === 0, `Orphaned diagram artifacts: ${inventory.orphanedDiagramArtifacts.join(", ")}`);
  const diagrams = [];
  for (const diagram of manifest.diagrams) diagrams.push(await checkOneDiagram({ rootDir: root, diagram }));
  return {
    version: 2,
    renderer: toolchain,
    policy: manifest.policy,
    inventory: {
      markdownFiles: inventory.markdownFiles.length,
      visualAssets: inventory.visualAssets.length,
      activeMermaid: inventory.activeMermaid,
      unreferencedVisualAssets: inventory.unreferencedVisualAssets,
      orphanedDiagramArtifacts: inventory.orphanedDiagramArtifacts,
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
