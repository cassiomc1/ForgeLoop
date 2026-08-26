#!/usr/bin/env node

import { access, lstat, readFile, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VendorIntegrityError,
  verifyVendorTreeIntegrity,
} from "./vendor-tree-integrity.mjs";

export const ARCHIFY_VERSION = "2.15.0";
export const ARCHIFY_COMMIT = "e1ac748f19cf805e44bf74fb93c796662152e273";
export const ARCHIFY_SOURCE = "https://github.com/tt-a1i/archify/tree/v2.15.0";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARCHIFY_ROOT = path.join(repositoryRoot, "vendor", "archify", `v${ARCHIFY_VERSION}`, "archify");
export const ARCHIFY_BIN = path.join(ARCHIFY_ROOT, "bin", "archify.mjs");
export const ARCHIFY_PIN_FILE = path.join(ARCHIFY_ROOT, "..", "PIN.json");

const ARCHIFY_SOURCE_ROOT = "docs/diagrams";
const ARCHIFY_OUTPUT_ROOT = "docs/assets/diagrams";

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

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function invocationError(code, message, details = {}) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function realpathOrThrow(candidate, code, label) {
  try {
    return await realpath(candidate);
  } catch (error) {
    throw invocationError(code, `${label} does not exist or cannot be resolved`, { cause: error });
  }
}

async function nearestExistingPath(candidate, code, label) {
  let current = candidate;
  while (true) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw invocationError(code, `${label} cannot be resolved`, { cause: error });
      }
      const parent = path.dirname(current);
      if (parent === current) {
        throw invocationError(code, `${label} cannot be resolved`, { cause: error });
      }
      current = parent;
    }
  }
}

async function resolveContainedPath(inputPath, {
  rootDir,
  boundaryRelative,
  code,
  label,
  mustExist,
  mustBeFile = false,
} = {}) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") {
    throw invocationError(code, `${label} path is required`);
  }
  const root = path.resolve(rootDir);
  const rootReal = await realpathOrThrow(root, code, "Archify repository root");
  const boundary = path.resolve(root, boundaryRelative);
  const candidate = path.resolve(root, inputPath);
  if (!isInside(boundary, candidate)) {
    throw invocationError(code, `${label} must remain under ${boundaryRelative}`, { inputPath });
  }

  const boundaryReal = await realpathOrThrow(boundary, code, `${label} boundary`);
  if (!isInside(rootReal, boundaryReal)) {
    throw invocationError("E_ARCHIFY_PATH_SYMLINK", `${label} boundary escapes the repository`, { inputPath });
  }

  const existing = mustExist
    ? candidate
    : await nearestExistingPath(candidate, code, label);
  const existingReal = await realpathOrThrow(existing, code, label);
  if (!isInside(boundaryReal, existingReal)) {
    throw invocationError("E_ARCHIFY_PATH_SYMLINK", `${label} resolves outside ${boundaryRelative}`, { inputPath });
  }

  if (mustExist) {
    const info = await lstat(candidate).catch((error) => {
      throw invocationError(code, `${label} does not exist`, { inputPath, cause: error });
    });
    if (mustBeFile && !info.isFile()) {
      throw invocationError(code, `${label} must be a regular file`, { inputPath });
    }
  }

  return {
    inputPath,
    absolutePath: candidate,
    realPath: mustExist ? await realpathOrThrow(candidate, code, label) : existingReal,
  };
}

export async function validateArchifyInvocation(command, args, { rootDir = repositoryRoot } = {}) {
  if (!Array.isArray(args)) {
    throw invocationError("E_ARCHIFY_INVOCATION", "arguments must be an array");
  }
  if (command === "doctor") {
    if (args.some((argument) => typeof argument !== "string" || !argument.startsWith("-"))) {
      throw invocationError("E_ARCHIFY_INVOCATION", "doctor accepts flags but no positional arguments");
    }
    return [...args];
  }
  if (command !== "validate" && command !== "deliver") {
    throw invocationError("E_ARCHIFY_INVOCATION", `unsupported wrapper command: ${command}`);
  }

  const minimumArguments = command === "validate" ? 2 : 3;
  if (args.length < minimumArguments) {
    throw invocationError("E_ARCHIFY_INVOCATION", `${command} requires ${command === "validate" ? "<type> <source>" : "<type> <source> <output>"}`);
  }
  if (typeof args[0] !== "string" || args[0].trim() === "" || args[0].startsWith("-")) {
    throw invocationError("E_ARCHIFY_INVOCATION", `${command} requires a diagram type before flags`);
  }

  await resolveContainedPath(args[1], {
    rootDir,
    boundaryRelative: ARCHIFY_SOURCE_ROOT,
    code: "E_ARCHIFY_PATH_SOURCE",
    label: "Archify source",
    mustExist: true,
    mustBeFile: true,
  });
  if (command === "deliver") {
    await resolveContainedPath(args[2], {
      rootDir,
      boundaryRelative: ARCHIFY_OUTPUT_ROOT,
      code: "E_ARCHIFY_PATH_OUTPUT",
      label: "Archify output",
      mustExist: false,
    });
    const outputPath = path.resolve(rootDir, args[2]);
    try {
      if ((await lstat(outputPath)).isDirectory()) {
        throw invocationError("E_ARCHIFY_PATH_OUTPUT", "Archify output must be a file", { inputPath: args[2] });
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return [...args];
}

async function readPin(paths) {
  let pin;
  try {
    pin = JSON.parse(await readFile(paths.pinFile, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Archify PIN.json is not valid JSON");
    }
    throw error;
  }
  if (pin.name !== "archify" || pin.version !== ARCHIFY_VERSION || pin.sourceCommit !== ARCHIFY_COMMIT || pin.source !== ARCHIFY_SOURCE || pin.license !== "MIT") {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_PIN_INVALID",
      `Archify pin mismatch: expected ${ARCHIFY_VERSION} at ${ARCHIFY_COMMIT}`,
    );
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
  const integrity = await verifyVendorTreeIntegrity(paths.archifyRoot, pin.integrity);
  return {
    name: "archify",
    version: ARCHIFY_VERSION,
    commit: ARCHIFY_COMMIT,
    source: ARCHIFY_SOURCE,
    license: pin.license,
    root: paths.archifyRoot,
    bin: paths.bin,
    integrityVerified: true,
    treeSha256: integrity.treeSha256,
    fileCount: integrity.fileCount,
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
  const safeArgs = await validateArchifyInvocation(command, args, { rootDir: repositoryRoot });
  const result = requireArchify([command, ...safeArgs]);
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
