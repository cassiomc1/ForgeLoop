import { INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";

/**
 * Single source of truth for MCP output bounding (hardening §8-13 + exact
 * bound fix): INTEGRATION_LIMITS.maxOutputBytes. Every external payload
 * surface — command tools, forgeloop_capabilities, and integration resources
 * — must pass through this helper. Canonical JSON is never silently
 * truncated: oversized payloads fail with E_MCP_RESULT_TOO_LARGE.
 *
 * Core rule: serialize once, measure that exact UTF-8 string, transmit that
 * same string. The measured serialization must be the transmitted one.
 */
export function assertMcpSerializedOutputWithinBound(
  serialized,
  {
    maxBytes = INTEGRATION_LIMITS.maxOutputBytes,
  } = {},
) {
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

export function stringifyBoundedMcpJson(
  value,
  space = 2,
  {
    maxBytes = INTEGRATION_LIMITS.maxOutputBytes,
  } = {},
) {
  const serialized = JSON.stringify(value, null, space);

  return assertMcpSerializedOutputWithinBound(
    serialized,
    { maxBytes },
  );
}

/**
 * Convenience wrapper kept for existing callers/tests: serializes the value
 * (pretty when space is truthy) and delegates to the exact-string check.
 */
export function assertMcpOutputWithinBound(
  value,
  {
    maxBytes = INTEGRATION_LIMITS.maxOutputBytes,
    space = 0,
  } = {},
) {
  const serialized = JSON.stringify(
    value,
    null,
    space || undefined,
  );

  return assertMcpSerializedOutputWithinBound(
    serialized,
    { maxBytes },
  );
}
