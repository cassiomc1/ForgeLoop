/**
 * Diagnostics go to stderr only. stdout is reserved exclusively for the MCP
 * protocol transport.
 */
export function logEvent(level, event, fields = {}) {
  process.stderr.write(`${JSON.stringify({ level, event, ...fields })}\n`);
}

export function logToolCall({ tool, riskClass, durationMs, ok }) {
  logEvent("info", "tool_call", { tool, riskClass, durationMs, ok });
}

export function logResourceRead({ uri, durationMs, ok }) {
  logEvent("info", "resource_read", { uri, durationMs, ok });
}

export function logStartup(fields) {
  logEvent("info", "server_start", fields);
}
