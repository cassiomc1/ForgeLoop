#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHIFY_VERSION = "2.15.0";
export const ARCHIFY_COMMIT = "e1ac748f19cf805e44bf74fb93c796662152e273";
export const ARCHIFY_SOURCE = "https://github.com/tt-a1i/archify/tree/v2.15.0";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARCHIFY_ROOT = path.join(repositoryRoot, "vendor", "archify", `v${ARCHIFY_VERSION}`, "archify");
export const ARCHIFY_BIN = path.join(ARCHIFY_ROOT, "bin", "archify.mjs");
export const ARCHIFY_PIN_FILE = path.join(ARCHIFY_ROOT, "..", "PIN.json");

export function archifyToolchainPaths(rootDir = repositoryRoot) {
  const root = path.resolve(rootDir);
  const archifyRoot = path.join(root, "vendor", "archify", `v${ARCHIFY_VERSION}`, "archify");
  return {
    root,
    archifyRoot,
    bin: path.join(archifyRoot, "bin", "archify.mjs"),
    pinFile: path.join(archifyRoot, "..", "PIN.json"),
    packageFile: path.join(archifyRoot, "package.json"),
  };
}

async function readPin(paths) {
  const pin = JSON.parse(await readFile(paths.pinFile, "utf8"));
  if (pin.name !== "archify" || pin.version !== ARCHIFY_VERSION || pin.sourceCommit !== ARCHIFY_COMMIT || pin.source !== ARCHIFY_SOURCE || pin.license !== "MIT") {
    throw new Error(`Archify pin mismatch: expected ${ARCHIFY_VERSION} at ${ARCHIFY_COMMIT}`);
  }
  return pin;
}

export async function inspectArchifyToolchain({ rootDir = repositoryRoot } = {}) {
  const paths = archifyToolchainPaths(rootDir);
  await Promise.all([access(paths.bin), access(paths.pinFile), access(paths.packageFile)]);
  const [pin, packageJson] = await Promise.all([
    readPin(paths),
    readFile(paths.packageFile, "utf8").then((content) => JSON.parse(content)),
  ]);
  if (packageJson.name !== "archify" || packageJson.version !== ARCHIFY_VERSION) {
    throw new Error(`Archify package mismatch: expected archify@${ARCHIFY_VERSION}`);
  }
  return {
    name: "archify",
    version: ARCHIFY_VERSION,
    commit: ARCHIFY_COMMIT,
    source: ARCHIFY_SOURCE,
    license: pin.license,
    root: paths.archifyRoot,
    bin: paths.bin,
  };
}

export function runArchify(args, { rootDir = repositoryRoot, stdio = "pipe" } = {}) {
  const paths = archifyToolchainPaths(rootDir);
  const result = spawnSync(process.execPath, [paths.bin, ...args], {
    cwd: paths.root,
    encoding: "utf8",
    stdio,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return {
    ...result,
    status: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    command: [process.execPath, paths.bin, ...args],
  };
}

export function requireArchify(args, options = {}) {
  const result = runArchify(args, options);
  if (result.status !== 0) {
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
    throw new Error(`Archify command failed with exit ${result.status}: ${detail}`);
  }
  return result;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const report = await inspectArchifyToolchain();
  if (!command || command === "version") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!["doctor", "validate", "deliver"].includes(command)) {
    throw new Error("Usage: archify-toolchain.mjs [version|doctor|validate|deliver] [...args]");
  }
  const result = requireArchify([command, ...args]);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

