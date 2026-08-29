import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs } from "../src/cli.js";
import { formatVerifyScopeResult } from "../src/commands/verify-scope.js";

test("verification-scope CLI exposes the canonical mode options and English output", () => {
  const parsed = parseArgs([
    "verify-scope",
    "--task", "scope-cli-001",
    "--mode", "changed",
    "--json",
  ]);
  assert.equal(parsed.command, "verify-scope");
  assert.equal(parsed.options.taskId, "scope-cli-001");
  assert.equal(parsed.options.verificationScopeMode, "changed");
  assert.equal(parsed.options.json, true);
  assert.match(formatVerifyScopeResult({
    path: ".forgeloop/task-state/scope-cli-001/verification-scope.json",
    scope: { taskId: "scope-cli-001", resolvedMode: "CHANGED", selectedPaths: ["src/index.js"] },
  }), /FORGELOOP VERIFICATION SCOPE: CHANGED/);
});
