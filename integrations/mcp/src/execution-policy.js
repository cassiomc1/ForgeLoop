/**
 * Process-level execution policy enforcement for external-execution
 * invocations. The launch-time `maxExecutionTimeMs` is a real maximum: tool
 * input can lower it within bounds but can never exceed it, and a missing or
 * null timeout receives the server maximum so external processes are never
 * unlimited.
 */
function mcpPolicyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function applyExecutionPolicy({ classification, args, policy }) {
  if (!classification?.executesExternalProcess) {
    return args;
  }

  const requested = args?.timeoutMs;

  if (requested === undefined || requested === null) {
    return { ...(args ?? {}), timeoutMs: policy.maxExecutionTimeMs };
  }

  if (!Number.isInteger(requested) || requested <= 0) {
    throw mcpPolicyError(
      "E_MCP_EXECUTION_TIMEOUT_INVALID",
      "timeoutMs must be a positive integer number of milliseconds",
    );
  }

  if (requested > policy.maxExecutionTimeMs) {
    throw mcpPolicyError(
      "E_MCP_EXECUTION_TIMEOUT_EXCEEDS_LIMIT",
      `timeoutMs exceeds the server maximum of ${policy.maxExecutionTimeMs}ms`,
    );
  }

  return args;
}
