import {
  CLI_COMMAND_DEFINITIONS,
  classifyForgeLoopInvocation,
  executeForgeLoopCommand,
  FORGELOOP_INTEGRATION_API_VERSION,
} from "@cassiomc1/forgeloop/integration";
import { fromJsonSchema } from "@modelcontextprotocol/server";

import { invocationAllowed, annotationsFor, toolEnabled } from "./capability-policy.js";
import { jsonSchemaForCommand } from "./schema-adapter.js";
import { envelopeToToolResult, capabilityRefusalResult } from "./error-mapping.js";

export function commandToToolName(command) {
  return `forgeloop_${command.replaceAll("-", "_")}`;
}

/**
 * Deterministic tool catalog: derived only from static ForgeLoop command
 * metadata plus the immutable launch policy. Project state never changes the
 * tool list.
 */
export function buildToolRegistrations({ projectRoot, policy }) {
  const registrations = [];

  const commandNames = Object.keys(CLI_COMMAND_DEFINITIONS).sort();
  for (const command of commandNames) {
    const classification = classifyForgeLoopInvocation(command);
    if (!toolEnabled(command, classification, policy)) continue;

    const taskAwareMutation = classification.mutatesProtocol && Boolean(CLI_COMMAND_DEFINITIONS[command].options["--task"]);
    const schema = jsonSchemaForCommand(command, { taskAwareMutation });
    const inputSchema = fromJsonSchema(schema);

    registrations.push({
      name: commandToToolName(command),
      config: {
        title: `ForgeLoop: ${command}`,
        description: CLI_COMMAND_DEFINITIONS[command].description,
        inputSchema,
        annotations: annotationsFor(classification, policy),
      },
      riskClass: classification.riskClass,
      handler: async (args) => {
        const startedAt = Date.now();
        // Defense in depth: the catalog excludes disabled tools, but
        // input-dependent escalations (e.g. force:true) are re-checked here.
        const liveClassification = classifyForgeLoopInvocation(command, args ?? {});
        const gate = invocationAllowed(liveClassification, policy);
        if (!gate.allowed) {
          return capabilityRefusalResult({
            code: gate.code,
            requiredCapability: gate.requiredCapability,
            command,
          });
        }
        if (taskAwareMutation && typeof args?.taskId !== "string") {
          return capabilityRefusalResult({ code: "E_MCP_TASK_ID_REQUIRED", requiredCapability: "explicit taskId", command });
        }
        void FORGELOOP_INTEGRATION_API_VERSION;
        const envelope = await executeForgeLoopCommand({
          command,
          projectPath: projectRoot,
          input: args ?? {},
        });
        const result = envelopeToToolResult(envelope);
        result._diagnostics = { tool: commandToToolName(command), durationMs: Date.now() - startedAt };
        return result;
      },
    });
  }
  return registrations;
}
