import { randomUUID } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export function ensureWithin(root, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Path must remain inside target directory: ${relativePath}`);
  }

  const normalized = path.normalize(relativePath);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`Path escapes target directory: ${relativePath}`);
  }

  return path.join(root, normalized);
}

export async function assertSafePath(root, relativePath) {
  const destination = ensureWithin(root, relativePath);
  const absoluteRoot = path.resolve(root);
  const rootInfo = await lstat(absoluteRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error(`Target directory must not be a symlink: ${absoluteRoot}`);
  }

  let current = absoluteRoot;
  const segments = path.relative(absoluteRoot, destination).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new Error(`Path uses a symlink inside target directory: ${relativePath}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }

  let existing = destination;
  while (true) {
    try {
      const info = await lstat(existing);
      if (info.isSymbolicLink()) {
        throw new Error(`Path uses a symlink inside target directory: ${relativePath}`);
      }
      const resolvedRoot = await realpath(absoluteRoot);
      const resolvedExisting = await realpath(existing);
      const relativeResolved = path.relative(resolvedRoot, resolvedExisting);
      if (relativeResolved === ".." || relativeResolved.startsWith(`..${path.sep}`) || path.isAbsolute(relativeResolved)) {
        throw new Error(`Path escapes target directory: ${relativePath}`);
      }
      return destination;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw new Error(`Path does not resolve inside target directory: ${relativePath}`);
      existing = parent;
    }
  }
}

export async function resolveTarget(cwd, requestedPath = ".") {
  const target = path.resolve(cwd, requestedPath);
  let targetStat;
  try {
    targetStat = await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Target directory does not exist: ${target}`);
    }
    throw error;
  }

  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    throw new Error(`Target path is not a directory: ${target}`);
  }

  return target;
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function readBytes(filePath) {
  return readFile(filePath);
}

export async function writeFileAtomic(filePath, bytes, { dryRun = false } = {}) {
  if (dryRun) return;

  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, bytes, { mode: 0o644 });
    await rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch {
      // Preserve the original filesystem error.
    }
    throw error;
  }
}
