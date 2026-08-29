import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";

import { canonicalFingerprint } from "../artifacts.js";
import { assertSafePath, ensureWithin } from "../filesystem.js";
import {
  currentRepositoryFingerprint,
  expectedGitBlobOid,
  repositoryBlobAtRef,
  repositoryBlobOidAtRef,
  repositoryDiffEntries,
  repositoryIndexEntries,
  repositoryObjectFormat,
  repositoryRemoteUrl,
  repositoryStatusEntries,
  repositoryTreeEntry,
  repositoryWorktreeMetadata,
} from "../repository.js";
import { normalizeRevisionEntry } from "./provider.js";

function revisionError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function normalizeGitPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//u, "");
}

function operationFromStatus(status) {
  const raw = String(status ?? "");
  if (raw.includes("?")) return "ADDED";
  const code = raw.replace(/[ ]/gu, "").slice(0, 1);
  return {
    A: "ADDED",
    M: "MODIFIED",
    D: "DELETED",
    R: "RENAMED",
    C: "COPIED",
    T: "TYPE_CHANGED",
    U: "TYPE_CHANGED",
    "?": "ADDED",
  }[code] ?? "MODIFIED";
}

function kindFromMode(mode) {
  if (mode === "160000") return "GITLINK";
  if (mode === "120000") return "SYMLINK";
  return "FILE";
}

async function worktreeEntry(target, entry) {
  const relativePath = normalizeGitPath(entry.path);
  await assertSafePath(target, relativePath);
  const absolutePath = ensureWithin(target, relativePath);
  try {
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) {
      const linkTarget = await readlink(absolutePath, { encoding: "buffer" });
      return { ...entry, kind: "SYMLINK", bytes: Buffer.from(linkTarget) };
    }
    if (info.isDirectory()) {
      return { ...entry, kind: "GITLINK", bytes: null };
    }
    return { ...entry, kind: "FILE", bytes: await readFile(absolutePath) };
  } catch (error) {
    if (entry.operation === "DELETED" || error.code === "ENOENT") {
      return { ...entry, operation: entry.operation === "TYPE_CHANGED" ? "TYPE_CHANGED" : "DELETED", kind: "DELETED", bytes: null };
    }
    throw revisionError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot read worktree path ${relativePath}`, error);
  }
}

function normalizeDiffEntry(entry) {
  return {
    path: normalizeGitPath(entry.path),
    sourcePath: entry.sourcePath ? normalizeGitPath(entry.sourcePath) : null,
    operation: operationFromStatus(entry.status),
    kind: "FILE",
    bytes: null,
    providerContentId: null,
    providerMetadata: { score: entry.score ?? null },
  };
}

export function createGitRevisionProvider() {
  return {
    name: "git",
    async detect(target) {
      try {
        await repositoryWorktreeMetadata(target);
        return true;
      } catch {
        return false;
      }
    },
    async getCurrentRevision(target) {
      try {
        return (await currentRepositoryFingerprint(target)).head;
      } catch (error) {
        throw revisionError("E_REVISION_NOT_FOUND", "Current Git revision is unavailable", error);
      }
    },
    async getRepositoryIdentity(target) {
      try {
        const metadata = await repositoryWorktreeMetadata(target);
        return canonicalFingerprint({
          commonDirectory: path.normalize(metadata.commonDirectory).replaceAll("\\", "/"),
          objectFormat: metadata.objectFormat,
        });
      } catch (error) {
        throw revisionError("E_REVISION_PROVIDER_UNAVAILABLE", "Git repository identity is unavailable", error);
      }
    },
    async getChangedEntries({ target, baseRevision = null, headRevision = "WORKTREE", paths = null } = {}) {
      try {
        const rawEntries = headRevision === "WORKTREE" || headRevision === "working-tree"
          ? await repositoryStatusEntries(target, { paths })
          : await repositoryDiffEntries(target, { baseRevision, headRevision, paths });
        const normalized = rawEntries
          .map(normalizeDiffEntry)
          .filter((entry) => !entry.path.startsWith(".forgeloop/"));
        const complete = [];
        for (const entry of normalized) {
          const materialized = (headRevision === "WORKTREE" || headRevision === "working-tree")
            ? await worktreeEntry(target, entry)
            : entry.operation === "DELETED"
              ? { ...entry, kind: "DELETED", bytes: null }
              : { ...entry, bytes: await this.readContent({ target, revision: headRevision, path: entry.path }) };
          let kind = materialized.kind;
          let providerContentId = materialized.providerContentId;
          if (headRevision !== "WORKTREE" && materialized.operation !== "DELETED") {
            try {
              const treeEntry = await repositoryTreeEntry(target, { revision: headRevision, path: entry.path });
              kind = kindFromMode(treeEntry?.mode);
              providerContentId = treeEntry?.objectId ?? providerContentId;
            } catch {
              // A provider may still return content for a mode-less fixture.
            }
          } else if (headRevision === "WORKTREE" && materialized.operation !== "DELETED" && kind === "FILE") {
            try { providerContentId = await expectedGitBlobOid(target, { path: entry.path }); } catch { /* untracked files have no Git identity */ }
          } else if (headRevision === "WORKTREE" && materialized.operation !== "DELETED" && kind === "GITLINK") {
            try {
              const indexEntry = (await repositoryIndexEntries(target, { paths: [entry.path] }))
                .find((candidate) => candidate.path === entry.path);
              providerContentId = indexEntry?.objectId ?? null;
            } catch {
              // A provider must reject an unresolved gitlink during manifest validation.
            }
          }
          complete.push(normalizeRevisionEntry({
            ...materialized,
            kind,
            providerContentId,
            providerMetadata: { ...materialized.providerMetadata, objectFormat: await repositoryObjectFormat(target) },
          }));
        }
        return complete.sort((left, right) => left.path.localeCompare(right.path));
      } catch (error) {
        if (error.code?.startsWith("E_REVISION_")) throw error;
        throw revisionError("E_REVISION_PROVIDER_INVALID", `Git changed-entry discovery failed: ${error.message}`, error);
      }
    },
    async readContent({ target, revision, path: repositoryPath } = {}) {
      const safePath = normalizeGitPath(repositoryPath);
      if (revision === "WORKTREE" || revision === "working-tree") {
        await assertSafePath(target, safePath);
        try { return await readFile(ensureWithin(target, safePath)); } catch (error) {
        const wrapped = revisionError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot read ${safePath} from the worktree`, error);
        wrapped.notFound = error.code === "ENOENT";
        throw wrapped;
        }
      }
      try {
        return await repositoryBlobAtRef(target, { ref: revision, path: safePath });
      } catch (error) {
        const wrapped = revisionError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot read ${safePath} at ${revision}`, error);
        wrapped.notFound = error.notFound === true;
        throw wrapped;
      }
    },
    async getContentIdentity({ target, revision, path: repositoryPath } = {}) {
      try {
        if (revision === "WORKTREE" || revision === "working-tree") {
          return await expectedGitBlobOid(target, { path: repositoryPath });
        }
        return await repositoryBlobOidAtRef(target, { ref: revision, path: repositoryPath });
      } catch (error) {
        const wrapped = revisionError("E_REVISION_CONTENT_UNAVAILABLE", `Cannot resolve content identity for ${repositoryPath}`, error);
        wrapped.notFound = error.notFound === true;
        throw wrapped;
      }
    },
    async getProviderMetadata(target) {
      const [objectFormat, remote, fingerprint] = await Promise.all([
        repositoryObjectFormat(target),
        repositoryRemoteUrl(target),
        currentRepositoryFingerprint(target),
      ]);
      return { objectFormat, remote, branch: fingerprint.branch, head: fingerprint.head };
    },
  };
}

export const GitRevisionProvider = createGitRevisionProvider;
