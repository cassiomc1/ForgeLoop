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

export async function currentChangedPaths(target) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", target, "status", "--porcelain=v1", "--untracked-files=all"],
      { windowsHide: true },
    );
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter((relativePath) => relativePath && !relativePath.startsWith(".forgeloop/"))
      .sort();
  } catch {
    return null;
  }
}
