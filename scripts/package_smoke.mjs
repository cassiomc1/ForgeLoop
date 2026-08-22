#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmOptions = process.platform === "win32" ? { shell: true } : {};
const root = process.cwd();
let tarball = null;
let target = null;

try {
  const { stdout } = await run(npm, ["pack", "--json"], { cwd: root, ...npmOptions });
  const packed = JSON.parse(stdout);
  tarball = path.resolve(root, packed[0].filename);
  target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-package-smoke-"));
  await writeFile(path.join(target, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await run(npm, ["install", "--ignore-scripts", "--no-package-lock", tarball], { cwd: target, ...npmOptions });
  const packageName = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).name;
  const installedRoot = path.join(target, "node_modules", ...packageName.split("/"));
  const { stdout: info } = await run(process.execPath, [path.join(installedRoot, "src", "cli.js"), "protocol-info", "--json"], { cwd: target });
  const parsed = JSON.parse(info);
  if (parsed.protocolVersion !== 1
    || !Array.isArray(parsed.commands)
    || parsed.features?.taskClaimRecovery?.validatedClaimProjection !== true
    || !parsed.readsSchemaVersions?.["task-recovery"]?.includes(1)) {
    throw new Error("Installed package did not return a valid ForgeLoop protocol handshake");
  }
  const recoveryCore = await import(pathToFileURL(path.join(installedRoot, "src", "core", "recovery-history.js")));
  const history = recoveryCore.classifyRecoveryHistory([
    { seq: 1, event: "OPERATOR_RECOVERY_RECORDED", details: { recoveryId: "recovery-smoke" } },
    { seq: 2, event: "TASK_RECOVERY_RESUMED", details: { recoveryId: "recovery-smoke" } },
  ]);
  if (!history.valid || history.completedRecoveries.length !== 1 || history.activeRecovery !== null) {
    throw new Error("Installed package did not preserve validated recovery history behavior");
  }
  console.log(`package smoke passed: ${packed[0].filename}`);
} finally {
  if (target) await rm(target, { recursive: true, force: true });
  if (tarball) await rm(tarball, { force: true });
}
