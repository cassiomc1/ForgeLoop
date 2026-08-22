import { resolveTarget } from "./filesystem.js";
import { getPackageRoot } from "./templates.js";
import { CLI_COMMAND_DEFINITIONS } from "./cli-command-definitions.js";
import { COMMAND_EXECUTORS } from "./command-executors.js";
import { defaultCommandInputValues, validateForgeLoopCommandInput } from "./command-input.js";
import { PROTOCOL_VERSION } from "./protocol.js";

export const FORGELOOP_INTEGRATION_RUNTIME_VERSION = 1;

async function readPackageVersion(packageRoot) {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  return packageJson.version;
}

/**
 * Transport-neutral ForgeLoop command execution.
 *
 * Resolves the project target, validates the command and its structured
 * input, invokes the canonical executor, and returns a deterministic
 * envelope. Performs zero terminal output, never spawns a shell to run
 * ForgeLoop itself, never bypasses task ownership/recovery guards, and never
 * retries mutations.
 *
 * A non-zero exitCode is a protocol/domain outcome (e.g. preflight BLOCKED),
 * not an invocation failure: `ok` stays true. `ok:false` means the command
 * could not be executed (unknown command, invalid input, canonical error).
 */
export async function executeForgeLoopCommand({
  command,
  projectPath = ".",
  input = {},
} = {}) {
  const metadata = Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    integrationRuntimeVersion: FORGELOOP_INTEGRATION_RUNTIME_VERSION,
  });

  if (typeof command !== "string" || !CLI_COMMAND_DEFINITIONS[command]) {
    return {
      ok: false,
      command: command ?? null,
      exitCode: 1,
      result: null,
      error: { code: "E_COMMAND_UNSUPPORTED", message: `Unsupported ForgeLoop command: ${command ?? "(missing)"}` },
      metadata,
    };
  }
  if (CLI_COMMAND_DEFINITIONS[command].bootstrapOnly) {
    return {
      ok: false,
      command,
      exitCode: 1,
      result: null,
      error: { code: "E_COMMAND_UNSUPPORTED", message: `Command ${command} is not available through the programmatic runtime` },
      metadata,
    };
  }

  const executor = COMMAND_EXECUTORS[command];
  if (typeof executor !== "function") {
    return {
      ok: false,
      command,
      exitCode: 1,
      result: null,
      error: { code: "E_COMMAND_UNSUPPORTED", message: `Command ${command} has no canonical executor` },
      metadata,
    };
  }

  try {
    const options = {
      ...defaultCommandInputValues(),
      ...(input ?? {}),
    };
    validateForgeLoopCommandInput({ command, input: options });

    const target = await resolveTarget(process.cwd(), projectPath);
    const packageRoot = getPackageRoot();
    const packageVersion = await readPackageVersion(packageRoot);

    const { result, exitCode } = await executor({ target, packageRoot, packageVersion, options });
    return {
      ok: true,
      command,
      exitCode,
      result,
      error: null,
      metadata: Object.freeze({ ...metadata, packageVersion }),
    };
  } catch (error) {
    return {
      ok: false,
      command,
      exitCode: 1,
      result: null,
      error: {
        code: error.code ?? "E_COMMAND_EXECUTION_FAILED",
        message: error.message,
      },
      metadata,
    };
  }
}
