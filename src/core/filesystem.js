import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
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

export async function resolveTarget(cwd, requestedPath = ".") {
  const target = path.resolve(cwd, requestedPath);
  let targetStat;
  try {
    targetStat = await stat(target);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Target directory does not exist: ${target}`);
    }
    throw error;
  }

  if (!targetStat.isDirectory()) {
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
      await import("node:fs/promises").then(({ unlink }) => unlink(temporaryPath));
    } catch {
      // Preserve the original filesystem error.
    }
    throw error;
  }
}
