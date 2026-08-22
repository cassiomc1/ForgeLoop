import { CLI_COMMAND_DEFINITIONS } from "@cassiomc1/forgeloop/integration";

const CLI_ONLY_OPTIONS = new Set(["--json", "--help", "--version", "--path"]);
const DEPRECATED_OPTIONS = new Set(["--operator-authorized"]);

/**
 * Generate a deterministic JSON Schema for a canonical ForgeLoop command
 * from its option definitions. CLI-only flags are excluded. The generated
 * schema is wrapped with the official SDK's fromJsonSchema() at registration;
 * semantic cross-field validation still runs inside ForgeLoop core.
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
          ? { type: "array", items: { type: "string" } }
          : { type: "string" };
        break;
      case "non-negative-integer":
        schema = { type: "integer", minimum: 0 };
        break;
      case "json-object":
        schema = { type: "object", additionalProperties: true };
        break;
      case "argv":
        schema = { type: "array", items: { type: "string" }, minItems: 1 };
        break;
      default:
        continue;
    }
    properties[key] = schema;
    // Task-aware mutation tools require an explicit taskId (plan §40).
    if (taskAwareMutation && key === "taskId") {
      required.push(key);
      properties.taskId.minLength = 1;
    }
  }
  return {
    type: "object",
    properties,
    additionalProperties: false,
    ...(required.length > 0 ? { required } : {}),
  };
}
