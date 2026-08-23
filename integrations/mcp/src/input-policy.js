import { INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";

/**
 * Structured-input byte bound (closing plan §3-6): JSON Schema cannot express
 * serialized size, so the adapter enforces INTEGRATION_LIMITS
 * .maxStructuredInputBytes after schema validation and before any canonical
 * execution. Input is never silently truncated.
 */
export function enforceStructuredInputBound(args) {
  const serialized = JSON.stringify(args ?? {});
  const size = Buffer.byteLength(serialized, "utf8");

  if (size > INTEGRATION_LIMITS.maxStructuredInputBytes) {
    const error = new Error(
      `Structured MCP input exceeds ${INTEGRATION_LIMITS.maxStructuredInputBytes} bytes`,
    );
    error.code = "E_MCP_INPUT_TOO_LARGE";
    throw error;
  }

  return args ?? {};
}
