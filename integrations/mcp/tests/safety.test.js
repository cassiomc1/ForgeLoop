import assert from "node:assert/strict";
import { test } from "node:test";

import {
  capabilityRefusalResult,
  envelopeToToolResult,
} from "../src/error-mapping.js";

test("domain rejection stays ok:true with non-zero exit code", () => {
  const result = envelopeToToolResult({
    ok: true,
    command: "preflight",
    exitCode: 1,
    result: { status: "BLOCKED" },
    error: null,
    metadata: {},
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.result.status, "BLOCKED");
});

test("invocation failures map to isError with the preserved canonical code", () => {
  const result = envelopeToToolResult({
    ok: false,
    command: "task-resume",
    exitCode: 1,
    result: null,
    error: { code: "E_TASK_SCOPE_CONFLICT", message: "overlapping claims" },
    metadata: {},
  });
  assert.equal(result.isError, true);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.error.code, "E_TASK_SCOPE_CONFLICT");
  assert.equal(result.structuredContent.error.code, "E_TASK_SCOPE_CONFLICT");
});

test("capability refusals never leak internals and always name the required capability", () => {
  const result = capabilityRefusalResult({
    code: "E_MCP_CAPABILITY_DISABLED",
    requiredCapability: "allowRecovery",
    command: "task-recover",
  });
  assert.equal(result.isError, true);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.error.code, "E_MCP_CAPABILITY_DISABLED");
  assert.match(parsed.error.message, /--allow-recovery/);
  assert.equal(JSON.stringify(parsed).includes("stack"), false);
});
