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

export const FORGELOOP_INTEGRATION_API_VERSION = FORGELOOP_INTEGRATION_RUNTIME_VERSION;
