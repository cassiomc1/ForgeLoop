import { sha256 } from "./manifest.js";

export const REQUIREMENT_TYPES = Object.freeze([
  "PRODUCT",
  "VERIFICATION",
  "LIFECYCLE",
  "PUBLICATION",
  "PRODUCTION_READINESS",
]);

export const TERMINAL_OWNED_TYPES = Object.freeze([
  "LIFECYCLE",
  "PUBLICATION",
  "PRODUCTION_READINESS",
]);

const LIFECYCLE_TERMS = /\b(?:lifecycle reaches|forgeloop reaches|complete returns|validator-backed complete|completion validated|review is approved)\b/i;
const PUBLICATION_TERMS = /\b(?:publication succeeds|release (?:is )?published|package (?:is )?published|published to|published package)\b/i;
const PRODUCTION_TERMS = /\b(?:deployment succeeds|production deployment|production readiness|deployed to)\b/i;
const NON_TERMINAL_TERMS = /\b(?:tests?|lint|build|typecheck|types?|coverage|keyboard|zoom|contrast|motion|checks?|unit|e2e|integration|suite|regression|browser|responsive|html|css|js|component|api)\b/i;
const CONJUNCTION_TERMS = /\b(?:and|with|then|plus|also|after)\b/i;

export function isMixedTerminalRequirement(text) {
  if (typeof text !== "string") return false;
  const hasTerminal = LIFECYCLE_TERMS.test(text) || PUBLICATION_TERMS.test(text) || PRODUCTION_TERMS.test(text);
  if (!hasTerminal) return false;
  return NON_TERMINAL_TERMS.test(text) || CONJUNCTION_TERMS.test(text);
}

function stableId(text) {
  return `REQ_${sha256(Buffer.from(text.trim().replace(/\s+/g, " ").toLowerCase())).slice(0, 16).toUpperCase()}`;
}

export function classifyRequirement(input) {
  if (typeof input === "string") {
    const text = input.trim();
    const isMixed = isMixedTerminalRequirement(text);
    const type = isMixed
      ? "VERIFICATION"
      : LIFECYCLE_TERMS.test(text)
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
      terminalOwned: TERMINAL_OWNED_TYPES.includes(type),
      mixedTerminal: isMixed,
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
  const isMixed = input.mixedTerminal ?? (typeof text === "string" && isMixedTerminalRequirement(text));
  return {
    ...classified,
    ...structuredClone(input),
    id: input.id ?? classified.id,
    text,
    type,
    operator: input.operator ?? (input.requirements?.length ? "ALL" : "SINGLE"),
    lifecycleOwned: input.lifecycleOwned ?? type === "LIFECYCLE",
    terminalOwned: input.terminalOwned ?? TERMINAL_OWNED_TYPES.includes(type),
    mixedTerminal: isMixed,
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
  return normalizeRequirements(requirements).filter((requirement) => !requirement.terminalOwned);
}

export function terminalRequirements(requirements = []) {
  return normalizeRequirements(requirements).filter((requirement) => requirement.terminalOwned);
}

export function lifecycleRequirements(requirements = []) {
  return normalizeRequirements(requirements).filter((requirement) => requirement.type === "LIFECYCLE");
}

export function publicationRequirements(requirements = []) {
  return normalizeRequirements(requirements).filter((requirement) => requirement.type === "PUBLICATION");
}

export function productionReadinessRequirements(requirements = []) {
  return normalizeRequirements(requirements).filter((requirement) => requirement.type === "PRODUCTION_READINESS");
}

export function matchesRequirement(check, requirement) {
  return check?.requirement === requirement.id || check?.requirement === requirement.text;
}

export function latestAuthoritativeCheck(candidates) {
  if (!candidates || candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const cycleA = a.details?.verificationCycle ?? a.verificationCycle ?? 1;
    const cycleB = b.details?.verificationCycle ?? b.verificationCycle ?? 1;
    if (cycleA !== cycleB) return cycleA - cycleB;
    const timeA = typeof a.timestamp === "string" ? a.timestamp : "";
    const timeB = typeof b.timestamp === "string" ? b.timestamp : "";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return 0;
  }).at(-1);
}

export function authoritativeChecksForRequirements({ requirements = [], checks = [] } = {}) {
  return normalizeRequirements(requirements).map((requirement) => {
    const candidates = checks.filter((check) => matchesRequirement(check, requirement));
    return {
      requirement,
      check: latestAuthoritativeCheck(candidates),
    };
  });
}

function componentStatus(check, requirement, allChecks = []) {
  if (requirement.operator !== "ALL" || !requirement.requirements?.length) return null;
  const components = check?.details?.components;
  const statuses = requirement.requirements.map((child) => {
    if (Array.isArray(components)) {
      const matchingComp = components.filter((item) => (
        item?.requirementId === child.id || item?.requirement === child.text
      )).at(-1);
      if (matchingComp) return matchingComp;
    }
    const childCandidates = allChecks.filter((candidate) => matchesRequirement(candidate, child));
    return latestAuthoritativeCheck(childCandidates);
  });
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
    if (requirement.mixedTerminal) {
      result.invalid.push({
        ...requirement,
        reasonCode: "E_CIRCULAR_COMPLETION_REQUIREMENT",
      });
      continue;
    }
    if (requirement.terminalOwned || requirement.lifecycleOwned) {
      result.lifecyclePending.push(requirement);
      continue;
    }
    const candidates = checks.filter((check) => matchesRequirement(check, requirement));
    const check = latestAuthoritativeCheck(candidates);
    const compound = componentStatus(check, requirement, checks);
    if (compound === "INVALID" || check?.status === "failed") {
      result.invalid.push(requirement);
    } else if (compound === "PARTIAL") {
      result.partial.push(requirement);
    } else if (compound === "MISSING") {
      result.missing.push(requirement);
    } else if (
      (check?.status === "passed" || compound === "COVERED")
      && (requirement.requiredEvidenceKind !== "OBSERVED" || check?.evidenceKind === "OBSERVED" || compound === "COVERED")
      && (compound === null || compound === "COVERED")
    ) {
      result.covered.push(requirement);
    } else if (check?.status === "passed" && check.evidenceKind !== "OBSERVED") {
      result.invalid.push({ ...requirement, reasonCode: "E_EVIDENCE_KIND_INVALID" });
    } else if (check) {
      result.partial.push(requirement);
    } else {
      result.missing.push(requirement);
    }
  }
  result.ready = result.missing.length === 0 && result.partial.length === 0 && result.invalid.length === 0;
  if (result.invalid.length) {
    const specificCodes = result.invalid
      .map((item) => item.reasonCode)
      .filter(Boolean);
    if (specificCodes.length > 0) {
      result.reasonCodes.push(...new Set(specificCodes));
    } else {
      result.reasonCodes.push("E_EVIDENCE_INVALID");
    }
  }
  if (result.missing.length) result.reasonCodes.push("E_EVIDENCE_REQUIRED");
  if (result.partial.length) result.reasonCodes.push("E_EVIDENCE_PARTIAL");
  result.reasonCodes = [...new Set(result.reasonCodes)];
  return result;
}
