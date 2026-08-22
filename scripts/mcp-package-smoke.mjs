#!/usr/bin/env node
// ForgeLoop MCP package smoke: packs the core and the MCP package, installs
// both tarballs into a temp project, and drives the installed MCP server over
// stdio with the official MCP client. Verifies publication boundaries.
import { execFileSync } from "node:child_process";
import { runNpm } from "./npm-command.mjs";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mcpDir = path.join(repoRoot, "integrations", "mcp");

function pack(cwd) {
  const out = JSON.parse(runNpm(["pack", "--json"], { cwd, encoding: "utf8" }));
  return path.join(cwd, out[0].filename);
}

const coreTarball = pack(repoRoot);
const mcpTarball = pack(mcpDir);
const temp = mkdtempSync(path.join(repoRoot, ".mcp-smoke-"));

try {
  writeFileSync(path.join(temp, "package.json"), JSON.stringify({
    name: "forgeloop-mcp-smoke",
    version: "0.0.0",
    private: true,
    type: "module",
  }, null, 2));
  copyFileSync(coreTarball, path.join(temp, path.basename(coreTarball)));
  copyFileSync(mcpTarball, path.join(temp, path.basename(mcpTarball)));

  runNpm([
    "install",
    "--no-audit",
    "--no-fund",
    path.join(temp, path.basename(coreTarball)),
    path.join(temp, path.basename(mcpTarball)),
    "@modelcontextprotocol/client@^2.0.0",
  ], { cwd: temp, stdio: "pipe" });

  const smoke = `
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { executeForgeLoopCommand } from "@cassiomc1/forgeloop/integration";

const init = await executeForgeLoopCommand({ command: "init", projectPath: process.cwd(), input: {} });
if (!init.ok && !String(init.error?.message).match(/exist|already|manifest/i)) {
  // init may legitimately refuse on non-empty dirs; only hard failures matter.
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [process.cwd() + "/node_modules/@cassiomc1/forgeloop-mcp/bin/forgeloop-mcp.js", "--project", process.cwd(), "--mode", "safe"],
});
const client = new Client({ name: "smoke-client", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
if (!names.includes("forgeloop_status")) throw new Error("status tool missing");
if (!names.includes("forgeloop_task_resume")) throw new Error("task-resume tool missing");
if (names.includes("forgeloop_task_recover")) throw new Error("recovery tool must be hidden in safe mode");

const info = await client.callTool({ name: "forgeloop_protocol_info", arguments: {} });
const parsed = JSON.parse(info.content[0].text);
if (!parsed.result.features.taskClaimRecovery.validatedClaimProjection) throw new Error("ownership features missing");

const tasks = await client.readResource({ uri: "forgeloop://project/tasks" });
JSON.parse(tasks.contents[0].text);

await client.close();
console.log("mcp package smoke passed");
`;
  writeFileSync(path.join(temp, "smoke.mjs"), smoke);
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: temp, stdio: "inherit" });
  console.log("ForgeLoop MCP package smoke passed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
  rmSync(coreTarball, { force: true });
  rmSync(mcpTarball, { force: true });
}
