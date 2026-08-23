import assert from "node:assert/strict";
import { test } from "node:test";

import { INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";
import {
  assertMcpOutputWithinBound,
  stringifyBoundedMcpJson,
} from "../src/output-policy.js";
import { enforceOutputBound } from "../src/error-mapping.js";

test("payloads under the bound serialize normally", () => {
  const value = { ok: true, data: "small" };
  assert.deepEqual(JSON.parse(stringifyBoundedMcpJson(value)), value);
});

test("payloads beyond the bound throw E_MCP_RESULT_TOO_LARGE without truncation", () => {
  const huge = { blob: "x".repeat(INTEGRATION_LIMITS.maxOutputBytes) };
  assert.throws(
    () => assertMcpOutputWithinBound(huge),
    (error) => error.code === "E_MCP_RESULT_TOO_LARGE",
  );
});

test("command tool results remain bounded through enforceOutputBound", () => {
  const ok = enforceOutputBound({
    isError: false,
    content: [{ type: "text", text: "{}" }],
    structuredContent: { small: true },
  });
  assert.equal(ok.isError, false);

  const oversize = enforceOutputBound({
    isError: false,
    content: [{ type: "text", text: JSON.stringify({ blob: "y".repeat(5 * 1024 * 1024) }) }],
    structuredContent: { blob: "y".repeat(5 * 1024 * 1024) },
  });
  assert.equal(oversize.isError, true);
  const parsed = JSON.parse(oversize.content[0].text);
  assert.equal(parsed.error.code, "E_MCP_RESULT_TOO_LARGE");
});
