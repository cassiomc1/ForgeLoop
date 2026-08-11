import { PROTOCOL_VERSION } from "./protocol.js";
import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";

export const CONTRACT_SCHEMA_VERSION = 1;

const CONTRACT_ARRAY_FIELDS = Object.freeze([
  "deliverables",
  "constraints",
  "risks",
  "verification",
  "successCriteria",
  "stopConditions",
  "unresolvedDecisions",
  "sourceRefs",
]);

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

export function createContract(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Contract must be a JSON object");
  }
  if (typeof input.taskId !== "string" || input.taskId.trim() === "") {
    throw new Error("Contract taskId is required");
  }
  if (typeof input.objective !== "string" || input.objective.trim() === "") {
    throw new Error("Contract objective is required");
  }

  const contract = {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    objective: input.objective,
  };
  for (const field of CONTRACT_ARRAY_FIELDS) {
    const value = input[field] ?? [];
    assertStringArray(value, `Contract ${field}`);
    contract[field] = [...value];
  }
  return contract;
}

export function contractFingerprint(contract) {
  return canonicalFingerprint(contract);
}

export async function validateContract(contract, packageRoot) {
  assertSecretFree(contract);
  const schema = await readSchema("current-contract", packageRoot);
  assertSchema(contract, schema, "current contract");
  return contract;
}

export async function readContract(target, packageRoot) {
  return readJsonArtifact(target, ARTIFACT_PATHS.contract, "current-contract", packageRoot);
}

export async function writeContract(target, contract, packageRoot, options = {}) {
  return writeJsonArtifact(
    target,
    ARTIFACT_PATHS.contract,
    contract,
    "current-contract",
    packageRoot,
    options,
  );
}
