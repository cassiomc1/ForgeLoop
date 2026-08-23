import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Cross-platform npm invocation: on Windows `npm` is an npm.cmd shim that
 * spawnSync cannot execute directly; run the CLI through the current Node.
 */
export function runNpm(args, options = {}) {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    // npm_execpath is set by npm itself and points at its own CLI entry.
    process.env.npm_execpath,
    path.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter((candidate) => typeof candidate === "string" && existsSync(candidate));
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return execFileSync(process.execPath, [candidate, ...args], options);
    }
  }
  return execFileSync("npm", args, options);
}
