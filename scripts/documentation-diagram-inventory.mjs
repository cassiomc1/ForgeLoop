#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".forgeloop",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);
const VISUAL_EXTENSIONS = new Set([".gif", ".html", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const MERMAID_EXTENSIONS = new Set([".mmd", ".mermaid"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativePath(rootDir, absolutePath) {
  return toPosix(path.relative(rootDir, absolutePath));
}

function lineNumberAt(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

function isInside(rootDir, candidate) {
  const relative = path.relative(rootDir, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeReference(rootDir, documentPath, target) {
  const trimmed = target.trim().replace(/^<|>$/g, "");
  if (!trimmed || trimmed.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    return null;
  }

  const withoutFragment = trimmed.split(/[?#]/, 1)[0];
  if (!withoutFragment) return null;
  const relativeTarget = withoutFragment.startsWith("/")
    ? withoutFragment.slice(1)
    : path.join(path.dirname(documentPath), withoutFragment);
  const absoluteTarget = path.resolve(rootDir, relativeTarget);
  if (!isInside(rootDir, absoluteTarget)) return null;
  return relativePath(rootDir, absoluteTarget);
}

function extensionOf(target) {
  return path.extname(target.split(/[?#]/, 1)[0]).toLowerCase();
}

async function walkFiles(rootDir, currentDir = rootDir, files = []) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(rootDir, absolutePath, files);
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function pushReference(collection, seen, entry) {
  const key = `${entry.path}:${entry.line}:${entry.target}:${entry.kind ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  collection.push(entry);
}

function collectReferences({ content, documentPath, rootDir, imageReferences, htmlDiagramReferences }) {
  const seenImages = new Set(imageReferences.map((entry) => `${entry.path}:${entry.line}:${entry.target}:${entry.kind ?? ""}`));
  const seenHtml = new Set(htmlDiagramReferences.map((entry) => `${entry.path}:${entry.line}:${entry.target}:${entry.kind ?? ""}`));
  const addTarget = (target, offset, kind, isImage) => {
    const normalized = normalizeReference(rootDir, documentPath, target);
    if (!normalized) return;
    const entry = {
      path: relativePath(rootDir, documentPath),
      line: lineNumberAt(content, offset),
      target: normalized,
      kind,
    };
    if (isImage || VISUAL_EXTENSIONS.has(extensionOf(normalized)) && extensionOf(normalized) !== ".html") {
      pushReference(imageReferences, seenImages, entry);
    }
    if (extensionOf(normalized) === ".html") {
      pushReference(htmlDiagramReferences, seenHtml, entry);
    }
  };

  const markdownImagePattern = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
  for (const match of content.matchAll(markdownImagePattern)) {
    addTarget(match[1] ?? match[2], match.index ?? 0, "markdown-image", true);
  }

  const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
  for (const match of content.matchAll(markdownLinkPattern)) {
    addTarget(match[1] ?? match[2], match.index ?? 0, "markdown-link", false);
  }

  const htmlAttributePattern = /<(?:img|a|object)\b[^>]*\b(src|href|data)=["']([^"']+)["'][^>]*>/gi;
  for (const match of content.matchAll(htmlAttributePattern)) {
    addTarget(match[2], match.index ?? 0, `html-${match[1].toLowerCase()}`, match[1].toLowerCase() === "src");
  }
}

function collectDiagramLikeText({ content, documentPath, rootDir, diagramLikeText }) {
  let inCodeFence = false;
  let fenceLanguage = "";
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const [index, line] of lines.entries()) {
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)/);
    if (fence) {
      if (!inCodeFence) {
        inCodeFence = true;
        fenceLanguage = fence[2].toLowerCase();
      } else if (fence[1][0] === "`" || fenceLanguage) {
        inCodeFence = false;
        fenceLanguage = "";
      }
      continue;
    }
    if (inCodeFence) continue;
    if (!/[├└┌┐┘┬┴│→←↔]|(?:=>|->)/.test(line)) continue;
    if (!line.trim()) continue;
    diagramLikeText.push({
      path: relativePath(rootDir, documentPath),
      line: index + 1,
      text: line.trim(),
    });
  }
}

function isMarkdownFile(filePath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isMermaidSource(filePath) {
  return MERMAID_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function collectVisualAssets(rootDir, files) {
  const assets = [];
  for (const filePath of files) {
    const relative = relativePath(rootDir, filePath);
    if (!relative.startsWith("docs/assets/")) continue;
    if (!VISUAL_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
    assets.push(relative);
  }
  return assets.sort();
}

export async function scanDocumentationDiagrams({ rootDir = repositoryRoot } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const files = await walkFiles(resolvedRoot);
  const markdownFiles = files.filter(isMarkdownFile).sort();
  const mermaidSources = files
    .filter(isMermaidSource)
    .map((filePath) => ({ path: relativePath(resolvedRoot, filePath) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const mermaidFences = [];
  const mermaidReferences = [];
  const imageReferences = [];
  const htmlDiagramReferences = [];
  const diagramLikeText = [];

  for (const filePath of markdownFiles) {
    const content = await readFile(filePath, "utf8");
    const documentPath = relativePath(resolvedRoot, filePath);
    const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    lines.forEach((line, index) => {
      if (/^\s*`{3,}\s*mermaid(?:\s+.*)?$/i.test(line)) {
        mermaidFences.push({ path: documentPath, line: index + 1 });
      }
    });
    collectReferences({ content, documentPath: filePath, rootDir: resolvedRoot, imageReferences, htmlDiagramReferences });
    collectDiagramLikeText({ content, documentPath: filePath, rootDir: resolvedRoot, diagramLikeText });

    const allLinkTargets = content.matchAll(/(?:!\[[^\]]*\]|\[[^\]]+\])\(\s*(?:<([^>]+)>|([^\s)]+))/g);
    for (const match of allLinkTargets) {
      const target = match[1] ?? match[2];
      if (extensionOf(target) === ".mmd" || extensionOf(target) === ".mermaid") {
        mermaidReferences.push({ path: documentPath, line: lineNumberAt(content, match.index ?? 0), target });
      }
    }
  }

  const visualAssets = await collectVisualAssets(resolvedRoot, files);
  const referencedVisualAssets = new Set([
    ...imageReferences.map((entry) => entry.target),
    ...htmlDiagramReferences.map((entry) => entry.target),
  ]);
  const unreferencedVisualAssets = visualAssets.filter((asset) => !referencedVisualAssets.has(asset));

  mermaidFences.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
  mermaidReferences.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
  imageReferences.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.target.localeCompare(right.target));
  htmlDiagramReferences.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.target.localeCompare(right.target));
  diagramLikeText.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);

  return {
    version: 1,
    markdownFiles: markdownFiles.map((filePath) => relativePath(resolvedRoot, filePath)),
    mermaidSources,
    mermaidFences,
    mermaidReferences,
    imageReferences,
    htmlDiagramReferences,
    diagramLikeText,
    visualAssets,
    unreferencedVisualAssets,
    activeMermaid: mermaidSources.length > 0 || mermaidFences.length > 0 || mermaidReferences.length > 0,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const inventory = await scanDocumentationDiagrams();
  if (args.has("--json")) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log(`Documentation diagram inventory: ${inventory.markdownFiles.length} Markdown files, ${inventory.visualAssets.length} visual assets`);
    console.log(`Active Mermaid findings: ${inventory.mermaidSources.length + inventory.mermaidFences.length + inventory.mermaidReferences.length}`);
    console.log(`Unreferenced visual assets: ${inventory.unreferencedVisualAssets.length}`);
  }

  if (args.has("--check") && (inventory.activeMermaid || inventory.unreferencedVisualAssets.length > 0)) {
    if (inventory.activeMermaid) console.error("Active Mermaid sources or references remain in the documentation tree.");
    if (inventory.unreferencedVisualAssets.length > 0) {
      console.error(`Unreferenced visual assets: ${inventory.unreferencedVisualAssets.join(", ")}`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

