import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createGitRepository(prefix = "forgeloop-git-fixture-") {
  const target = await mkdtemp(path.join(os.tmpdir(), prefix));
  execFileSync("git", ["-C", target, "init", "-q"], { stdio: "ignore" });
  execFileSync("git", ["-C", target, "config", "user.email", "forgeloop-tests@example.invalid"], { stdio: "ignore" });
  execFileSync("git", ["-C", target, "config", "user.name", "ForgeLoop Tests"], { stdio: "ignore" });
  await mkdir(path.join(target, "src"), { recursive: true });
  await writeFile(path.join(target, "src", "index.js"), "export const fixture = true;\n", "utf8");
  execFileSync("git", ["-C", target, "add", "src/index.js"], { stdio: "ignore" });
  execFileSync("git", ["-C", target, "commit", "-qm", "seed fixture"], { stdio: "ignore" });
  return target;
}
