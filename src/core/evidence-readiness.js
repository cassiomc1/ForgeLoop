import { sha256 } from "./manifest.js";

export const REQUIREMENT_TYPES = Object.freeze([
  "PRODUCT",
  "VERIFICATION",
  "LIFECYCLE",
  "PUBLICATION",
  "PRODUCTION_READINESS",
]);

const LIFECYCLE_TERMS = /\b(?:lifecycle reaches|forgeloop reaches|complete returns|validator-backed complete|completion validated|review is approved)\b/i;
const PUBLICATION_TERMS = /\b(?:publication succeeds|release is published|package is published)\b/i;
const PRODUCTION_TERMS = /\b(?:deployment succeeds|production deployment|production readiness)\b/i;

function stableId(text) {
  return `REQ_${sha256(Buffer.from(text.trim().replace(/\s+/g, " ").toLowerCase())).slice(0, 16).toUpperCase()}`;
}

export function classifyRequirement(input) {
  if (typeof input === "string") {
    const text = input.trim();
    const type = LIFECYCLE_TERMS.test(text)
      ? "LIFECYCLE"
      : PUBLICATION_TERMS.test(text)
        ? "PUBLICATION"
        : PRODUCTION_TERMS.test(text)
          ? "PRODUCTION_READINESS"
          : "VERIFICATION";
    return {
      id: stableId(text),
      text,
      type,
      operator: "SINGLE",
      lifecycleOwned: type === "LIFECYCLE",
      requiredEvidenceKind: "OBSERVED",
      requirements: [],
    };
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Requirement must be a string or object");
  }
  const text = input.text ?? input.id;
  const classified = classifyRequirement(text);
  const type = input.type ?? classified.type;
  return {
    ...classified,
    ...structuredClone(input),
    id: input.id ?? classified.id,
    text,
    type,
    operator: input.operator ?? (input.requirements?.length ? "ALL" : "SINGLE"),
    lifecycleOwned: input.lifecycleOwned ?? type === "LIFECYCLE",
    requiredEvidenceKind: input.requiredEvidenceKind ?? "OBSERVED",
    requirements: (input.requirements ?? []).map(classifyRequirement),
  };
}

export function normalizeRequirements(requirements = []) {
  const byId = new Map();
  for (const raw of requirements) {
    const requirement = classifyRequirement(raw);
    if (!byId.has(requirement.id)) byId.set(requirement.id, requirement);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function ordinaryRequirements(requirements = []) {
  return normalizeRequirements(requirements).filter((requirement) => !requirement.lifecycleOwned);
}

function matchesRequirement(check, requirement) {
  return check?.requirement === requirement.id || check?.requirement === requirement.text;
}

function componentStatus(check, requirement) {
  const components = check?.details?.components;
  if (!Array.isArray(components) || requirement.operator !== "ALL") return null;
  const statuses = requirement.requirements.map((child) => components.find((item) => (
    item?.requirementId === child.id || item?.requirement === child.text
  )));
  if (statuses.some((item) => !item)) return "MISSING";
  if (statuses.some((item) => item.status === "failed")) return "INVALID";
  if (statuses.some((item) => item.status !== "passed" || item.evidenceKind !== "OBSERVED")) return "PARTIAL";
  return "COVERED";
}

export function evaluateRequiredEvidence({ requirements = [], checks = [] } = {}) {
  const normalized = normalizeRequirements(requirements);
  const result = {
    ready: true,
    required: normalized,
    covered: [],
    missing: [],
    partial: [],
    invalid: [],
    lifecyclePending: [],
    reasonCodes: [],
  };
  for (const requirement of normalized) {
    if (requirement.lifecycleOwned) {
      result.lifecyclePending.push(requirement);
      continue;
    }
    const candidates = checks.filter((check) => matchesRequirement(check, requirement));
    const check = candidates.findLast?.(() => true) ?? candidates.at(-1);
    const compound = componentStatus(check, requirement);
    if (compound === "INVALID" || check?.status === "failed") result.invalid.push(requirement);
    else if (compound === "PARTIAL") result.partial.push(requirement);
    else if (check?.status === "passed"
      && (requirement.requiredEvidenceKind !== "OBSERVED" || check.evidenceKind === "OBSERVED")
      && (compound === null || compound === "COVERED")) result.covered.push(requirement);
    else if (check?.status === "passed" && check.evidenceKind !== "OBSERVED") {
      result.invalid.push({ ...requirement, reasonCode: "E_EVIDENCE_KIND_INVALID" });
    } else if (check) result.partial.push(requirement);
    else result.missing.push(requirement);
  }
  result.ready = result.missing.length === 0 && result.partial.length === 0 && result.invalid.length === 0;
  if (result.invalid.length) result.reasonCodes.push(
    result.invalid.some((item) => item.reasonCode === "E_EVIDENCE_KIND_INVALID")
      ? "E_EVIDENCE_KIND_INVALID"
      : "E_EVIDENCE_INVALID",
  );
  if (result.missing.length) result.reasonCodes.push("E_EVIDENCE_REQUIRED");
  if (result.partial.length) result.reasonCodes.push("E_EVIDENCE_PARTIAL");
  return result;
}
