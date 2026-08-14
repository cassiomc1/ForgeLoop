import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { assertSchema, inspectSchemaHealth, readSchema } from "../src/core/schema-validation.js";
import { getPackageRoot } from "../src/core/templates.js";

test("schema health parses every shipped schema and reports valid status", async () => {
  const report = await inspectSchemaHealth(getPackageRoot());
  assert.equal(report.status, "valid");
  assert.ok(report.schemas.length >= 7);
  for (const schema of report.schemas) {
    assert.equal(schema.status, "valid", schema.name);
    assert.equal(schema.version, 1, schema.name);
  }
});

test("execution schema accepts a ForgeLoop-owned command execution artifact", async () => {
  const schema = await readSchema("execution", getPackageRoot());
  assertSchema({
    schemaVersion: 1,
    protocolVersion: 1,
    executionId: "exec-001",
    taskId: "task-1",
    checkId: "tests",
    requirement: "tests",
    kind: "COMMAND_EXECUTION",
    argv: ["npm", "test"],
    cwd: "/target/project",
    resolution: {
      resolutionMode: "LOCAL_PACKAGE_BINARY",
      mayInstall: false,
      installer: null,
      tool: null,
    },
    startedAt: "2026-08-14T19:00:00.000Z",
    finishedAt: "2026-08-14T19:00:03.000Z",
    status: "passed",
    exitCode: 0,
  }, schema, "execution artifact");
});

test("schema health distinguishes invalid and unsupported schema versions", async () => {
  const packageRoot = await mkdtemp(path.join(os.tmpdir(), "forgeloop-schema-"));
  try {
    await cp(path.join(getPackageRoot(), "schemas"), path.join(packageRoot, "schemas"), { recursive: true });
    await writeFile(path.join(packageRoot, "schemas", "routing-input.schema.json"), "{\n", "utf8");
    let report = await inspectSchemaHealth(packageRoot);
    assert.equal(report.status, "invalid");
    assert.equal(report.schemas.find((item) => item.name === "routing-input").status, "invalid");

    await writeFile(
      path.join(packageRoot, "schemas", "routing-input.schema.json"),
      JSON.stringify({ type: "object", properties: { schemaVersion: { const: 99 } } }),
      "utf8",
    );
    report = await inspectSchemaHealth(packageRoot);
    assert.equal(report.status, "unsupported-version");
    assert.equal(report.schemas.find((item) => item.name === "routing-input").status, "unsupported-version");
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});
