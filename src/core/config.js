import { PROTOCOL_VERSION } from "./protocol.js";
import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";

export const CONFIG_SCHEMA_VERSION = 1;
export const COMPLIANCE_MODES = Object.freeze(["advisory", "standard", "strict"]);

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...new Set(value)];
}

export function createConfig(input = {}) {
  const complianceMode = input.complianceMode ?? "standard";
  if (!COMPLIANCE_MODES.includes(complianceMode)) {
    throw new Error(`Unknown compliance mode: ${complianceMode}`);
  }
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    complianceMode,
    ...(input.policy !== undefined ? { policy: input.policy } : {}),
    ...(input.requiredGates !== undefined ? { requiredGates: stringArray(input.requiredGates, "requiredGates") } : {}),
    ...(input.requiredEvidence !== undefined ? { requiredEvidence: stringArray(input.requiredEvidence, "requiredEvidence") } : {}),
  };
}

export async function readConfig(target, packageRoot) {
  return (await readJsonArtifact(target, ARTIFACT_PATHS.config, "config", packageRoot)).value;
}

export async function writeConfig(target, config, packageRoot, options = {}) {
  return writeJsonArtifact(target, ARTIFACT_PATHS.config, config, "config", packageRoot, options);
}
