import { INTEGRATION_LIMITS } from "@cassiomc1/forgeloop/integration";

const SECRET_PATTERNS = [
  // Bearer / Authorization headers
  /[Bb]earer\s+[A-Za-z0-9\-._~+/]+=*/g,
  /(Authorization"?\s*[:=]\s*)\S+/gi,
  // GitHub tokens (classic and fine-grained)
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
  // npm tokens
  /\bnpm_[A-Za-z0-9]{16,}\b/g,
  // AWS access keys
  /\bAKIA[0-9A-Z]{16}\b/g,
  // Generic key/value assignments for common secret names
  /((?:OPENAI|ANTHROPIC|AWS_SECRET|GITHUB|NPM|SLACK|STRIPE)[_A-Z0-9]*?(?:_KEY|_TOKEN|_SECRET)"?\s*[:=]\s*)"[^"]*"/gi,
  /((?:OPENAI|ANTHROPIC|AWS_SECRET|GITHUB|NPM|SLACK|STRIPE)[_A-Z0-9]*?(?:_KEY|_TOKEN|_SECRET)"?\s*[:=]\s*)[^\s"',;)]+/gi,
  // Credential-bearing URLs
  /(https?:\/\/)[^\s/@:]+:[^\s/@]+@[^\s]*/g,
  // PEM private keys
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

const MAX_SANITIZED_MESSAGE_LENGTH = 2000;

/**
 * Produce a client-safe message: canonical meaning preserved, secret-shaped
 * values redacted, stack/environment fragments removed, length bounded.
 */
export function sanitizeClientMessage(message) {
  if (typeof message !== "string") {
    return "An error occurred";
  }
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "$1[REDACTED]");
  }
  // Drop anything that looks like a stack frame.
  sanitized = sanitized
    .split("\n")
    .filter((line) => !/^\s*at\s+/.test(line))
    .join("\n");
  if (sanitized.length > MAX_SANITIZED_MESSAGE_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_SANITIZED_MESSAGE_LENGTH)}… [truncated]`;
  }
  return sanitized;
}

export function sanitizeErrorPayload(errorPayload) {
  return {
    code: typeof errorPayload?.code === "string" ? errorPayload.code : "E_MCP_INVOCATION_FAILED",
    message: sanitizeClientMessage(errorPayload?.message),
  };
}
