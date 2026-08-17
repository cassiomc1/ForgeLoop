import { CLI_COMMAND_DEFINITIONS } from "./cli-command-definitions.js";

/**
 * Canonical metadata for all 27 ForgeLoop CLI commands derived directly
 * from CLI_COMMAND_DEFINITIONS to guarantee zero divergence.
 */
export const CLI_COMMAND_METADATA = Object.freeze(
  Object.fromEntries(
    Object.entries(CLI_COMMAND_DEFINITIONS).map(([name, def]) => [
      name,
      Object.freeze({
        name: def.name,
        category: def.category,
        mutation: def.mutation,
        options: Object.keys(def.options),
        writes: def.writes,
        removes: def.removes,
        mayExecuteExternalProcess: def.mayExecuteExternalProcess,
        description: def.description,
      }),
    ]),
  ),
);
