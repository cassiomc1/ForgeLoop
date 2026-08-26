#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const VENDOR_INTEGRITY_ALGORITHM = "sha256";
export const VENDOR_INTEGRITY_IGNORED_BASENAMES = Object.freeze([".DS_Store"]);

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export class VendorIntegrityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "VendorIntegrityError";
    this.code = code;
    Object.assign(this, details);
  }
}

function sha256(value) {
  return createHash(VENDOR_INTEGRITY_ALGORITHM).update(value).digest("hex");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function compareCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertRoot(rootDir) {
  if (typeof rootDir !== "string" || rootDir.trim() === "") {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity root must be a non-empty path");
  }
  return path.resolve(rootDir);
}

function isIgnored(relativePath, ignoredBasenames) {
  return ignoredBasenames.has(path.posix.basename(relativePath));
}

async function enumerateFiles(rootDir, ignoredBasenames) {
  const files = [];

  const rootInfo = await lstat(rootDir);
  if (rootInfo.isSymbolicLink()) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_SYMLINK",
      `Vendor integrity rejects a symlinked root: ${rootDir}`,
    );
  }
  if (!rootInfo.isDirectory()) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_FILE_SET",
      `Vendor integrity root is not a directory: ${rootDir}`,
    );
  }

  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareCodePoint(left.name, right.name));

    for (const entry of entries) {
      const relativePath = toPosix(path.join(relativeDirectory, entry.name));
      if (isIgnored(relativePath, ignoredBasenames)) continue;

      const absolutePath = path.join(directory, entry.name);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink()) {
        throw new VendorIntegrityError(
          "E_VENDOR_INTEGRITY_SYMLINK",
          `Vendor integrity rejects symlinked entry: ${relativePath}`,
          { relativePath },
        );
      }
      if (info.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      if (!info.isFile()) {
        throw new VendorIntegrityError(
          "E_VENDOR_INTEGRITY_FILE_SET",
          `Vendor integrity found unsupported entry type: ${relativePath}`,
          { relativePath },
        );
      }
      files.push({ relativePath, absolutePath });
    }
  }

  await visit(rootDir, "");
  files.sort((left, right) => compareCodePoint(left.relativePath, right.relativePath));
  return files;
}

function normalizeIgnoredBasenames(options = {}) {
  const values = options.ignoredBasenames ?? VENDOR_INTEGRITY_IGNORED_BASENAMES;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value === "")) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity ignored basenames must be non-empty strings");
  }
  const normalized = new Set(values);
  if (normalized.size !== 1 || !normalized.has(".DS_Store")) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_PIN_INVALID",
      "Vendor integrity may ignore only .DS_Store",
    );
  }
  return normalized;
}

export async function computeVendorTreeIntegrity(rootDir, options = {}) {
  const root = assertRoot(rootDir);
  const ignoredBasenames = normalizeIgnoredBasenames(options);
  const files = await enumerateFiles(root, ignoredBasenames);
  const entries = [];

  for (const file of files) {
    const digest = sha256(await readFile(file.absolutePath));
    entries.push([file.relativePath, digest]);
  }

  const fileMap = Object.fromEntries(entries);
  const treeInput = entries.map(([relativePath, digest]) => `${relativePath}\0${digest}\n`).join("");
  return {
    algorithm: VENDOR_INTEGRITY_ALGORITHM,
    treeSha256: sha256(Buffer.from(treeInput, "utf8")),
    fileCount: entries.length,
    files: fileMap,
  };
}

function assertExpectedIntegrity(expected) {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity pin must be an object");
  }
  if (expected.algorithm !== VENDOR_INTEGRITY_ALGORITHM
    || !Number.isInteger(expected.fileCount)
    || expected.fileCount < 0
    || !HASH_PATTERN.test(expected.treeSha256 ?? "")
    || !expected.files
    || typeof expected.files !== "object"
    || Array.isArray(expected.files)) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity pin has an invalid shape");
  }
  const filePaths = Object.keys(expected.files);
  if (filePaths.some((relativePath) => !relativePath || path.posix.normalize(relativePath) !== relativePath || path.posix.isAbsolute(relativePath))) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity pin contains an invalid relative path");
  }
  if (filePaths.some((relativePath) => !HASH_PATTERN.test(expected.files[relativePath]))) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity pin contains an invalid file hash");
  }
  if (expected.fileCount !== filePaths.length) {
    throw new VendorIntegrityError("E_VENDOR_INTEGRITY_PIN_INVALID", "Vendor integrity pin file count does not match its file map");
  }
  return expected;
}

function sortedKeys(value) {
  return Object.keys(value).sort(compareCodePoint);
}

export async function verifyVendorTreeIntegrity(rootDir, expected) {
  const pin = assertExpectedIntegrity(expected);
  const actual = await computeVendorTreeIntegrity(rootDir);
  const expectedPaths = sortedKeys(pin.files);
  const actualPaths = sortedKeys(actual.files);
  const added = actualPaths.filter((relativePath) => !Object.hasOwn(pin.files, relativePath));
  const removed = expectedPaths.filter((relativePath) => !Object.hasOwn(actual.files, relativePath));
  if (added.length > 0 || removed.length > 0 || actual.fileCount !== pin.fileCount) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_FILE_SET",
      `Vendor integrity file set mismatch (added: ${added.join(", ") || "none"}; removed: ${removed.join(", ") || "none"})`,
      { added, removed, expectedFileCount: pin.fileCount, actualFileCount: actual.fileCount },
    );
  }

  const mismatched = expectedPaths.filter((relativePath) => actual.files[relativePath] !== pin.files[relativePath]);
  if (mismatched.length > 0) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_FILE_HASH",
      `Vendor integrity file hash mismatch: ${mismatched.join(", ")}`,
      { paths: mismatched },
    );
  }
  if (actual.treeSha256 !== pin.treeSha256) {
    throw new VendorIntegrityError(
      "E_VENDOR_INTEGRITY_TREE_HASH",
      `Vendor integrity tree hash mismatch: expected ${pin.treeSha256}, got ${actual.treeSha256}`,
      { expectedTreeSha256: pin.treeSha256, actualTreeSha256: actual.treeSha256 },
    );
  }
  return actual;
}
