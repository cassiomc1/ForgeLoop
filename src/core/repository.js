import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function currentRepositoryFingerprint(target) {
  try {
    const [{ stdout: branchOutput }, { stdout: headOutput }] = await Promise.all([
      execFileAsync("git", ["-C", target, "branch", "--show-current"], { windowsHide: true }),
      execFileAsync("git", ["-C", target, "rev-parse", "HEAD"], { windowsHide: true }),
    ]);
    return {
      branch: branchOutput.trim() || null,
      head: headOutput.trim() || null,
    };
  } catch {
    return { branch: null, head: null };
  }
}

export function parsePorcelainV1Z(stdout) {
  if (!stdout) return [];
  const entries = [];
  const tokens = stdout.split("\0");
  let i = 0;
  while (i < tokens.length) {
    const item = tokens[i];
    if (!item) {
      i++;
      continue;
    }
    const status = item.slice(0, 2);
    const filePath = item.slice(3);
    if (status.startsWith("R") || status.startsWith("C") || status.includes("R") || status.includes("C")) {
      // In porcelain -z, rename/copy formats have the previous path in next token
      i++;
      const nextToken = tokens[i];
      if (nextToken) {
        entries.push(nextToken);
      }
      entries.push(filePath);
    } else {
      entries.push(filePath);
    }
    i++;
  }

  return [...new Set(
    entries
      .map((p) => p.replaceAll("\\", "/").replace(/^\.\//, "").trim())
      .filter((relativePath) => relativePath && !relativePath.startsWith(".forgeloop/")),
  )].sort((a, b) => a.localeCompare(b));
}

export async function currentChangedPaths(target, { paths = null } = {}) {
  try {
    const args = ["-C", target];
    if (paths && paths.length > 0) {
      args.unshift("--literal-pathspecs");
    }
    args.push("status", "--porcelain=v1", "-z", "--untracked-files=all");
    if (paths && paths.length > 0) {
      args.push("--", ...paths);
    }

    const { stdout } = await execFileAsync("git", args, { windowsHide: true });
    return parsePorcelainV1Z(stdout);
  } catch {
    return null;
  }
}
