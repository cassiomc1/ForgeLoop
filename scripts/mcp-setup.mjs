#!/usr/bin/env node
// Installs local dependencies for the ForgeLoop MCP package using a locally
// packed ForgeLoop core tarball (the core is not published from this repo
// without separate authorization). Safe to re-run.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mcpDir = path.join(repoRoot, "integrations", "mcp");

const packOutput = JSON.parse(execFileSync("npm", ["pack", "--json"], { cwd: repoRoot, encoding: "utf8" }));
const tarballName = packOutput[0].filename;
const tarballPath = path.join(repoRoot, tarballName);

const temp = mkdtempSync(path.join(mcpDir, ".core-tarball-"));
try {
  copyFileSync(tarballPath, path.join(temp, tarballName));
  execFileSync("npm", [
    "install","--no-save",
    "--no-audit",
    "--no-fund",
    path.join(temp, tarballName),
    "@modelcontextprotocol/server@^2.0.0",
    "@modelcontextprotocol/client@^2.0.0",
  ], { cwd: mcpDir, stdio: "inherit" });
  console.log("ForgeLoop MCP dependencies installed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
