import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import {
  ARTIFACT_PATHS,
  executionArtifactPath,
  readJsonArtifact,
  writeJsonArtifact,
} from "./artifacts.js";
import { classifyCommandResolution, validateVerificationAuthority } from "./verification-capability.js";

export const EXECUTION_KIND = "COMMAND_EXECUTION";

function executionError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

function normalizeArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw executionError("E_EXECUTION_INVALID", "Execution argv must contain at least one non-empty string");
  }
  return [...argv];
}

function validateAuthorityBeforeLaunch({ target, taskId, argv, resolution, details, authorityContext, runtimeContext }) {
  if (!resolution.mayInstall) return;
  const check = {
    kind: "command",
    source: argv[0],
    details: {
      ...(details ?? {}),
      execution: { resolution },
    },
  };
  const authority = validateVerificationAuthority(check, {
    target,
    taskId,
    authorityContext,
    runtimeContext,
  });
  if (!authority.valid) {
    throw executionError(authority.error.code ?? "E_INSTALLATION_AUTHORITY_REQUIRED", authority.error.message);
  }
}

function executeProcess(argv, cwd) {
  return new Promise((resolve) => {
    let spawnError = null;
    try {
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        shell: false,
        stdio: "inherit",
      });
      child.once("error", (error) => {
        spawnError = error;
      });
      child.once("close", (exitCode) => {
        resolve({ exitCode, spawnError });
      });
    } catch (error) {
      resolve({ exitCode: null, spawnError: error });
    }
  });
}

export async function runCommandExecution({
  target,
  packageRoot,
  taskId,
  checkId,
  requirement,
  verificationCycle = 1,
  argv,
  details,
  authorityContext,
  runtimeContext,
} = {}) {
  const commandArgv = normalizeArgv(argv);
  const resolution = classifyCommandResolution(commandArgv);
  validateAuthorityBeforeLaunch({
    target,
    taskId,
    argv: commandArgv,
    resolution,
    details,
    authorityContext,
    runtimeContext,
  });

  const executionId = `exec-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const processResult = await executeProcess(commandArgv, target);
  const finishedAt = new Date().toISOString();
  const execution = {
    schemaVersion: 1,
    protocolVersion: 1,
    executionId,
    taskId,
    checkId,
    requirement,
    verificationCycle,
    kind: EXECUTION_KIND,
    argv: commandArgv,
    cwd: target,
    resolution,
    startedAt,
    finishedAt,
    status: processResult.exitCode === 0 && !processResult.spawnError ? "passed" : "failed",
    exitCode: processResult.exitCode,
  };
  const path = executionArtifactPath(executionId);
  const written = await writeJsonArtifact(target, path, execution, "execution", packageRoot);
  return {
    path: written.path,
    execution: written.value,
    result: processResult.spawnError
      ? "process failed to start"
      : `process exited with code ${processResult.exitCode}`,
  };
}

export async function readExecutionArtifact({ target, executionRef, packageRoot } = {}) {
  let relativePath;
  try {
    relativePath = executionArtifactPath(executionRef);
    const artifact = await readJsonArtifact(target, relativePath, "execution", packageRoot);
    return artifact;
  } catch (error) {
    if (error.code === "E_EXECUTION_REF_INVALID") throw error;
    throw executionError("E_EXECUTION_REF_INVALID", "Execution reference does not resolve to a valid ForgeLoop artifact", [relativePath ?? ARTIFACT_PATHS.executionDirectory]);
  }
}

export function validateExecutionBinding({ execution, taskId, checkId, requirement, verificationCycle = 1 } = {}) {
  if (!execution || execution.kind !== EXECUTION_KIND
    || execution.taskId !== taskId
    || execution.checkId !== checkId
    || execution.requirement !== requirement
    || execution.verificationCycle !== undefined && execution.verificationCycle !== verificationCycle) {
    throw executionError("E_EXECUTION_REF_INVALID", "Execution artifact does not match the current check binding", [ARTIFACT_PATHS.executionDirectory]);
  }
  return execution;
}
