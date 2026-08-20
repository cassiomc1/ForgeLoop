import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  }));
  return files.flat();
}

test("runtime mutations use the compare-and-swap state primitive", async () => {
  const excluded = new Set([
    path.join(root, "src/core/work-state.js"),
  ]);
  const violations = [];
  for (const file of await sourceFiles(path.join(root, "src"))) {
    if (excluded.has(file)) continue;
    const source = await readFile(file, "utf8");
    if (/\bwriteWorkState\s*\(/.test(source)) {
      violations.push(path.relative(root, file));
    }
  }
  assert.deepEqual(violations, [], "state updates must use mutateWorkState(expectedRevision, updater)");
});
