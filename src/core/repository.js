import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const GIT_EXECUTION_OPTIONS = Object.freeze({
  windowsHide: true,
  maxBuffer: 64 * 1024 * 1024,
});

function repositoryError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

async function runGit(target, args, { binary = false } = {}) {
  try {
    const result = await execFileAsync("git", ["-C", target, ...args], {
      ...GIT_EXECUTION_OPTIONS,
      ...(binary ? { encoding: "buffer" } : {}),
    });
    return result.stdout;
  } catch (error) {
    throw repositoryError(
      "E_REPOSITORY_GIT_COMMAND_FAILED",
      `Git command failed (${args.join(" ")}): ${String(error.stderr ?? error.message).trim()}`,
      error,
    );
  }
}

function text(value) {
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? "");
}

function assertRepositoryPath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0
    || relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(relativePath)
    || /[\u0000-\u001f\u007f]/u.test(relativePath) || relativePath.includes("\\")) {
    throw repositoryError("E_REVISION_CONTENT_UNAVAILABLE", "Repository path must be a non-empty relative path");
  }
  const normalized = path.posix.normalize(relativePath);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized !== relativePath) {
    throw repositoryError("E_REVISION_CONTENT_UNAVAILABLE", `Repository path escapes the target: ${relativePath}`);
  }
  return normalized;
}

function isGitNotFound(error) {
  return error?.code === 128
    || error?.cause?.code === 128
    || error?.cause?.cause?.code === 128;
}

function assertRevision(value, label = "revision") {
  if (typeof value !== "string" || !value.trim() || value.startsWith("-") || value.includes("\0") || /\s/u.test(value)) {
    throw repositoryError("E_REVISION_NOT_FOUND", `${label} must be a non-empty opaque revision identifier`);
  }
  return value;
}

function parseNameStatusZ(output) {
  const tokens = text(output).split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const statusToken = tokens[index];
    const status = statusToken.slice(0, 1);
    const score = statusToken.slice(1);
    if (["R", "C"].includes(status)) {
      const sourcePath = assertRepositoryPath(tokens[index + 1] ?? "");
      const filePath = assertRepositoryPath(tokens[index + 2] ?? "");
      entries.push({
        path: filePath,
        sourcePath,
        status,
        score: score ? Number(score) : null,
      });
      index += 2;
    } else {
      const embeddedPath = statusToken.length > 1 ? statusToken.slice(1).replace(/^\t/u, "") : null;
      const pathToken = embeddedPath || tokens[++index] || "";
      entries.push({
        path: assertRepositoryPath(pathToken),
        sourcePath: null,
        status,
        score: score ? Number(score) : null,
      });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function parseStatusZ(output) {
  const tokens = text(output).split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const item = tokens[index];
    const status = item.slice(0, 2);
    const firstPath = item.slice(3).replace(/^\t/u, "");
    if (status.includes("R") || status.includes("C")) {
      const sourcePath = assertRepositoryPath(tokens[index + 1] ?? "");
      const filePath = assertRepositoryPath(firstPath);
      entries.push({ path: filePath, sourcePath, status, score: null });
      index += 1;
    } else {
      entries.push({ path: assertRepositoryPath(firstPath), sourcePath: null, status, score: null });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function parseIndexEntriesZ(output) {
  const tokens = text(output).split("\0").filter(Boolean);
  return tokens.map((token) => {
    const match = token.match(/^(\d+) ([0-9a-f]+) (\d+)\t([\s\S]*)$/u);
    if (!match) throw repositoryError("E_REVISION_PROVIDER_INVALID", "Cannot parse Git index entry");
    return {
      mode: match[1],
      objectId: match[2],
      stage: Number(match[3]),
      path: assertRepositoryPath(match[4]),
    };
  });
}

export async function currentRepositoryFingerprint(target) {
  try {
    const [{ stdout: branchOutput }, { stdout: headOutput }] = await Promise.all([
      execFileAsync("git", ["-C", target, "branch", "--show-current"], { windowsHide: true }),
      execFileAsync("git", ["-C", target, "rev-parse", "HEAD"], { windowsHide: true }),
    ]);
    return {
      branch: branchOutput.trim() || null,
      head: headOutput.trim() || null,
    };
  } catch {
    return { branch: null, head: null };
  }
}

export async function repositoryObjectFormat(target) {
  const output = await runGit(target, ["rev-parse", "--show-object-format"]);
  return text(output).trim() || "sha1";
}

export async function repositoryWorktreeMetadata(target) {
  const [commonDirectory, gitDirectory, topLevel] = await Promise.all([
    runGit(target, ["rev-parse", "--git-common-dir"]),
    runGit(target, ["rev-parse", "--git-dir"]),
    runGit(target, ["rev-parse", "--show-toplevel"]),
  ]);
  return {
    commonDirectory: text(commonDirectory).trim(),
    gitDirectory: text(gitDirectory).trim(),
    topLevel: text(topLevel).trim(),
    objectFormat: await repositoryObjectFormat(target),
  };
}

export async function repositoryHead(target, { revision = "HEAD" } = {}) {
  const output = await runGit(target, ["rev-parse", "--verify", assertRevision(revision)]);
  return text(output).trim();
}

export async function repositoryTree(target, { revision = "HEAD" } = {}) {
  const output = await runGit(target, ["rev-parse", "--verify", `${assertRevision(revision)}^{tree}`]);
  return text(output).trim();
}

export async function repositoryRemoteUrl(target, { remote = "origin" } = {}) {
  try {
    const output = await runGit(target, ["remote", "get-url", remote]);
    return text(output).trim() || null;
  } catch (error) {
    if (error.cause?.code === 2 || /No such remote|no such remote/iu.test(error.message)) return null;
    throw error;
  }
}

export async function repositoryDiffEntries(target, {
  baseRevision,
  headRevision = "HEAD",
  paths = null,
} = {}) {
  if (typeof baseRevision !== "string" || !baseRevision.trim()) {
    throw repositoryError("E_REVISION_NOT_FOUND", "baseRevision is required for a repository diff");
  }
  const args = ["diff", "--name-status", "-z", "--find-renames", "--find-copies", assertRevision(baseRevision, "baseRevision"), assertRevision(headRevision, "headRevision")];
  if (Array.isArray(paths) && paths.length > 0) {
    args.push("--", ...paths.map(assertRepositoryPath));
  }
  return parseNameStatusZ(await runGit(target, args));
}

export async function repositoryIndexEntries(target, { paths = null } = {}) {
  const args = ["ls-files", "--stage", "-z"];
  if (Array.isArray(paths) && paths.length > 0) args.push("--", ...paths.map(assertRepositoryPath));
  return parseIndexEntriesZ(await runGit(target, args));
}

export async function repositoryTreeEntry(target, { revision = "HEAD", path: repositoryPath } = {}) {
  if (typeof revision !== "string" || !revision.trim()) throw repositoryError("E_REVISION_NOT_FOUND", "revision is required");
  const safeRevision = assertRevision(revision);
  const safePath = assertRepositoryPath(repositoryPath);
  const output = await runGit(target, ["ls-tree", "-z", safeRevision, "--", safePath]);
  const token = text(output).split("\0").find(Boolean);
  if (!token) {
    const error = repositoryError("E_REVISION_CONTENT_UNAVAILABLE", `Path is absent at revision ${safeRevision}: ${safePath}`);
    error.notFound = true;
    throw error;
  }
  const match = token.match(/^(\d+)\s+(\w+)\s+([a-f0-9]+)\t(.*)$/u);
  if (!match) throw repositoryError("E_REVISION_PROVIDER_INVALID", `Cannot parse Git tree entry for ${safePath}`);
  return { mode: match[1], type: match[2], objectId: match[3], path: match[4] };
}

export async function repositoryStatusEntries(target, { paths = null } = {}) {
  const args = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
  if (Array.isArray(paths) && paths.length > 0) args.push("--", ...paths.map(assertRepositoryPath));
  return parseStatusZ(await runGit(target, args));
}

export async function repositoryBlobAtRef(target, { ref, path: repositoryPath } = {}) {
  const safeRef = assertRevision(ref, "ref");
  const safePath = assertRepositoryPath(repositoryPath);
  try {
    return Buffer.from(await runGit(target, ["cat-file", "blob", `${safeRef}:${safePath}`], { binary: true }));
  } catch (error) {
    const wrapped = repositoryError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot read ${safePath} at revision ${safeRef}`, error);
    wrapped.notFound = isGitNotFound(error);
    throw wrapped;
  }
}

export async function repositoryBlobOidAtRef(target, { ref, path: repositoryPath } = {}) {
  const safeRef = assertRevision(ref, "ref");
  const safePath = assertRepositoryPath(repositoryPath);
  try {
    const output = await runGit(target, ["rev-parse", "--verify", `${safeRef}:${safePath}`]);
    return text(output).trim();
  } catch (error) {
    const wrapped = repositoryError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot resolve ${safePath} at revision ${safeRef}`, error);
    wrapped.notFound = isGitNotFound(error);
    throw wrapped;
  }
}

export async function expectedGitBlobOid(target, { path: repositoryPath } = {}) {
  const safePath = assertRepositoryPath(repositoryPath);
  try {
    const output = await runGit(target, ["hash-object", `--path=${safePath}`, "--", safePath]);
    return text(output).trim();
  } catch (error) {
    throw repositoryError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot hash worktree path ${safePath}`, error);
  }
}

export async function repositoryHasUnstagedChanges(target, { paths = null } = {}) {
  const args = ["diff", "--quiet"];
  if (Array.isArray(paths) && paths.length > 0) args.push("--", ...paths.map(assertRepositoryPath));
  try {
    await runGit(target, args);
    return false;
  } catch (error) {
    if (error.cause?.code === 1) return true;
    throw error;
  }
}

export function parsePorcelainV1Z(stdout) {
  if (!stdout) return [];
  const entries = [];
  const tokens = stdout.split("\0");
  let i = 0;
  while (i < tokens.length) {
    const item = tokens[i];
    if (!item) {
      i++;
      continue;
    }
    const status = item.slice(0, 2);
    const filePath = item.slice(3);
    if (status.startsWith("R") || status.startsWith("C") || status.includes("R") || status.includes("C")) {
      // In porcelain -z, rename/copy formats have the previous path in next token
      i++;
      const nextToken = tokens[i];
      if (nextToken) {
        entries.push(nextToken);
      }
      entries.push(filePath);
    } else {
      entries.push(filePath);
    }
    i++;
  }

  return [...new Set(
    entries
      .map((p) => p.replaceAll("\\", "/").replace(/^\.\//, "").trim())
      .filter((relativePath) => relativePath && !relativePath.startsWith(".forgeloop/")),
  )].sort((a, b) => a.localeCompare(b));
}

export async function currentChangedPaths(target, { paths = null } = {}) {
  try {
    const entries = await repositoryStatusEntries(target, { paths });
    return [...new Set(entries
      .flatMap((entry) => [entry.path, entry.sourcePath].filter(Boolean))
      .filter((relativePath) => !relativePath.startsWith(".forgeloop/")))].sort((a, b) => a.localeCompare(b));
  } catch {
    return null;
  }
}
