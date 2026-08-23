import { INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";

/**
 * Single source of truth for MCP output bounding (closing plan §8-13):
 * INTEGRATION_LIMITS.maxOutputBytes. Every external payload surface —
 * command tools, forgeloop_capabilities, and integration resources — must
 * pass through this helper. Canonical JSON is never silently truncated:
 * oversized payloads fail with E_MCP_RESULT_TOO_LARGE.
 */
export function assertMcpOutputWithinBound(value, {
  maxBytes = INTEGRATION_LIMITS.maxOutputBytes,
} = {}) {
  const serialized = JSON.stringify(value);
  const bytes = Buffer.byteLength(serialized, "utf8");

  if (bytes > maxBytes) {
    const error = new Error(
      `Serialized MCP result exceeds ${maxBytes} bytes`,
    );
    error.code = "E_MCP_RESULT_TOO_LARGE";
    throw error;
  }

  return serialized;
}

export function stringifyBoundedMcpJson(value, space = 2) {
  assertMcpOutputWithinBound(value);
  return JSON.stringify(value, null, space);
}
