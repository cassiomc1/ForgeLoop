#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repositoryRoot, "docs", "forgeloop-flow.mmd");
const outputPath = path.join(repositoryRoot, "docs", "assets", "forgeloop-flow.svg");
const binaryName = process.platform === "win32" ? "mmdc.cmd" : "mmdc";
const mermaidCli = path.join(repositoryRoot, "node_modules", ".bin", binaryName);

if (!existsSync(sourcePath)) {
  console.error(`Refusing to render: missing Mermaid source ${sourcePath}`);
  process.exitCode = 1;
} else if (!existsSync(mermaidCli)) {
  console.error(`Refusing to render: Mermaid CLI is not installed at ${mermaidCli}`);
  process.exitCode = 1;
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const result = spawnSync(
    mermaidCli,
    ["-i", sourcePath, "-o", outputPath, "-t", "dark", "-b", "transparent"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );
  if (result.error) {
    console.error(`Mermaid render failed: ${result.error.message}`);
    process.exitCode = 1;
  } else if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    console.log(`Generated ${path.relative(repositoryRoot, outputPath)} from ${path.relative(repositoryRoot, sourcePath)}`);
  }
}
