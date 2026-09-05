import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";
import { complexityRegressions } from "../scripts/check-complexity.mjs";

test("lint covers shipped MCP code and JavaScript runners", async () => {
  const eslint = new ESLint();
  for (const file of ["scripts/run-tests.js", "scripts/run-docs-check.js", "integrations/mcp/src/server.js", "integrations/mcp/bin/forgeloop-mcp.js", "integrations/mcp/tests/server.test.js"]) {
    const config = await eslint.calculateConfigForFile(path.resolve(file));
    assert.equal(config.rules["no-undef"][0], 2, file);
    assert.equal(config.rules["no-unused-vars"][0], 2, file);
  }
  assert.equal(await eslint.isPathIgnored("integrations/mcp/node_modules/example/index.js"), true);
});

test("complexity ratchet rejects growth and new hotspots while allowing reductions", () => {
  assert.deepEqual(complexityRegressions({ file: [30] }, { file: [40, 30] }), []);
  assert.deepEqual(complexityRegressions({ file: [41, 31], added: [26] }, { file: [40] }), [
    { file: "file", score: 41, limit: 40 }, { file: "file", score: 31, limit: 25 }, { file: "added", score: 26, limit: 25 },
  ]);
});
