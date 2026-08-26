import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scanDocumentationDiagrams } from "../scripts/documentation-diagram-inventory.mjs";

test("inventory classifies active diagram sources, references, and text while ignoring shell arrows", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-diagram-inventory-"));
  try {
    await mkdir(path.join(rootDir, "docs", "assets"), { recursive: true });
    await writeFile(path.join(rootDir, "docs", "legacy.mmd"), "flowchart LR\n  A --> B\n", "utf8");
    await writeFile(path.join(rootDir, "docs", "architecture.md"), [
      "# Architecture",
      "",
      "```mermaid",
      "flowchart LR",
      "  A --> B",
      "```",
      "",
      "![Static flow](./assets/flow.svg)",
      "[Interactive flow](./assets/flow.html)",
      "",
      "├─ request → route",
      "└─ route → evidence",
      "",
      "```bash",
      "echo 'request -> route'",
      "```",
      "",
    ].join("\n"), "utf8");
    await writeFile(path.join(rootDir, "docs", "assets", "flow.svg"), "<svg />\n", "utf8");
    await writeFile(path.join(rootDir, "docs", "assets", "flow.html"), "<!doctype html>\n", "utf8");

    const inventory = await scanDocumentationDiagrams({ rootDir });

    assert.equal(inventory.activeMermaid, true);
    assert.deepEqual(inventory.mermaidSources.map((entry) => entry.path), ["docs/legacy.mmd"]);
    assert.deepEqual(inventory.mermaidFences.map((entry) => ({ path: entry.path, line: entry.line })), [
      { path: "docs/architecture.md", line: 3 },
    ]);
    assert.deepEqual(inventory.imageReferences.map((entry) => entry.target), ["docs/assets/flow.svg"]);
    assert.deepEqual(inventory.htmlDiagramReferences.map((entry) => entry.target), ["docs/assets/flow.html"]);
    assert.deepEqual(inventory.diagramLikeText.map((entry) => entry.line), [11, 12]);
    assert.deepEqual(inventory.unreferencedVisualAssets, []);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

