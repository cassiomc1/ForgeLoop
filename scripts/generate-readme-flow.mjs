#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repositoryRoot, "docs", "forgeloop-flow.mmd");
const outputArgumentIndex = process.argv.indexOf("--output");
const outputArgument = outputArgumentIndex === -1 ? null : process.argv[outputArgumentIndex + 1];
const outputPath = outputArgument
  ? path.resolve(repositoryRoot, outputArgument)
  : path.join(repositoryRoot, "docs", "assets", "forgeloop-flow.svg");
const binaryName = process.platform === "win32" ? "mmdc.cmd" : "mmdc";
const mermaidCli = path.join(repositoryRoot, "node_modules", ".bin", binaryName);
const puppeteerCiConfig = path.join(repositoryRoot, "scripts", "mermaid-puppeteer-ci.json");
const puppeteerArgs = process.platform === "linux" && process.env.CI === "true"
  ? ["--puppeteerConfigFile", puppeteerCiConfig]
  : [];

if (!existsSync(sourcePath)) {
  console.error(`Refusing to render: missing Mermaid source ${sourcePath}`);
  process.exitCode = 1;
} else if (outputArgumentIndex !== -1 && (!outputArgument || outputArgument.startsWith("-"))) {
  console.error("Refusing to render: --output requires a file path");
  process.exitCode = 1;
} else if (!existsSync(mermaidCli)) {
  console.error(`Refusing to render: Mermaid CLI is not installed at ${mermaidCli}`);
  process.exitCode = 1;
} else {
  const source = await readFile(sourcePath, "utf8");
  const sourceFingerprint = createHash("sha256").update(source).digest("hex");
  await mkdir(path.dirname(outputPath), { recursive: true });
  const result = spawnSync(
    mermaidCli,
    ["-i", sourcePath, "-o", outputPath, "-t", "dark", "-b", "transparent", ...puppeteerArgs],
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
    const rendered = await readFile(outputPath, "utf8");
    const stamped = rendered.replace(
      /<svg\b/,
      `<svg data-forgeloop-source-sha256="${sourceFingerprint}"`,
    );
    if (stamped === rendered) {
      console.error(`Refusing to stamp: Mermaid output is not an SVG document at ${outputPath}`);
      process.exitCode = 1;
    } else {
      await writeFile(outputPath, stamped);
      console.log(`Generated ${path.relative(repositoryRoot, outputPath)} from ${path.relative(repositoryRoot, sourcePath)}`);
    }
  }
}
