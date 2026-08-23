import { CLI_COMMAND_DEFINITIONS, INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";

const CLI_ONLY_OPTIONS = new Set(["--json", "--help", "--version", "--path"]);
const DEPRECATED_OPTIONS = new Set(["--operator-authorized"]);

function stringSchema() {
  return { type: "string", minLength: 1, maxLength: INTEGRATION_LIMITS.maxStringLength };
}

/**
 * Generate a deterministic, bounded JSON Schema for a canonical ForgeLoop
 * command from its option definitions. CLI-only flags are excluded. The
 * generated schema is wrapped with the official SDK's fromJsonSchema() at
 * registration; semantic cross-field validation still runs inside ForgeLoop
 * core after schema validation.
 */
export function jsonSchemaForCommand(command, { taskAwareMutation = false } = {}) {
  const definition = CLI_COMMAND_DEFINITIONS[command];
  if (!definition) throw new Error(`Unknown command: ${command}`);
  const properties = {};
  const required = [];
  for (const [flag, optionDef] of Object.entries(definition.options)) {
    if (CLI_ONLY_OPTIONS.has(flag) || DEPRECATED_OPTIONS.has(flag)) continue;
    const key = optionDef.targetKey;
    let schema;
    switch (optionDef.parseType) {
      case "boolean":
        schema = { type: "boolean" };
        break;
      case "string":
        schema = optionDef.repeatable
          ? {
              type: "array",
              minItems: 0,
              maxItems: INTEGRATION_LIMITS.maxRepeatedValues,
              items: stringSchema(),
            }
          : stringSchema();
        break;
      case "non-negative-integer":
        schema = { type: "integer", minimum: 0 };
        break;
      case "json-object":
        schema = {
          type: "object",
          additionalProperties: true,
          // Serialized size is bounded at the adapter boundary in
          // output-mapping/input handling; JSON Schema cannot express bytes.
          maxProperties: 256,
        };
        break;
      case "argv":
        schema = {
          type: "array",
          minItems: 1,
          maxItems: INTEGRATION_LIMITS.maxArgvItems,
          items: {
            type: "string",
            minLength: 1,
            maxLength: INTEGRATION_LIMITS.maxArgvItemLength,
          },
        };
        break;
      default:
        continue;
    }
    properties[key] = schema;
    // Task-aware mutation tools require an explicit taskId (plan §40).
    if (taskAwareMutation && key === "taskId") {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    additionalProperties: false,
    ...(required.length > 0 ? { required } : {}),
  };
}
