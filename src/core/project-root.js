import path from "node:path";
import { realpath } from "node:fs/promises";

import { resolveTarget } from "./filesystem.js";

/**
 * Canonical project-root resolution for integrations. Applies exactly the
 * same semantics as the CLI target resolver — the path must exist, must be a
 * real directory (not a symlink), and is returned as an absolute path.
 *
 * Symlinked roots are rejected so that every transport agrees on whether a
 * given project path is acceptable; use the resolved real directory instead.
 */
export async function resolveForgeLoopProjectRoot(projectPath, { cwd = process.cwd() } = {}) {
  const target = await resolveTarget(cwd, projectPath);
  return realpath(target);
}

export function defaultIntegrationProjectPath() {
  return path.resolve(".");
}
