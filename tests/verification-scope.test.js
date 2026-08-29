import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";

import { resolveVerificationScope, validateVerificationScope } from "../src/core/verification-scope.js";
import { getPackageRoot } from "../src/core/templates.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";

const packageRoot = getPackageRoot();

test("verification scope resolves only from canonical changed paths and claims", async () => {
  const target = await createGitRepository("forgeloop-verification-scope-");
  const taskId = "verification-scope-001";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await writeFile(`${target}/src/index.js`, "export const fixture = false;\n", "utf8");
    const changed = await resolveVerificationScope(target, { taskId, packageRoot, mode: "AUTO" });
    assert.equal(changed.scope.resolvedMode, "CHANGED");
    assert.deepEqual(changed.scope.selectedPaths, ["src/index.js"]);

    const full = await resolveVerificationScope(target, { taskId, packageRoot, mode: "FULL" });
    assert.equal(full.scope.resolvedMode, "FULL");
    assert.deepEqual(full.scope.selectedPaths, []);
    await assert.rejects(
      () => validateVerificationScope({ ...full.scope, requestedMode: "IMPACTED" }, packageRoot),
      (error) => error.code === "E_VERIFICATION_SCOPE_INVALID",
    );
  } finally {
    await removeTempTree(target);
  }
});
