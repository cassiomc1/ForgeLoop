import { PROTOCOL_VERSION } from "./protocol.js";
import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { REQUIREMENT_TYPES, isMixedTerminalRequirement } from "./evidence-readiness.js";

export const CONTRACT_SCHEMA_VERSION = 1;

const CONTRACT_STRING_ARRAY_FIELDS = Object.freeze([
  "deliverables",
  "constraints",
  "risks",
  "stopConditions",
  "unresolvedDecisions",
  "sourceRefs",
]);

const CONTRACT_REQUIREMENT_FIELDS = Object.freeze([
  "verification",
  "successCriteria",
]);

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

function assertRequirementItem(item, label, seenIds) {
  if (typeof item === "string") {
    if (item.trim() === "") {
      throw new Error(`${label} must be a non-empty string or requirement object`);
    }
    if (isMixedTerminalRequirement(item)) {
      const err = new Error(`Mixed verification and lifecycle requirement detected in ${label}: ${item}`);
      err.code = "E_CIRCULAR_COMPLETION_REQUIREMENT";
      throw err;
    }
    return;
  }
  if (item && typeof item === "object" && !Array.isArray(item)) {
    if (typeof item.text !== "string" || item.text.trim() === "") {
      throw new Error(`${label}.text must be a non-empty string`);
    }
    if (isMixedTerminalRequirement(item.text)) {
      const err = new Error(`Mixed verification and lifecycle requirement detected in ${label}: ${item.text}`);
      err.code = "E_CIRCULAR_COMPLETION_REQUIREMENT";
      throw err;
    }
    if (item.id !== undefined) {
      if (typeof item.id !== "string" || item.id.trim() === "") {
        throw new Error(`${label}.id must be a non-empty string`);
      }
      if (seenIds.has(item.id)) {
        throw new Error(`Duplicate requirement ID in contract: ${item.id}`);
      }
      seenIds.add(item.id);
    }
    if (item.type !== undefined && !REQUIREMENT_TYPES.includes(item.type)) {
      throw new Error(`${label}.type must be a valid requirement type`);
    }
    if (item.operator !== undefined && !["SINGLE", "ALL"].includes(item.operator)) {
      throw new Error(`${label}.operator must be SINGLE or ALL`);
    }
    if (item.requiredEvidenceKind !== undefined && !["OBSERVED", "INFERRED", "NOT_VERIFIED", "BLOCKED", "HYPOTHESIS"].includes(item.requiredEvidenceKind)) {
      throw new Error(`${label}.requiredEvidenceKind must be a valid evidence kind`);
    }
    if (item.requirements !== undefined) {
      if (!Array.isArray(item.requirements)) {
        throw new Error(`${label}.requirements must be an array`);
      }
      item.requirements.forEach((child, index) => {
        assertRequirementItem(child, `${label}.requirements[${index}]`, seenIds);
      });
    }
    return;
  }
  throw new Error(`${label} must be a non-empty string or requirement object`);
}

function assertRequirementArray(value, label, seenIds) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  value.forEach((item, index) => {
    assertRequirementItem(item, `${label}[${index}]`, seenIds);
  });
}

const ASSUMPTION_FIELDS = Object.freeze([
  "value",
  "reason",
  "scope",
  "reversible",
  "source",
]);

function assertAssumptionObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }

  const keys = Object.keys(value);
  const unexpected = keys.filter((key) => !ASSUMPTION_FIELDS.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unknown property: ${unexpected[0]}`);
  }

  for (const field of ASSUMPTION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${label}.${field} is required`);
    }
  }

  if (typeof value.value !== "string" || value.value.trim() === "") {
    throw new Error(`${label}.value must be a non-empty string`);
  }
  if (typeof value.reason !== "string" || value.reason.trim() === "") {
    throw new Error(`${label}.reason must be a non-empty string`);
  }
  if (typeof value.scope !== "string" || value.scope.trim() === "") {
    throw new Error(`${label}.scope must be a non-empty string`);
  }
  if (value.reversible !== true) {
    throw new Error(`${label}.reversible must be true`);
  }
  if (value.source !== "agent-default") {
    throw new Error(`${label}.source must be agent-default`);
  }
}

export function assertAssumptions(value, label = "Contract assumptions") {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  value.forEach((item, index) => {
    assertAssumptionObject(item, `${label}[${index}]`);
  });
  return value;
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
    assumptions: [],
  };
  assertAssumptions(input.assumptions ?? []);
  const seenIds = new Set();
  for (const field of CONTRACT_STRING_ARRAY_FIELDS) {
    const value = input[field] ?? [];
    assertStringArray(value, `Contract ${field}`);
    contract[field] = [...value];
  }
  for (const field of CONTRACT_REQUIREMENT_FIELDS) {
    const value = input[field] ?? [];
    assertRequirementArray(value, `Contract ${field}`, seenIds);
    contract[field] = structuredClone(value);
  }
  contract.assumptions = (input.assumptions ?? []).map((assumption) => ({
    value: assumption.value,
    reason: assumption.reason,
    scope: assumption.scope,
    reversible: assumption.reversible,
    source: assumption.source,
  }));
  assertSecretFree(contract);
  return contract;
}

export function contractFingerprint(contract) {
  return canonicalFingerprint(contract);
}

export async function validateContract(contract, packageRoot) {
  assertSecretFree(contract);
  assertAssumptions(contract.assumptions ?? []);
  const seenIds = new Set();
  for (const field of CONTRACT_STRING_ARRAY_FIELDS) {
    assertStringArray(contract[field] ?? [], `Contract ${field}`);
  }
  for (const field of CONTRACT_REQUIREMENT_FIELDS) {
    assertRequirementArray(contract[field] ?? [], `Contract ${field}`, seenIds);
  }
  const schema = await readSchema("current-contract", packageRoot);
  assertSchema(contract, schema, "current contract");
  return contract;
}

export async function readContract(target, packageRoot) {
  const artifact = await readJsonArtifact(target, ARTIFACT_PATHS.contract, "current-contract", packageRoot);
  await validateContract(artifact.value, packageRoot);
  return artifact;
}

export async function writeContract(target, contract, packageRoot, options = {}) {
  assertSecretFree(contract);
  assertAssumptions(contract.assumptions ?? []);
  return writeJsonArtifact(
    target,
    ARTIFACT_PATHS.contract,
    contract,
    "current-contract",
    packageRoot,
    options,
  );
}
