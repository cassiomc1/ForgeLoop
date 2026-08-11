export const JSON_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  maxDepth: 32,
  maxArrayLength: 10_000,
  maxObjectKeys: 10_000,
  maxStringLength: 100_000,
});

export class JsonLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "JsonLimitError";
    this.code = "JSON_LIMIT_EXCEEDED";
  }
}

export function assertJsonBytes(bytes, label = "JSON artifact", limits = JSON_LIMITS) {
  const size = typeof bytes === "string" ? Buffer.byteLength(bytes, "utf8") : bytes.byteLength;
  if (size > limits.maxBytes) {
    throw new JsonLimitError(`${label} exceeds the ${limits.maxBytes}-byte limit`);
  }
  return bytes;
}

export function assertJsonLimits(value, label = "JSON artifact", limits = JSON_LIMITS) {
  const visited = new WeakSet();

  function visit(current, depth, location) {
    if (typeof current === "string") {
      if (current.length > limits.maxStringLength) {
        throw new JsonLimitError(`${location} exceeds the string length limit`);
      }
      return;
    }
    if (!current || typeof current !== "object") return;
    if (visited.has(current)) throw new JsonLimitError(`${location} contains a circular reference`);
    visited.add(current);
    if (depth > limits.maxDepth) throw new JsonLimitError(`${location} exceeds the JSON depth limit`);
    if (Array.isArray(current)) {
      if (current.length > limits.maxArrayLength) throw new JsonLimitError(`${location} exceeds the array length limit`);
      current.forEach((item, index) => visit(item, depth + 1, `${location}[${index}]`));
    } else {
      const keys = Object.keys(current);
      if (keys.length > limits.maxObjectKeys) throw new JsonLimitError(`${location} exceeds the object key limit`);
      for (const key of keys) {
        if (key.length > limits.maxStringLength) throw new JsonLimitError(`${location} contains an oversized key`);
        visit(current[key], depth + 1, `${location}.${key}`);
      }
    }
  }

  visit(value, 0, label);
  return value;
}
