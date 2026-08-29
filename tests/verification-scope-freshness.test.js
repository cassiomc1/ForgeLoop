import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";

import { captureVerificationScope, readVerificationScope, validateVerificationScopeFreshness } from "../src/core/verification-scope.js";
import { getPackageRoot } from "../src/core/templates.js";
import { setupVerifyingTask } from "./helpers/durable-lifecycle.js";
import { createGitRepository } from "./helpers/git-fixture.js";
import { removeTempTree } from "./helpers/rm-safe.js";

const packageRoot = getPackageRoot();

test("verification scope becomes stale after its canonical inputs change", async () => {
  const target = await createGitRepository("forgeloop-verification-scope-freshness-");
  const taskId = "verification-scope-freshness-001";
  try {
    await setupVerifyingTask(target, packageRoot, { taskId });
    await captureVerificationScope(target, { taskId, packageRoot, mode: "AUTO" });
    const stored = await readVerificationScope(target, { taskId, packageRoot });
    const fresh = await validateVerificationScopeFreshness(target, { taskId, packageRoot, scope: stored.value });
    assert.equal(fresh.fresh, true);

    await writeFile(`${target}/src/index.js`, `${await readFile(`${target}/src/index.js`, "utf8")}export const changed = true;\n`, "utf8");
    await assert.rejects(
      () => validateVerificationScopeFreshness(target, { taskId, packageRoot, scope: stored.value }),
      (error) => error.code === "E_VERIFICATION_SCOPE_STALE",
    );
  } finally {
    await removeTempTree(target);
  }
});
