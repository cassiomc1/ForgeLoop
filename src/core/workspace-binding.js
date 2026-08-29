import path from "node:path";
import { realpath } from "node:fs/promises";

import { appendProtocolEvent } from "./events.js";
import { canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { getPackageRoot } from "./templates.js";
import {
  taskWorkspaceBindingPath,
} from "./task-paths.js";
import {
  currentRepositoryFingerprint,
  repositoryWorktreeMetadata,
} from "./repository.js";
import { withTaskTransaction } from "./transaction.js";
import { assertTaskMutationAllowed } from "./task-claim-state.js";

const SHA256 = /^[a-f0-9]{64}$/u;

function bindingError(code, message, artifacts = []) {
  const error = new Error(message);
  error.name = "WorkspaceBindingError";
  error.code = code;
  if (artifacts.length > 0) error.artifacts = artifacts;
  return error;
}

function normalizeIdentityPath(value) {
  const normalized = path.normalize(value).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

async function absoluteGitPath(target, value) {
  const candidate = path.isAbsolute(value) ? value : path.resolve(target, value);
  try {
    return normalizeIdentityPath(await realpath(candidate));
  } catch {
    return normalizeIdentityPath(candidate);
  }
}

export async function captureWorkspaceIdentity(target) {
  let metadata;
  try {
    metadata = await repositoryWorktreeMetadata(target);
  } catch (error) {
    throw bindingError(
      "E_WORKSPACE_IDENTITY_UNAVAILABLE",
      "The current directory is not a Git worktree whose identity ForgeLoop can prove",
      error?.artifacts ?? [],
    );
  }

  const commonDirectory = await absoluteGitPath(target, metadata.commonDirectory);
  const gitDirectory = await absoluteGitPath(target, metadata.gitDirectory);
  const topLevel = await absoluteGitPath(target, metadata.topLevel);
  const repositoryIdentity = canonicalFingerprint({
    commonDirectory,
    objectFormat: metadata.objectFormat,
  });
  const workspaceIdentity = canonicalFingerprint({
    commonDirectory,
    gitDirectory,
    topLevel,
    objectFormat: metadata.objectFormat,
  });
  const repositoryFingerprint = await currentRepositoryFingerprint(target);
  return {
    repositoryIdentity,
    workspaceIdentity,
    branchAtBind: repositoryFingerprint.branch,
    headAtBind: repositoryFingerprint.head,
    metadata: { objectFormat: metadata.objectFormat },
  };
}

export async function validateWorkspaceBinding(binding, packageRoot = getPackageRoot()) {
  try {
    const schema = await readSchema("workspace-binding", packageRoot);
    assertSchema(binding, schema, "workspace binding");
  } catch (error) {
    throw bindingError("E_WORKSPACE_BINDING_INVALID", error.message);
  }
  if (!SHA256.test(binding.repositoryIdentity) || !SHA256.test(binding.workspaceIdentity)) {
    throw bindingError("E_WORKSPACE_BINDING_INVALID", "Workspace binding identities must be lowercase SHA-256 values");
  }
  assertSecretFree(binding);
  return binding;
}

export async function readWorkspaceBinding(target, { taskId, packageRoot = getPackageRoot() } = {}) {
  if (!taskId) throw bindingError("E_WORKSPACE_BINDING_INVALID", "taskId is required to read a workspace binding");
  const relativePath = taskWorkspaceBindingPath(taskId);
  try {
    const artifact = await readJsonArtifact(target, relativePath, "workspace-binding", packageRoot);
    await validateWorkspaceBinding(artifact.value, packageRoot);
    if (artifact.value.taskId !== taskId) {
      throw bindingError("E_WORKSPACE_BINDING_INVALID", "Workspace binding taskId does not match its task namespace", [relativePath]);
    }
    return { ...artifact, value: artifact.value };
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    if (error.code === "E_WORKSPACE_BINDING_INVALID") throw error;
    throw bindingError("E_WORKSPACE_BINDING_INVALID", `Workspace binding is invalid: ${error.message}`, [relativePath]);
  }
}

export async function resolveWorkspaceBindingStatus(target, { taskId, packageRoot = getPackageRoot() } = {}) {
  const relativePath = taskWorkspaceBindingPath(taskId);
  let artifact;
  try {
    artifact = await readWorkspaceBinding(target, { taskId, packageRoot });
  } catch (error) {
    return {
      status: "INVALID",
      taskId,
      path: relativePath,
      binding: null,
      current: null,
      error: { code: error.code ?? "E_WORKSPACE_BINDING_INVALID", message: error.message },
    };
  }
  if (!artifact) return { status: "UNBOUND", taskId, path: relativePath, binding: null, current: null };

  let current;
  try {
    current = await captureWorkspaceIdentity(target);
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      taskId,
      path: relativePath,
      binding: artifact.value,
      bindingFingerprint: artifact.fingerprint,
      current: null,
      error: { code: error.code ?? "E_WORKSPACE_IDENTITY_UNAVAILABLE", message: error.message },
    };
  }
  const matches = artifact.value.repositoryIdentity === current.repositoryIdentity
    && artifact.value.workspaceIdentity === current.workspaceIdentity;
  return {
    status: matches ? "MATCH" : "MISMATCH",
    taskId,
    path: relativePath,
    binding: artifact.value,
    bindingFingerprint: artifact.fingerprint,
    current,
  };
}

export async function assertWorkspaceBinding(target, { taskId, packageRoot = getPackageRoot(), operation = "mutation" } = {}) {
  const result = await resolveWorkspaceBindingStatus(target, { taskId, packageRoot });
  if (result.status === "UNBOUND" || result.status === "MATCH") return result;
  const code = result.status === "MISMATCH"
    ? "E_WORKSPACE_BINDING_MISMATCH"
    : result.status === "UNAVAILABLE"
      ? "E_WORKSPACE_IDENTITY_UNAVAILABLE"
      : "E_WORKSPACE_BINDING_INVALID";
  const message = result.status === "MISMATCH"
    ? `Workspace binding does not match the current Git worktree before ${operation}`
    : result.status === "UNAVAILABLE"
      ? `Current Git worktree identity is unavailable before ${operation}`
      : `Workspace binding is invalid before ${operation}`;
  throw bindingError(code, message, [result.path]);
}

export async function bindTaskWorkspace(target, { taskId, packageRoot = getPackageRoot(), now = new Date().toISOString() } = {}) {
  if (!taskId) throw bindingError("E_WORKSPACE_BINDING_INVALID", "workspace-bind requires an explicit taskId");
  const relativePath = taskWorkspaceBindingPath(taskId);
  return withTaskTransaction({ target, taskId, packageRoot, operation: "workspace-bind", recordCommitEvent: true }, async () => {
    await assertTaskMutationAllowed(target, { taskId, packageRoot });
    const existing = await readWorkspaceBinding(target, { taskId, packageRoot });
    const current = await captureWorkspaceIdentity(target);
    if (existing) {
      if (existing.value.repositoryIdentity === current.repositoryIdentity
        && existing.value.workspaceIdentity === current.workspaceIdentity) {
        return {
          taskId,
          status: "MATCH",
          bound: false,
          alreadyBound: true,
          path: relativePath,
          binding: existing.value,
          fingerprint: existing.fingerprint,
        };
      }
      throw bindingError("E_WORKSPACE_BINDING_MISMATCH", "Task is already bound to a different Git worktree; unrestricted rebinding is not supported", [relativePath]);
    }
    const binding = await validateWorkspaceBinding({
      schemaVersion: 1,
      protocolVersion: 1,
      taskId,
      mode: "GIT_WORKTREE",
      repositoryIdentity: current.repositoryIdentity,
      workspaceIdentity: current.workspaceIdentity,
      branchAtBind: current.branchAtBind,
      headAtBind: current.headAtBind,
      boundAt: now,
      metadata: current.metadata,
    }, packageRoot);
    const artifact = await writeJsonArtifact(target, relativePath, binding, "workspace-binding", packageRoot, { taskId, operation: "workspace-bind" });
    await appendProtocolEvent(target, {
      taskId,
      event: "WORKSPACE_BOUND",
      fingerprint: artifact.fingerprint,
      details: { workspaceFingerprint: artifact.fingerprint },
    }, packageRoot, { taskId });
    return { taskId, status: "MATCH", bound: true, alreadyBound: false, path: relativePath, binding, fingerprint: artifact.fingerprint };
  });
}
