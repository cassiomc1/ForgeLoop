#!/usr/bin/env node
import { readdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

async function readReceipt(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function auditReceipts({ root, execute = (args) => spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" }) }) {
  const tasks = new Set();
  let legacy = false;
  const singleton = await readReceipt(path.join(root, ".forgeloop/execution-receipt.json"));
  if (singleton) legacy = true;
  let entries = [];
  try { entries = await readdir(path.join(root, ".forgeloop/task-state"), { withFileTypes: true }); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const receipt = await readReceipt(path.join(root, ".forgeloop/task-state", entry.name, "execution-receipt.json"));
    if (!receipt) continue;
    if (typeof receipt.taskId !== "string" || !receipt.taskId.trim()) throw new Error(`Receipt ${entry.name} has no task identity`);
    const { taskDirectory } = await import("../src/core/task-paths.js");
    if (path.basename(taskDirectory(receipt.taskId)) !== entry.name) throw new Error(`Receipt ${entry.name} has a mismatched task identity`);
    tasks.add(receipt.taskId);
  }
  const commands = [...tasks].sort().map((task) => ["src/cli.js", "audit", "--strict", "--task", task]);
  if (legacy) commands.unshift(["src/cli.js", "audit", "--strict"]);
  if (!commands.length) return { status: "NOT_VERIFIED", reason: "No ForgeLoop receipt was supplied to this checkout", audited: 0 };
  for (const args of commands) {
    const result = await execute(args);
    if (result.status !== 0) throw new Error(`Receipt audit failed: ${JSON.stringify(args)} (${result.status ?? result.error?.message})`);
  }
  return { status: "VERIFIED", audited: commands.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditReceipts({ root: process.cwd() });
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `ForgeLoop receipt audit: **${result.status}**. ${result.reason ?? `${result.audited} receipts audited.`}\n`);
}
