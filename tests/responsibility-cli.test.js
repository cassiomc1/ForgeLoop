import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs } from "../src/cli.js";
import { formatResponsibilitySetResult } from "../src/commands/responsibility-set.js";
import { formatResponsibilityStatusResult } from "../src/commands/responsibility-status.js";

test("responsibility CLI options remain descriptive constraints, not role claims", () => {
  const parsed = parseArgs([
    "responsibility-set",
    "--task", "responsibility-cli-001",
    "--label", "quality-pass",
    "--allowed-path", "src",
    "--read-only-path", "tests",
    "--required-check", "unit-tests",
    "--freeze-contract",
    "--json",
  ]);
  assert.equal(parsed.options.responsibilityLabel, "quality-pass");
  assert.deepEqual(parsed.options.responsibilityAllowedPaths, ["src"]);
  assert.deepEqual(parsed.options.responsibilityReadOnlyPaths, ["tests"]);
  assert.deepEqual(parsed.options.responsibilityRequiredChecks, ["unit-tests"]);
  assert.equal(parsed.options.responsibilityFreezeContract, true);
  assert.match(formatResponsibilitySetResult({ taskId: "task", responsibility: { label: "quality-pass" }, fingerprint: "a".repeat(64), path: "responsibility.json" }), /quality-pass/);
  assert.match(formatResponsibilityStatusResult({ status: "NOT_APPLICABLE", taskId: "task", errors: [] }), /NOT_APPLICABLE/);
});
