// Executable protocol example for tests; not a runtime authority.
import { PROTOCOL_VERSION } from "../../src/core/protocol.js";
import path from "node:path";

export const GATE_SCHEMA_VERSION = 1;
export const GATE_STATUSES = Object.freeze(["satisfied", "unverified", "blocked"]);

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...value];
}

function artifactList(value) {
  if (!Array.isArray(value)) throw new Error("Gate artifacts must be an array");
  return value.map((artifact) => {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new Error("Gate artifact entries must be objects");
    }
    if (typeof artifact.path !== "string" || !artifact.path) throw new Error("Gate artifact path is required");
    const portable = artifact.path.replaceAll("\\", "/");
    const normalized = path.posix.normalize(portable);
    if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable) || normalized === ".." || normalized.startsWith("../")) {
      throw new Error(`Gate artifact path escapes the target: ${artifact.path}`);
    }
    if (typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
      throw new Error(`Gate artifact hash is invalid: ${artifact.path}`);
    }
    return { path: normalized.replace(/^\.\//, ""), sha256: artifact.sha256 };
  });
}

export function createGate(input = {}) {
  if (typeof input.taskId !== "string" || !input.taskId) throw new Error("Gate taskId is required");
  if (typeof input.gate !== "string" || !input.gate) throw new Error("Gate name is required");
  if (!GATE_STATUSES.includes(input.status)) throw new Error(`Unknown gate status: ${input.status}`);
  const artifacts = artifactList(input.artifacts ?? []);
  return {
    schemaVersion: GATE_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    gate: input.gate,
    status: input.status,
    requiredBy: stringArray(input.requiredBy ?? [], "Gate requiredBy"),
    artifacts,
    decisions: stringArray(input.decisions ?? [], "Gate decisions"),
    unknowns: stringArray(input.unknowns ?? [], "Gate unknowns"),
    approvedAssumptions: stringArray(input.approvedAssumptions ?? [], "Gate approvedAssumptions"),
    evidence: Array.isArray(input.evidence) ? input.evidence.map((item) => ({ ...item })) : [],
  };
}
