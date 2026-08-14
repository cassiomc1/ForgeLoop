import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runCommandExecution } from "../../src/core/execution.js";
import { readWorkState } from "../../src/core/work-state.js";

/**
 * Older lifecycle fixtures describe manual evidence with `kind: command`.
 * Keep those fixtures explicit as manual observations while command-backed
 * tests opt into the new ForgeLoop execution contract.
 */
export async function recordManualCheck(recordCheck, input) {
  const kind = input.kind ?? "command";
  const command = typeof input.command === "string" ? input.command.trim() : "";
  const installCapable = /^(?:npx|pnpx|bunx|uvx|pipx|pnpm\s+dlx|yarn\s+dlx|bun\s+x|uv\s+tool\s+run)/u.test(command);
  if (kind === "command" && input.executionRef === undefined && installCapable) {
    const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu)
      ?.map((token) => token.replace(/^("|')|("|')$/gu, "")) ?? [];
    const state = await readWorkState(input.target, input.packageRoot);
    const fakeNpx = path.join(input.target, ".forgeloop", "test-bin", "npx");
    await mkdir(path.dirname(fakeNpx), { recursive: true });
    await writeFile(fakeNpx, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(fakeNpx, 0o755);
    const execution = await runCommandExecution({
      target: input.target,
      packageRoot: input.packageRoot,
      taskId: state.taskId,
      checkId: input.id,
      requirement: input.requirement,
      verificationCycle: state.verificationCycle ?? 1,
      argv: [fakeNpx, ...tokens.slice(1)],
      details: input.details,
      authorityContext: input.authorityContext,
      runtimeContext: input.runtimeContext,
    });
    const { forceCommandProvenance: _forceCommandProvenance, ...clean } = input;
    return recordCheck({
      ...clean,
      command: execution.execution.argv.join(" "),
      result: input.result ?? execution.result,
      ...(execution.execution.exitCode === null ? {} : { exitCode: execution.execution.exitCode }),
      executionRef: execution.execution.executionId,
      provenance: "FORGELOOP_EXECUTED",
    });
  }
  if (kind === "command"
    && input.executionRef === undefined
    && !input.details?.installationAuthorityRef
    && !installCapable
    && input.forceCommandProvenance !== true) {
    return recordCheck({ ...input, kind: "manual-review" });
  }
  const { forceCommandProvenance: _forceCommandProvenance, ...clean } = input;
  return recordCheck(clean);
}
