#!/usr/bin/env node
import { installLockedMcp } from "./mcp-locked-install.mjs";
// Installs local dependencies for the ForgeLoop MCP package using a locally
// packed ForgeLoop core tarball (the core is not published from this repo
// without separate authorization). Safe to re-run.
import { runNpm } from "./npm-command.mjs";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mcpDir = path.join(repoRoot, "integrations", "mcp");

const packOutput = JSON.parse(runNpm(["pack", "--json"], { cwd: repoRoot, encoding: "utf8" }));
const tarballName = packOutput[0].filename;
const tarballPath = path.join(repoRoot, tarballName);

const temp = mkdtempSync(path.join(mcpDir, ".core-tarball-"));
try {
  copyFileSync(tarballPath, path.join(temp, tarballName));
  installLockedMcp({ target: mcpDir, tarballs: [path.join(temp, tarballName)] });
  console.log("ForgeLoop MCP dependencies installed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
