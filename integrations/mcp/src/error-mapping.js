/**
 * Transport-safe error mapping. Original public ForgeLoop error codes are
 * always preserved; the adapter only adds transport metadata. Stack traces,
 * environment values, and raw child-process stderr are never exposed.
 */
export function envelopeToToolResult(envelope) {
  if (!envelope.ok) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: JSON.stringify({ ok: false, command: envelope.command, error: envelope.error }, null, 2),
      }],
      structuredContent: {
        ok: false,
        command: envelope.command,
        error: envelope.error,
      },
    };
  }
  return {
    isError: false,
    content: [{
      type: "text",
      text: JSON.stringify(envelope, null, 2),
    }],
    structuredContent: envelope,
  };
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
