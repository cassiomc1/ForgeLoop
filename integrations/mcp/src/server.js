import { McpServer } from "@modelcontextprotocol/server";

import {
  FORGELOOP_INTEGRATION_API_VERSION,
} from "@cassiomc1/forgeloop/integration";

import { resolveLaunchPolicy, SERVER_MODES } from "./capability-policy.js";
import { resolveProjectContext } from "./project-context.js";
import { buildToolRegistrations } from "./tool-registry.js";
import { registerIntegrationResources } from "./resource-registry.js";
import { logToolCall } from "./logging.js";

/**
 * Construct a fresh MCP server product over an already-validated launch
 * context. Used directly by the stateless HTTP transport (one product per
 * request) and once by the stdio entrypoint.
 */
export function buildForgeLoopMcpServer({ projectContext, policy, packageRoot }) {
  const server = new McpServer({
    name: "forgeloop-mcp",
    version: "0.1.0",
  });

  for (const registration of buildToolRegistrations({ projectRoot: projectContext.projectRoot, policy })) {
    server.registerTool(
      registration.name,
      {
        title: registration.config.title,
        description: registration.config.description,
        inputSchema: registration.config.inputSchema,
        annotations: registration.config.annotations,
      },
      async (args) => {
        const startedAt = Date.now();
        const toolResult = await registration.handler(args);
        logToolCall({
          tool: registration.name,
          riskClass: registration.riskClass,
          durationMs: Date.now() - startedAt,
          ok: toolResult.isError !== true,
        });
        return {
          isError: toolResult.isError,
          content: toolResult.content,
          structuredContent: toolResult.structuredContent,
        };
      },
    );
  }

  registerIntegrationResources(server, {
    projectRoot: projectContext.projectRoot,
    packageRoot,
  });

  return server;
}

function validateLaunchContext({ mode, allowExternalExecution, allowMaintenance, allowRecovery, allowLegacyRepair, allowForceRecovery, maxExecutionTimeMs }) {
  if (FORGELOOP_INTEGRATION_API_VERSION !== 1) {
    throw new Error(`E_MCP_FORGELOOP_INTEGRATION_UNSUPPORTED: ForgeLoop integration API ${FORGELOOP_INTEGRATION_API_VERSION} is not supported (required: 1)`);
  }
  return resolveLaunchPolicy({
    mode,
    allowExternalExecution,
    allowMaintenance,
    allowRecovery,
    allowLegacyRepair,
    allowForceRecovery,
    maxExecutionTimeMs,
  });
}

/**
 * Create the ForgeLoop MCP server. The MCP layer is an adapter: it registers
 * deterministic tools/resources over the canonical ForgeLoop integration API
 * and contains no lifecycle, ownership, recovery, lock, or transaction logic.
 */
export async function createForgeLoopMcpServer({
  projectPath,
  mode = SERVER_MODES.SAFE,
  allowExternalExecution = false,
  allowMaintenance = false,
  allowRecovery = false,
  allowLegacyRepair = false,
  allowForceRecovery = false,
  maxExecutionTimeMs = 600000,
  packageRoot = undefined,
} = {}) {
  const projectContext = resolveProjectContext(projectPath);
  const policy = validateLaunchContext({
    mode,
    allowExternalExecution,
    allowMaintenance,
    allowRecovery,
    allowLegacyRepair,
    allowForceRecovery,
    maxExecutionTimeMs,
  });
  const server = buildForgeLoopMcpServer({ projectContext, policy, packageRoot });
  return Object.freeze({ server, policy, projectContext });
}

export { SERVER_MODES };
