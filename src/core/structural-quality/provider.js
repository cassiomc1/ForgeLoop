import path from "node:path";

import {
  E_STRUCTURAL_QUALITY_PROVIDER_INVALID,
  E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE,
} from "../error-codes.js";
import {
  STRUCTURAL_QUALITY_MAX_DIAGNOSTIC_STRING,
  STRUCTURAL_QUALITY_MAX_DIAGNOSTICS,
  STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN,
  STRUCTURAL_QUALITY_ROOT_CAUSES,
  structuralQualityError,
} from "./constants.js";

const SECRET_KEY = /(token|secret|password|passwd|api[-_]?key|authorization|cookie|private[-_]?key|credential)/iu;
const DETECTION_TRANSPORT = "mcp-stdio";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function providerError(code, message, artifacts = []) {
  return structuralQualityError(code, message, artifacts);
}

function requiredString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} must be a non-empty string`);
  }
  return value;
}

function score(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} must be an integer between 0 and 10000`);
  }
  return value;
}

function rawScore(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} must be a finite number`);
  }
  return value;
}

function nonNegativeIntegerOrNull(value, label) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} must be a non-negative integer or null`);
  }
  return value;
}

function relativePortablePath(value, projectPath, label) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (!path.isAbsolute(trimmed)) return trimmed.replaceAll("\\", "/");
  if (!projectPath) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} must not contain an absolute path`);
  }
  const relative = path.relative(path.resolve(projectPath), path.resolve(trimmed));
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return relative.replaceAll("\\", "/") || ".";
  }
  throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} contains a path outside the project target`);
}

function boundedDiagnosticValue(value, projectPath, label, depth = 0) {
  if (depth > 8) throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} is too deeply nested`);
  if (typeof value === "string") {
    if (value.length > STRUCTURAL_QUALITY_MAX_DIAGNOSTIC_STRING) {
      throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} exceeds the diagnostic string limit`);
    }
    return relativePortablePath(value, projectPath, label);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length > STRUCTURAL_QUALITY_MAX_DIAGNOSTICS) {
      throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} exceeds the diagnostic count limit`);
    }
    return value.map((item, index) => boundedDiagnosticValue(item, projectPath, `${label}[${index}]`, depth + 1));
  }
  if (!isRecord(value)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} contains an unsupported value`);
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `${label} contains a secret-like field`);
    }
    output[key] = boundedDiagnosticValue(item, projectPath, `${label}.${key}`, depth + 1);
  }
  return output;
}

function rootCauseInput(raw, cause) {
  const source = raw?.rootCauses?.[cause]
    ?? raw?.root_causes?.[cause]
    ?? raw?.rootCauseScores?.[cause]
    ?? raw?.root_cause_scores?.[cause];
  if (typeof source === "number") return { score: source, raw: source };
  if (!isRecord(source)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `scan.rootCauses.${cause} is required`);
  }
  return {
    score: source.score ?? source.normalizedScore ?? source.normalized_score,
    raw: source.raw ?? source.value ?? source.metric,
  };
}

function canonicalBottleneck(rootCauses) {
  return STRUCTURAL_QUALITY_ROOT_CAUSES.reduce((best, cause) => (
    best === null || rootCauses[cause].score < rootCauses[best].score ? cause : best
  ), null);
}

function normalizeStatistics(raw) {
  const statistics = raw?.statistics ?? {};
  const source = raw?.scan ?? raw;
  return {
    files: nonNegativeIntegerOrNull(statistics.files ?? source.files ?? source.fileCount ?? source.file_count, "snapshot.statistics.files"),
    lines: nonNegativeIntegerOrNull(statistics.lines ?? source.lines ?? source.lineCount ?? source.line_count, "snapshot.statistics.lines"),
    importEdges: nonNegativeIntegerOrNull(statistics.importEdges ?? statistics.import_edges ?? source.importEdges ?? source.import_edges ?? source.importEdgeCount, "snapshot.statistics.importEdges"),
    crossModuleEdges: nonNegativeIntegerOrNull(statistics.crossModuleEdges ?? statistics.cross_module_edges ?? source.crossModuleEdges ?? source.cross_module_edges, "snapshot.statistics.crossModuleEdges"),
  };
}

export function normalizeStructuralQualityDetection(raw = {}, defaults = {}) {
  const source = isRecord(raw) ? raw : {};
  const providerId = source.providerId ?? source.provider_id ?? defaults.providerId ?? defaults.id;
  requiredString(providerId, "detection.providerId");
  if (!STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN.test(providerId)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "detection.providerId must be a lower-case provider ID");
  }
  const providerVersion = source.providerVersion ?? source.provider_version ?? source.version ?? defaults.providerVersion ?? defaults.version ?? null;
  if (providerVersion !== null && typeof providerVersion !== "string") {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "detection.providerVersion must be a string or null");
  }
  const transport = source.transport ?? defaults.transport ?? DETECTION_TRANSPORT;
  requiredString(transport, "detection.transport");
  const measurementModel = source.measurementModel ?? source.measurement_model ?? defaults.measurementModel ?? defaults.measurement_model ?? "structural-root-causes-v1";
  requiredString(measurementModel, "detection.measurementModel");
  const compatibilityKey = source.compatibilityKey ?? source.compatibility_key ?? defaults.compatibilityKey ?? defaults.compatibility_key ?? null;
  if (compatibilityKey !== null && typeof compatibilityKey !== "string") {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "detection.compatibilityKey must be a string or null");
  }
  const reasonCode = source.reasonCode ?? source.reason_code ?? null;
  if (reasonCode !== null && typeof reasonCode !== "string") {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "detection.reasonCode must be a string or null");
  }
  return {
    available: source.available === true,
    providerId,
    providerVersion,
    transport,
    measurementModel,
    compatibilityKey,
    reasonCode,
  };
}

export function normalizeStructuralQualitySnapshot(raw, { projectPath = null } = {}) {
  const source = raw?.snapshot && isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (!isRecord(source)) throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "provider scan result must be an object");
  const qualitySignal = source.qualitySignal ?? source.quality_signal ?? source.signal;
  const rootCauses = Object.fromEntries(STRUCTURAL_QUALITY_ROOT_CAUSES.map((cause) => {
    const input = rootCauseInput(source, cause);
    return [cause, {
      score: score(input.score, `snapshot.rootCauses.${cause}.score`),
      raw: rawScore(input.raw, `snapshot.rootCauses.${cause}.raw`),
    }];
  }));
  const snapshot = {
    qualitySignal: score(qualitySignal, "snapshot.qualitySignal"),
    bottleneck: canonicalBottleneck(rootCauses),
    rootCauses,
    statistics: normalizeStatistics(source),
    diagnostics: source.diagnostics === undefined || source.diagnostics === null
      ? null
      : boundedDiagnosticValue(source.diagnostics, projectPath, "snapshot.diagnostics"),
  };
  if (source.bottleneck !== undefined && source.bottleneck !== snapshot.bottleneck) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `snapshot.bottleneck must be the canonical lowest-score root cause (${snapshot.bottleneck})`);
  }
  return snapshot;
}

export function assertStructuralQualityProvider(provider) {
  if (!isRecord(provider)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "Structural-quality provider must be an object");
  }
  if (typeof provider.id !== "string" || !STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN.test(provider.id)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "Structural-quality provider id must be a lower-case provider ID");
  }
  if (typeof provider.observe !== "function" && (typeof provider.detect !== "function" || typeof provider.scan !== "function")) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "Structural-quality provider must expose observe(input) or detect(input) and scan(input)");
  }
  return provider;
}

function freezeProviderInput(input = {}) {
  const source = isRecord(input) ? input : {};
  const projectPath = requiredString(source.projectPath ?? source.target, "provider input.projectPath");
  const taskId = requiredString(source.taskId, "provider input.taskId");
  const timeoutMs = source.timeoutMs ?? 120_000;
  const maxOutputBytes = source.maxOutputBytes ?? 2 * 1024 * 1024;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "provider input.timeoutMs must be a non-negative integer");
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "provider input.maxOutputBytes must be a positive integer");
  return Object.freeze({ projectPath, taskId, timeoutMs, maxOutputBytes });
}

export function createStructuralQualityProviderRegistry({ providers = {}, builtIns = {} } = {}) {
  if (!isRecord(providers) || !isRecord(builtIns)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, "Structural-quality provider registry entries must be objects");
  }
  const custom = new Map();
  for (const [id, provider] of Object.entries(providers)) {
    if (!STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN.test(id) || id === "sentrux") {
      throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `Invalid or reserved provider ID: ${id}`);
    }
    custom.set(id, provider);
  }
  const builtInEntries = new Map(Object.entries(builtIns));
  return Object.freeze({
    async resolve(name, input) {
      const providerOrFactory = custom.get(name) ?? builtInEntries.get(name);
      if (!providerOrFactory) {
        throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Structural-quality provider is unavailable: ${name}`);
      }
      const providerInput = freezeProviderInput(input);
      const provider = typeof providerOrFactory === "function"
        ? await providerOrFactory(providerInput)
        : providerOrFactory;
      const asserted = assertStructuralQualityProvider(provider);
      if (asserted.id !== name) {
        throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `Structural-quality provider identity ${asserted.id} does not match registry key ${name}`);
      }
      return asserted;
    },
  });
}

export async function resolveStructuralQualityProvider({ providerName = "sentrux", target, taskId, timeoutMs, maxOutputBytes, runtimeContext } = {}) {
  if (typeof providerName !== "string" || !STRUCTURAL_QUALITY_PROVIDER_ID_PATTERN.test(providerName)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_INVALID, `Invalid structural-quality provider ID: ${providerName}`);
  }
  const configured = runtimeContext?.structuralQualityProviders;
  const custom = configured instanceof Map ? Object.fromEntries(configured.entries()) : configured ?? {};
  if (providerName !== "sentrux" && !Object.prototype.hasOwnProperty.call(custom, providerName)) {
    throw providerError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Structural-quality provider is unavailable: ${providerName}`);
  }
  const builtIns = {
    sentrux: async (input) => {
      const { createSentruxStructuralQualityProvider } = await import("./sentrux-mcp.js");
      return createSentruxStructuralQualityProvider(input);
    },
  };
  return createStructuralQualityProviderRegistry({ providers: custom, builtIns }).resolve(providerName, {
    projectPath: target,
    taskId,
    timeoutMs,
    maxOutputBytes,
  });
}

export function providerInputFor({ projectPath, taskId, timeoutMs, maxOutputBytes } = {}) {
  return freezeProviderInput({ projectPath, taskId, timeoutMs, maxOutputBytes });
}
