import { randomUUID } from "node:crypto";
import {
  resolveExecutionResolution,
  validateVerificationAuthority,
  E_COMMAND_RESOLUTION_AMBIGUOUS,
} from "./verification-capability.js";

export { E_COMMAND_RESOLUTION_AMBIGUOUS };

function executionError(code, message, artifacts = []) {
  const error = new Error(message);
  error.code = code;
  error.artifacts = artifacts;
  return error;
}

/**
 * Deterministic pre-launch preparation. Normalizes exact argv, resolves the
 * command, rejects ambiguous resolution contexts, and validates installation
 * authority. Performs no process launch and writes no execution artifact
 * (INV-EXEC-01): ACTION_STARTED is only meaningful after all of these checks
 * succeed.
 */
export async function prepareCommandExecution({
  target,
  taskId,
  argv,
  details,
  authorityContext,
  runtimeContext,
}) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw executionError("E_EXECUTION_INVALID", "Execution argv must contain at least one non-empty string");
  }
  const commandArgv = [...argv];
  const resolution = await resolveExecutionResolution({
    argv: commandArgv,
    cwd: target,
  });

  if (
    resolution.resolutionMode === "UNKNOWN"
    && resolution.mayInstall === true
    && (
      resolution.reason === "NPM_WORKSPACE_SCRIPT_UNRESOLVED"
      || resolution.reason === "NPM_SUBCOMMAND_AMBIGUOUS"
      || resolution.reason === "NPM_COMMAND_UNCLASSIFIED"
      || resolution.reason === "NPM_OPTION_VALUE_AMBIGUOUS"
    )
  ) {
    const error = new Error(
      resolution.reason === "NPM_WORKSPACE_SCRIPT_UNRESOLVED"
        ? "npm workspace script execution cannot be proven from the current target. Run ForgeLoop against the selected workspace directory."
        : "Command execution context could not be proven safe before launch."
    );
    error.code = E_COMMAND_RESOLUTION_AMBIGUOUS;
    error.resolution = resolution;
    throw error;
  }

  if (resolution.mayInstall) {
    const check = {
      kind: "command",
      source: commandArgv[0],
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

  return { argv: commandArgv, resolution };
}

const MAX_CAPTURED_OUTPUT_BYTES = 64 * 1024;

async function executePreparedProcess(argv, cwd, { timeoutMs = null } = {}) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    let spawnError = null;
    let timedOut = false;
    let settled = false;
    let timeout = null;
    let forceTermination = null;
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputTruncated = false;
    const capture = (chunks, chunk, total) => {
      const available = MAX_CAPTURED_OUTPUT_BYTES - total;
      if (available <= 0) {
        outputTruncated = true;
        return total;
      }
      if (chunk.length > available) {
        chunks.push(chunk.subarray(0, available));
        outputTruncated = true;
        return total + available;
      }
      chunks.push(chunk);
      return total + chunk.length;
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (forceTermination) clearTimeout(forceTermination);
      resolve({
        ...result,
        timedOut,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        stdoutBytes,
        stderrBytes,
        outputTruncated,
      });
    };
    try {
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", (chunk) => { stdoutBytes = capture(stdout, chunk, stdoutBytes); });
      child.stderr?.on("data", (chunk) => { stderrBytes = capture(stderr, chunk, stderrBytes); });
      child.once("error", (error) => {
        spawnError = error;
      });
      child.once("close", (exitCode, signal) => {
        finish({ exitCode, signal, spawnError });
      });
      if (Number.isInteger(timeoutMs) && timeoutMs > 0) {
        timeout = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          forceTermination = setTimeout(() => {
            child.kill("SIGKILL");
          }, TERMINATION_GRACE_MS_PREPARED);
        }, timeoutMs);
      }
    } catch (error) {
      finish({ exitCode: null, signal: null, spawnError: error });
    }
  });
}

export const TERMINATION_GRACE_MS_PREPARED = 1_000;

/**
 * Launch a prepared execution. The caller must have already recorded
 * ACTION_STARTED; this function never performs deterministic pre-launch
 * validation again.
 */
export async function runPreparedCommandExecution({
  target,
  packageRoot,
  taskId,
  checkId,
  requirement,
  verificationCycle = 1,
  prepared,
  timeoutMs = null,
  executionPath,
}) {
  const { createHash } = await import("node:crypto");
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const executionId = `exec-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const processResult = await executePreparedProcess(prepared.argv, target, { timeoutMs });
  const finishedAt = new Date().toISOString();
  const execution = {
    schemaVersion: 1,
    protocolVersion: 1,
    executionId,
    taskId,
    checkId,
    requirement,
    verificationCycle,
    kind: "COMMAND_EXECUTION",
    argv: prepared.argv,
    cwd: target,
    resolution: {
      resolutionMode: prepared.resolution.resolutionMode,
      mayInstall: prepared.resolution.mayInstall,
      installer: prepared.resolution.installer,
      tool: prepared.resolution.tool,
    },
    ...(prepared.resolution.dispatch ? { dispatch: prepared.resolution.dispatch } : {}),
    startedAt,
    finishedAt,
    status: processResult.exitCode === 0 && !processResult.spawnError && !processResult.timedOut ? "passed" : "failed",
    exitCode: processResult.exitCode,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    termination: processResult.spawnError ? "spawn-error" : processResult.timedOut ? "timeout" : processResult.signal ? "signal" : "exit",
    signal: processResult.signal ?? null,
    stdoutSha256: digest(processResult.stdout),
    stderrSha256: digest(processResult.stderr),
    stdoutBytes: processResult.stdoutBytes,
    stderrBytes: processResult.stderrBytes,
    outputTruncated: processResult.outputTruncated,
    ...(Number.isInteger(timeoutMs) && timeoutMs > 0 ? { timeoutMs, terminationGraceMs: TERMINATION_GRACE_MS_PREPARED } : {}),
  };
  const { writeJsonArtifact } = await import("./artifacts.js");
  const written = await writeJsonArtifact(target, executionPath ?? await resolveExecutionArtifactPathFor(target, taskId, executionId), execution, "execution", packageRoot);
  return {
    path: written.path,
    execution: written.value,
    result: processResult.spawnError
      ? "process failed to start"
      : `process exited with code ${processResult.exitCode}`,
  };
}

async function resolveExecutionArtifactPathFor(target, taskId, executionId) {
  const { resolveExecutionArtifactPath } = await import("./execution.js");
  return resolveExecutionArtifactPath(target, taskId, executionId);
}
