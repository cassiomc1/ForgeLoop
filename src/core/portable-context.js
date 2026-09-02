import { assertJsonLimits } from "./json-safety.js";
import { assertSecretFree } from "./receipt.js";
import { E_PORTABLE_CONTEXT_INVALID } from "./error-codes.js";

export class PortableContextError extends Error {
  constructor(message, { code = E_PORTABLE_CONTEXT_INVALID, cause } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "PortableContextError";
    this.code = code;
  }
}

const PORTABLE_SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:^|\s)(?:sk|ghp|glpat|xox[baprs])-[-_a-z0-9]{8,}/i,
  /(?:AKIA|ASIA)[A-Z0-9]{12,}/,
  /(?:bearer\s+[-_a-z0-9\.]{4,})/i,
  /(?:authorization:\s*bearer)/i,
];

function containsSecretPattern(str) {
  return PORTABLE_SECRET_PATTERNS.some((pattern) => pattern.test(str));
}

function checkObjectForSecrets(value, location = "$") {
  if (typeof value === "string") {
    if (containsSecretPattern(value)) {
      throw new Error(`${location}: secret-like value is not allowed`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkObjectForSecrets(item, `${location}[${index}]`));
  } else {
    for (const [key, child] of Object.entries(value)) {
      checkObjectForSecrets(child, `${location}.${key}`);
    }
  }
}

export function normalizePortableText(
  value,
  {
    label = "portable text",
    maxLength,
    optional = false,
  } = {},
) {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw new PortableContextError(`${label} is required`);
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new PortableContextError(`${label} must be a non-empty string`);
  }

  if (typeof maxLength === "number" && value.length > maxLength) {
    throw new PortableContextError(`${label} exceeds the ${maxLength}-character limit`);
  }

  if (/\p{Cc}/u.test(value)) {
    throw new PortableContextError(`${label} contains control characters`);
  }

  return value;
}

export function assertPortableContextSafe(
  value,
  {
    label = "portable context",
  } = {},
) {
  try {
    assertJsonLimits(value, label);
    assertSecretFree(value);
    checkObjectForSecrets(value, label);
    return value;
  } catch (error) {
    if (error.code === E_PORTABLE_CONTEXT_INVALID) {
      throw error;
    }
    throw new PortableContextError(
      `${label} failed safety verification: ${error.message}`,
      { code: E_PORTABLE_CONTEXT_INVALID, cause: error },
    );
  }
}

export function deepFreeze(object) {
  if (object === null || typeof object !== "object" || Object.isFrozen(object)) {
    return object;
  }
  Object.freeze(object);
  for (const value of Object.values(object)) {
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return object;
}
