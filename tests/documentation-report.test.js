import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("docs:report emits documentation health metrics", () => {
  const result = spawnSync("node", ["scripts/report_documentation_health.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.cliCommandsDocumented, "all");
  assert.equal(report.schemasDocumented, "all");
  assert.equal(report.publicErrorsDocumented, "all");
  assert.equal(report.brokenDocumentationContracts, 0);
});
