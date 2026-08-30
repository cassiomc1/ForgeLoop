import { readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { taskArtifactPath } from "./task-paths.js";

export const USAGE_SOURCES = Object.freeze([
  "PROVIDER_REPORTED",
  "HOST_REPORTED",
  "ACTOR_REPORTED",
  "UNKNOWN",
]);

export const USAGE_FIELDS = Object.freeze([
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "totalTokens",
  "costUsd",
  "model",
  "provider",
  "source",
]);

function usageError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function nullableNonNegativeInteger(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(value) || value < 0) {
    throw usageError("E_USAGE_INVALID", `${label} must be a non-negative integer or null`);
  }
  return value;
}

function nullableCost(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw usageError("E_USAGE_INVALID", "costUsd must be a non-negative finite number or null");
  }
  return numeric;
}

function nullableString(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw usageError("E_USAGE_INVALID", `${label} must be a non-empty string or null`);
  }
  return value.trim();
}

export function unknownUsage() {
  return {
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    totalTokens: null,
    costUsd: null,
    model: null,
    provider: null,
    source: "UNKNOWN",
  };
}

export function normalizeUsage(value = {}, { defaultSource = "UNKNOWN", allowedSources = USAGE_SOURCES } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw usageError("E_USAGE_INVALID", "usage must be an object");
  }
  const source = value.source ?? defaultSource;
  if (!allowedSources.includes(source)) {
    throw usageError("E_USAGE_SOURCE_INVALID", `usage.source must be one of ${allowedSources.join(", ")}`);
  }
  return {
    inputTokens: nullableNonNegativeInteger(value.inputTokens, "inputTokens"),
    outputTokens: nullableNonNegativeInteger(value.outputTokens, "outputTokens"),
    cacheReadTokens: nullableNonNegativeInteger(value.cacheReadTokens, "cacheReadTokens"),
    cacheWriteTokens: nullableNonNegativeInteger(value.cacheWriteTokens, "cacheWriteTokens"),
    totalTokens: nullableNonNegativeInteger(value.totalTokens, "totalTokens"),
    costUsd: nullableCost(value.costUsd),
    model: nullableString(value.model, "model"),
    provider: nullableString(value.provider, "provider"),
    source,
  };
}

export function createUsageArtifact({ taskId, usage = {}, recordedAt = new Date().toISOString() } = {}) {
  if (typeof taskId !== "string" || !taskId) throw usageError("E_USAGE_INVALID", "taskId is required for usage telemetry");
  if (typeof recordedAt !== "string" || !recordedAt.trim() || Number.isNaN(Date.parse(recordedAt))) {
    throw usageError("E_USAGE_INVALID", "recordedAt must be a valid timestamp");
  }
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    recordedAt,
    usage: normalizeUsage(usage),
  };
}

export function providerUsage(value) {
  if (value === null || value === undefined) return unknownUsage();
  const candidate = value?.usage && typeof value.usage === "object" && !Array.isArray(value.usage)
    ? value.usage
    : value;
  const source = candidate?.source ?? "HOST_REPORTED";
  if (!["PROVIDER_REPORTED", "HOST_REPORTED"].includes(source)) {
    throw usageError("E_USAGE_SOURCE_INVALID", "host usage providers may report only PROVIDER_REPORTED or HOST_REPORTED");
  }
  return normalizeUsage(candidate, { defaultSource: source, allowedSources: ["PROVIDER_REPORTED", "HOST_REPORTED"] });
}

export async function readTaskUsage(target, packageRoot, taskId) {
  try {
    const artifact = await readJsonArtifact(target, taskArtifactPath(taskId, "usage"), "usage", packageRoot);
    return artifact.value.usage;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return unknownUsage();
    if (error.code === "E_USAGE_SOURCE_INVALID" || error.code === "E_USAGE_INVALID") throw error;
    error.code = "E_USAGE_INVALID";
    throw error;
  }
}

export async function writeTaskUsage(target, packageRoot, artifact, options = {}) {
  const value = createUsageArtifact(artifact);
  return writeJsonArtifact(
    target,
    taskArtifactPath(value.taskId, "usage"),
    value,
    "usage",
    packageRoot,
    { ...options, taskId: value.taskId, operation: options.operation ?? "usage-record" },
  );
}
