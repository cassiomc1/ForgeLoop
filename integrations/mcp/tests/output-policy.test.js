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

test("exact serialization: compact below but pretty above the bound is rejected", () => {
  // Compact JSON fits; pretty-printing the same value overflows a small
  // custom maxBytes. The transmitted (pretty) string must be measured.
  const value = { alpha: "a", beta: "b", gamma: "c" };
  const compactBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  const prettyBytes = Buffer.byteLength(JSON.stringify(value, null, 2), "utf8");
  // Pretty always exceeds compact for non-trivial objects; setting the bound
  // exactly at the compact size proves the transmitted (pretty) form is what
  // gets measured.
  const maxBytes = compactBytes;
  assert.ok(compactBytes <= maxBytes && prettyBytes > maxBytes);

  assert.throws(
    () => stringifyBoundedMcpJson(value, 2, { maxBytes }),
    (error) => error.code === "E_MCP_RESULT_TOO_LARGE",
  );
});

test("exact byte boundary: at-max passes and returns the identical string, below-max fails", () => {
  const value = { a: 1, b: 2 };
  const serialized = JSON.stringify(value, null, 2);
  const exactBytes = Buffer.byteLength(serialized, "utf8");

  assert.equal(
    stringifyBoundedMcpJson(value, 2, { maxBytes: exactBytes }),
    serialized,
  );
  assert.throws(
    () => stringifyBoundedMcpJson(value, 2, { maxBytes: exactBytes - 1 }),
    (error) => error.code === "E_MCP_RESULT_TOO_LARGE",
  );
});

test("UTF-8 byte counting: multi-byte characters count as bytes, not code units", () => {
  const value = { text: "çã🚀" };
  const serialized = JSON.stringify(value, null, 2);
  const utf8Bytes = Buffer.byteLength(serialized, "utf8");
  assert.ok(utf8Bytes > serialized.length, "fixture uses multi-byte characters");

  assert.equal(
    stringifyBoundedMcpJson(value, 2, { maxBytes: utf8Bytes }),
    serialized,
  );
  assert.throws(
    () => stringifyBoundedMcpJson(value, 2, { maxBytes: utf8Bytes - 1 }),
    (error) => error.code === "E_MCP_RESULT_TOO_LARGE",
  );
});

test("non-size serialization errors are rethrown, not mislabeled as overflow", () => {
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => stringifyBoundedMcpJson(cyclic),
    (error) => error.code !== "E_MCP_RESULT_TOO_LARGE",
  );

  // Same discrimination through enforceOutputBound.
  assert.throws(
    () => enforceOutputBound({
      isError: false,
      content: [{ type: "text", text: "{}" }],
      structuredContent: cyclic,
    }),
    (error) => error.code !== "E_MCP_RESULT_TOO_LARGE",
  );
});

test("capabilities-shaped results are bounded through enforceOutputBound", () => {
  const capabilitiesShaped = {
    isError: false,
    content: [{
      type: "text",
      text: JSON.stringify({ blob: "z".repeat(5 * 1024 * 1024) }, null, 2),
    }],
    structuredContent: { blob: "z".repeat(5 * 1024 * 1024) },
  };
  const bounded = enforceOutputBound(capabilitiesShaped);
  assert.equal(bounded.isError, true);
  const parsed = JSON.parse(bounded.content[0].text);
  assert.equal(parsed.error.code, "E_MCP_RESULT_TOO_LARGE");

  // Under-bound capabilities result passes through unchanged.
  const small = enforceOutputBound({
    isError: false,
    content: [{ type: "text", text: JSON.stringify({ ok: true }, null, 2) }],
    structuredContent: { ok: true },
  });
  assert.equal(small.isError, false);
});
