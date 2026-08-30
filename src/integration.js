import {
  FORGELOOP_INTEGRATION_RUNTIME_VERSION,
  executeForgeLoopCommand,
} from "./core/command-runtime.js";
import { validateForgeLoopCommandInput, defaultCommandInputValues } from "./core/command-input.js";
import { CLI_COMMAND_DEFINITIONS } from "./core/cli-command-definitions.js";
import {
  INTEGRATION_RISK_CLASSES,
  classifyForgeLoopInvocation,
  getForgeLoopCapabilities,
} from "./core/integration-invocation-policy.js";
import { readForgeLoopIntegrationResource, INTEGRATION_RESOURCE_DEFINITIONS } from "./core/integration-resources.js";
import { resolveForgeLoopProjectRoot } from "./core/project-root.js";
import { INTEGRATION_LIMITS } from "./core/integration-limits.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Version of the installed @cassiomc1/forgeloop package providing this
 * integration API (closing plan §14-16): lets external adapters report the
 * real core version without hardcoding or deep-importing package internals.
 */
export function getForgeLoopPackageVersion() {
  const packageJsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}

export {
  executeForgeLoopCommand,
  validateForgeLoopCommandInput,
  defaultCommandInputValues,
  getForgeLoopCapabilities,
  classifyForgeLoopInvocation,
  readForgeLoopIntegrationResource,
  resolveForgeLoopProjectRoot,
  INTEGRATION_LIMITS,
  INTEGRATION_RISK_CLASSES,
  INTEGRATION_RESOURCE_DEFINITIONS,
  CLI_COMMAND_DEFINITIONS,
};

export { createForgeLoopContext } from "./core/runtime-context.js";
export {
  EXECUTION_PROFILES,
  EXECUTION_PROFILE_REQUESTS,
  LEGACY_EXECUTION_PROFILE,
  projectExecutionProfile,
  resolveExecutionProfile,
} from "./core/execution-profile.js";
export {
  E_VERIFICATION_EXECUTION_INVALID,
  E_VERIFICATION_ISOLATION_UNAVAILABLE,
  VERIFICATION_EXECUTION_POLICY_MODES,
  VERIFICATION_ISOLATION_MODES,
} from "./core/verification-execution.js";

export const FORGELOOP_INTEGRATION_API_VERSION = FORGELOOP_INTEGRATION_RUNTIME_VERSION;
