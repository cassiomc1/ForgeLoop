/**
 * Transport-safe error mapping. Original public ForgeLoop error codes are
 * always preserved; the adapter only adds transport metadata. Stack traces,
 * environment values, and raw child-process stderr are never exposed.
 */
import { sanitizeErrorPayload, sanitizeClientMessage } from "./error-sanitization.js";

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

/**
 * Bounded result guarantee (§13): canonical JSON is never silently
 * truncated — an oversized payload becomes a deterministic transport error.
 */
export function enforceOutputBound(toolResult) {
  const serialized = JSON.stringify({
    content: toolResult.content,
    structuredContent: toolResult.structuredContent,
  });
  if (Buffer.byteLength(serialized, "utf8") > MAX_OUTPUT_BYTES) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: false,
          error: {
            code: "E_MCP_RESULT_TOO_LARGE",
            message: `Serialized result exceeds the ${MAX_OUTPUT_BYTES} byte MCP output bound`,
          },
        }, null, 2),
      }],
      structuredContent: {
        ok: false,
        error: { code: "E_MCP_RESULT_TOO_LARGE" },
      },
    };
  }
  return toolResult;
}

export function envelopeToToolResult(envelope) {
  if (!envelope.ok) {
    const sanitizedError = sanitizeErrorPayload(envelope.error);
    return {
      isError: true,
      content: [{
        type: "text",
        text: JSON.stringify({ ok: false, command: envelope.command, error: sanitizedError }, null, 2),
      }],
      structuredContent: {
        ok: false,
        command: envelope.command,
        error: sanitizedError,
      },
    };
  }
  return enforceOutputBound({
    isError: false,
    content: [{
      type: "text",
      text: JSON.stringify(envelope, null, 2),
    }],
    structuredContent: envelope,
  });
}

export function capabilityRefusalResult({ code, requiredCapability, command, messageOverride = null }) {
  const flagFor = {
    allowExternalExecution: "--allow-external-execution",
    allowMaintenance: "--allow-maintenance",
    allowRecovery: "--allow-recovery",
    allowLegacyRepair: "--allow-legacy-repair",
    allowForceRecovery: "--allow-force-recovery",
  };
  const flag = flagFor[requiredCapability] ?? `--${requiredCapability}`;
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({
        ok: false,
        command,
        error: {
          code,
          message: messageOverride ?? `Server launch policy does not enable this capability (${requiredCapability}). Restart the ForgeLoop MCP server with ${flag} in --mode full.`,
        },
      }, null, 2),
    }],
    structuredContent: {
      ok: false,
      command,
      error: { code, requiredCapability },
    },
  };
}
