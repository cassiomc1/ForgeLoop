import { resolveForgeLoopProjectRoot } from "@cassiomc1/forgeloop/integration";

/**
 * The project root is pinned at server startup using the canonical ForgeLoop
 * root resolver (symlinks rejected, same semantics as the CLI target
 * resolver). It is frozen once and never accepted as tool input.
 */
export async function resolveProjectContext(projectPath) {
  if (typeof projectPath !== "string" || projectPath.trim() === "") {
    throw new Error("A project path is required to start the ForgeLoop MCP server");
  }
  const resolved = await resolveForgeLoopProjectRoot(projectPath);
  return Object.freeze({ projectRoot: resolved });
}
