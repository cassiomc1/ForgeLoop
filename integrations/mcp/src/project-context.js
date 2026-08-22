import { realpathSync } from "node:fs";
import path from "node:path";

/**
 * The project root is pinned at server startup: realpathed once and frozen.
 * It is never accepted as tool input and never derived per call.
 */
export function resolveProjectContext(projectPath) {
  if (typeof projectPath !== "string" || projectPath.trim() === "") {
    throw new Error("A project path is required to start the ForgeLoop MCP server");
  }
  const resolved = realpathSync(path.resolve(projectPath));
  return Object.freeze({ projectRoot: resolved });
}
